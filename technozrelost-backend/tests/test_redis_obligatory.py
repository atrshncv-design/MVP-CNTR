"""Task 01 (R03i, stories 3-4): Redis as obligatory prod dependency.

Seam: public HTTP boundary (/api/v1/ready, /api/v1/nioktr,
/api/v1/notifications/emit) + existing gates (pytest, ruff).
"""

from __future__ import annotations

import asyncio
import importlib.util
import sys
import uuid
from collections import OrderedDict
from pathlib import Path
from urllib.error import HTTPError

import pytest
import redis
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.v1 import health as health_module
from app.api.v1 import nioktr as nioktr_module
from app.api.v1 import realtime as realtime_module
from app.core.config import Settings, settings
from tests.support import register_test_user

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _load_alerter() -> object:
    """Loads the prod alerter by path (read-only: its zone is not ours)."""
    path = BACKEND_ROOT / "infra" / "alerter" / "alerter.py"
    spec = importlib.util.spec_from_file_location("tz_alerter_probe", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    # dataclasses resolve string annotations via sys.modules[cls.__module__]
    # (alerter uses `from __future__ import annotations`): register first.
    sys.modules["tz_alerter_probe"] = module
    spec.loader.exec_module(module)
    return module


def test_redis_client_importable_in_image() -> None:
    """Client library is installed in the image environment."""
    assert redis.__version__


def test_locked_deps_pin_redis() -> None:
    """Pin lives in pyproject and uv.lock (prod image installs --frozen)."""
    pyproject = (BACKEND_ROOT / "pyproject.toml").read_text(encoding="utf-8")
    lock = (BACKEND_ROOT / "uv.lock").read_text(encoding="utf-8")
    assert '"redis==5.2.1"' in pyproject
    assert 'name = "redis"' in lock


def test_production_fails_fast_without_redis_url() -> None:
    """Prod without REDIS_URL does not start silently (fail-fast, clear error)."""
    with pytest.raises(ValidationError, match="REDIS_URL"):
        Settings(app_env="production", jwt_secret="x" * 48, redis_url=None, _env_file=None)


def test_nonprod_keeps_local_fallback_without_redis_url() -> None:
    """Dev/test without REDIS_URL still start (in-memory fallback is local-only)."""
    assert Settings(app_env="dev", redis_url=None, _env_file=None).redis_url is None


async def _databases_ok() -> dict[str, str]:
    return {"primary": "ok", "replica": "not_configured"}


def test_ready_is_503_when_redis_unreachable(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Readiness reflects Redis: configured-but-down Redis degrades honestly."""
    monkeypatch.setattr(health_module, "check_databases", _databases_ok)
    monkeypatch.setattr(settings, "redis_url", "redis://127.0.0.1:6390/0")

    response = client.get("/api/v1/ready")

    assert response.status_code == 503
    assert response.json()["detail"]["redis"] == "unavailable"


def test_ready_is_200_without_redis_url_in_nonprod(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """No REDIS_URL outside prod is a valid local state, not an outage."""
    monkeypatch.setattr(health_module, "check_databases", _databases_ok)
    monkeypatch.setattr(settings, "redis_url", None)

    response = client.get("/api/v1/ready")

    assert response.status_code == 200
    assert response.json()["redis"] == "not_configured"


def test_redis_outage_raises_alert() -> None:
    """Alerter maps the 503 readiness (Redis down) to CRITICAL + alert event."""
    alerter = _load_alerter()

    def _boom(request: object, timeout: float = 5.0) -> object:
        url = getattr(request, "full_url", "http://backend:8000/api/v1/ready")
        raise HTTPError(url, 503, "Service Unavailable", None, None)

    result = alerter.check_readiness("http://backend:8000/api/v1/ready", opener=_boom)
    assert result.name == "readiness"
    assert result.state == "critical"

    sent: list[str] = []

    def _send(message: str) -> bool:
        sent.append(message)
        return True

    state, event = alerter.process_checks([result], alerter.AlertState(), True, _send)
    assert event == "alert"
    assert state.active
    assert len(sent) == 1 and "readiness" in sent[0]


class _SharedFakeSyncRedis:
    """Minimal sync Redis double with one shared store (simulates one server)."""

    def __init__(self, store: dict[str, int]) -> None:
        self._store = store

    def ping(self) -> bool:
        return True

    def incr(self, key: str) -> int:
        self._store[key] = self._store.get(key, 0) + 1
        return self._store[key]

    def expire(self, key: str, seconds: int) -> bool:
        return True

    def ttl(self, key: str) -> int:
        return 60


def _use_shared_registry_redis(monkeypatch: pytest.MonkeyPatch, store: dict[str, int]) -> None:
    """Points the registry limiter at a shared fake server (both replicas)."""
    monkeypatch.setattr(settings, "redis_url", "redis://shared-fake/0")
    fake = _SharedFakeSyncRedis(store)
    monkeypatch.setattr(redis.Redis, "from_url", lambda *args, **kwargs: fake)
    monkeypatch.setattr(nioktr_module, "_registry_redis_client", None)
    monkeypatch.setattr(nioktr_module, "_registry_redis_checked", False)
    monkeypatch.setattr(nioktr_module, "_registry_attempts", OrderedDict())


def _anon_registry_get(client: TestClient, ip: str) -> int:
    return client.get("/api/v1/nioktr", headers={"X-Real-IP": ip}).status_code


def test_anon_limit_is_shared_across_replicas(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """120 anon requests hold in total across two replicas, not per replica."""
    assert settings.registry_anon_limit == 120
    _use_shared_registry_redis(monkeypatch, {})
    ip = f"shared-{uuid.uuid4().hex[:8]}"

    for _ in range(60):  # replica A fills half of the shared window
        assert _anon_registry_get(client, ip) == 200
    nioktr_module._registry_attempts.clear()  # replica B: own memory, same Redis
    for _ in range(60):
        assert _anon_registry_get(client, ip) == 200
    assert _anon_registry_get(client, ip) == 429


def test_limit_doubles_without_shared_redis(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """LRU-only fallback forgets per process: the silent doubling Redis fixes."""
    monkeypatch.setattr(settings, "redis_url", None)
    monkeypatch.setattr(nioktr_module, "_registry_attempts", OrderedDict())
    ip = f"local-{uuid.uuid4().hex[:8]}"

    for _ in range(60):
        assert _anon_registry_get(client, ip) == 200
    nioktr_module._registry_attempts.clear()  # "second replica" remembers nothing
    for _ in range(60):
        assert _anon_registry_get(client, ip) == 200
    assert _anon_registry_get(client, ip) == 200  # 121st passes: limit doubled


class _SharedFakePubSub:
    """Minimal async pub/sub double over one shared bus (one Redis server)."""

    def __init__(self, bus: dict[str, list[str]]) -> None:
        self._bus = bus
        self._channel: str | None = None
        self._cursor = 0

    async def subscribe(self, channel: str) -> None:
        self._channel = channel
        self._cursor = len(self._bus.get(channel, []))

    async def get_message(
        self, ignore_subscribe_messages: bool = True, timeout: float = 20.0
    ) -> dict[str, object] | None:
        assert self._channel is not None
        pending = self._bus.get(self._channel, [])[self._cursor :]
        if not pending:
            return None
        self._cursor += 1
        return {"type": "message", "data": pending[0]}

    async def unsubscribe(self, channel: str) -> None:
        self._channel = None

    async def close(self) -> None:
        self._channel = None


class _SharedFakeAsyncRedis:
    """Minimal asyncio Redis double with one shared bus (simulates one server)."""

    def __init__(self, bus: dict[str, list[str]]) -> None:
        self._bus = bus

    async def publish(self, channel: str, payload: str) -> int:
        self._bus.setdefault(channel, []).append(payload)
        return 1

    def pubsub(self) -> _SharedFakePubSub:
        return _SharedFakePubSub(self._bus)


def test_sse_publish_reaches_other_replica(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Event emitted via HTTP on replica A is visible to replica B via Redis."""
    data = register_test_user(
        client,
        email=f"redis-{uuid.uuid4().hex[:8]}@example.com",
        full_name="Redis Manager",
        role_slug="cntr_manager",
    )
    token, uid = data["access_token"], data["user"]["id"]
    bus: dict[str, list[str]] = {}
    monkeypatch.setattr(
        realtime_module, "_get_redis_async", lambda: _SharedFakeAsyncRedis(bus)
    )
    monkeypatch.setattr(realtime_module, "_fallback_queues", {})

    # Replica B subscribes BEFORE the publish (pub/sub is live-only, like Redis).
    channel = f"realtime:{uid}"
    subscriber = _SharedFakeAsyncRedis(bus).pubsub()
    asyncio.run(subscriber.subscribe(channel))

    emitted = client.post(
        "/api/v1/notifications/emit",
        headers={"Authorization": f"Bearer {token}"},
        params={"type": "task", "title": "Кросс-реплика событие"},
    )
    assert emitted.status_code == 201, emitted.text

    assert channel in bus
    assert any("Кросс-реплика событие" in payload for payload in bus[channel])
    assert realtime_module._fallback_queues == {}

    async def _read_on_replica_b() -> dict[str, object] | None:
        try:
            return await subscriber.get_message(ignore_subscribe_messages=True, timeout=1.0)
        finally:
            await subscriber.unsubscribe(channel)
            await subscriber.close()

    message = asyncio.run(_read_on_replica_b())
    assert message is not None and "Кросс-реплика событие" in str(message["data"])
