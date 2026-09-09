"""P3 (таск 15, R06i): гонка инвайтов — лимит держится под конкуррентными accept.

Шов — публичная HTTP-граница: 10 параллельных POST /invites/accept
с max_uses=1 дают ровно один 200, остальные 409. Почему конкурентный тест:
check-then-act (SELECT лимита, затем UPDATE) проигрывает гонку всегда —
два параллельных accept видят used_count=0 и оба вступают.
"""
from __future__ import annotations

import threading
import uuid
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> str:
    data = register_test_user(
        client, email=_email("race"), full_name="Гонка", role_slug=role
    )
    return data["access_token"]


def test_concurrent_invite_accept_single_winner(client: TestClient) -> None:
    """10 параллельных accept инвайта max_uses=1: успешен ровно один."""
    owner_token = _register(client)
    project = client.post(
        "/api/v1/projects",
        json={"name": "Гонка инвайтов", "target_level": 6},
        headers=_auth(owner_token),
    )
    assert project.status_code == 201, project.text
    pid = project.json()["id"]

    invite = client.post(
        f"/api/v1/projects/{pid}/invites",
        headers=_auth(owner_token),
        json={"invite_type": "bulk", "max_uses": 1, "allowed_roles": ["participant"]},
    )
    assert invite.status_code == 201, invite.text
    token = invite.json()["token"]

    tokens = [_register(client, "rd_executor") for _ in range(10)]
    barrier = threading.Barrier(len(tokens))

    def _hit(access: str) -> int:
        barrier.wait(timeout=30)
        resp = client.post(
            "/api/v1/invites/accept",
            headers=_auth(access),
            json={"token": token, "role_in_project": "participant"},
        )
        return resp.status_code

    with ThreadPoolExecutor(max_workers=len(tokens)) as pool:
        futures = [pool.submit(_hit, t) for t in tokens]
        codes = [f.result(timeout=60) for f in futures]
    assert codes.count(200) == 1, f"expected exactly one winner, got {codes}"
    assert codes.count(409) == 9, f"expected nine rejections, got {codes}"
