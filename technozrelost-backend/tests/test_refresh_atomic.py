"""R05i (таск 06): атомарная ротация refresh-токенов — гонка через HTTP-шов.

Почему конкурентный тест: check-then-act (SELECT затем UPDATE) проигрывает
гонку всегда — два параллельных refresh одним токеном дают два 200.
Атомарный UPDATE с условием «ещё не отозван» даёт один 200 и один 401.
"""

from __future__ import annotations

import threading
import uuid
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient


def _register(client: TestClient) -> dict:
    email = f"atomic-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Probe12345",
            "full_name": "Atomic User",
            "role_slug": "gk_customer",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_concurrent_refresh_single_winner(client: TestClient) -> None:
    """Два параллельных refresh одним токеном: один 200, второй 401."""
    data = _register(client)
    token = data["refresh_token"]
    barrier = threading.Barrier(2)

    def _hit() -> int:
        barrier.wait(timeout=10)
        resp = client.post("/api/v1/auth/refresh", json={"refresh_token": token})
        return resp.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        future_a = pool.submit(_hit)
        future_b = pool.submit(_hit)
        first = future_a.result(timeout=30)
        second = future_b.result(timeout=30)
    assert sorted([first, second]) == [200, 401]


def test_reuse_of_revoked_token_revokes_family(client: TestClient) -> None:
    """Reuse отозванного токена: 401, семья отзывается (новый токен мёртв)."""
    data = _register(client)
    old_refresh = data["refresh_token"]

    rotated = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert rotated.status_code == 200, rotated.text
    new_refresh = rotated.json()["refresh_token"]
    assert new_refresh != old_refresh

    replay = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert replay.status_code == 401

    killed = client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh})
    assert killed.status_code == 401


def test_refresh_round_trip_not_broken(client: TestClient) -> None:
    """Обычный refresh/round-trip: новая пара работает, цепочка ротируется."""
    data = _register(client)

    me = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"}
    )
    assert me.status_code == 200

    first = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": data["refresh_token"]}
    )
    assert first.status_code == 200, first.text
    pair = first.json()

    me2 = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {pair['access_token']}"}
    )
    assert me2.status_code == 200
    assert me2.json()["email"] == data["user"]["email"]

    second = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": pair["refresh_token"]}
    )
    assert second.status_code == 200, second.text

    stale = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": data["refresh_token"]}
    )
    assert stale.status_code == 401
