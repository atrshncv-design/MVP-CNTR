"""TICKET-03 (H-02a) throttle async — не блокирует loop."""

from __future__ import annotations

import asyncio
import time
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient


def test_auth_throttle_async_not_blocking(client: TestClient) -> None:  # noqa: ARG001
    """Redis sleep 0.3 не блокирует event loop — 20 gather <2s (to_thread)."""
    from app.services import auth_throttle

    auth_throttle.reset()

    class SlowRedis:
        def get(self, key: bytes | str) -> bytes | None:  # noqa: ARG002
            time.sleep(0.25)
            return None

        def incr(self, key: str) -> int:  # noqa: ARG002
            time.sleep(0.25)
            return 1

        def expire(self, key: str, ttl: int) -> bool:  # noqa: ARG002
            time.sleep(0.05)
            return True

        def ttl(self, key: str) -> int:  # noqa: ARG002
            time.sleep(0.05)
            return 60

        def delete(self, key: str) -> int:  # noqa: ARG002
            time.sleep(0.05)
            return 1

        def ping(self) -> bool:
            time.sleep(0.25)
            return True

    slow = SlowRedis()

    def fake_get_redis():  # type: ignore[no-untyped-def]
        # имитируем _get_redis без собственной задержки — основное время в client.get
        return slow

    with patch("app.services.auth_throttle._get_redis", side_effect=fake_get_redis):
        # limit до 10, но is_blocked при count=None → не блок
        async def run_is_blocked() -> float:
            start = time.monotonic()
            await asyncio.gather(*[auth_throttle.is_blocked(f"user{i}-{uuid.uuid4().hex[:4]}@example.com", "127.0.0.1") for i in range(20)])
            return time.monotonic() - start

        elapsed = asyncio.run(run_is_blocked())
        assert elapsed < 2.0, f"is_blocked блокирует loop: {elapsed:.2f}s (ожидалось <2s с to_thread)"

        async def run_record_failure() -> float:
            start = time.monotonic()
            await asyncio.gather(*[auth_throttle.record_failure(f"rf-{i}@example.com", "127.0.0.1") for i in range(20)])
            return time.monotonic() - start

        elapsed2 = asyncio.run(run_record_failure())
        assert elapsed2 < 2.0, f"record_failure блокирует loop: {elapsed2:.2f}s"

    auth_throttle.reset()

    # реальный LRU-путь тоже не должен блокировать без Redis
    with patch("app.services.auth_throttle._get_redis", return_value=None):
        async def run_lru() -> None:
            # 20 параллельных record_failure в LRU должны быть мгновенны
            start = time.monotonic()
            await asyncio.gather(*[auth_throttle.record_failure(f"lru-{i}@example.com", "10.0.0.1") for i in range(20)])
            elapsed = time.monotonic() - start
            assert elapsed < 0.5, f"LRU блокирует: {elapsed:.2f}s"
            # и is_blocked
            blocked = await auth_throttle.is_blocked("lru-0@example.com", "10.0.0.1")
            # после 1 записи не блок (<10)
            assert blocked is False

        asyncio.run(run_lru())

    auth_throttle.reset()
