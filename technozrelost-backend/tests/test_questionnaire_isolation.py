"""TICKET-07 (M-02): изоляция чтения анкеты — member видит только своё, staff — все."""

from __future__ import annotations

import asyncio
import uuid

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.db.models import Project, ProjectMember, QuestionnaireResult
from tests.support import register_test_user


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _register(client: TestClient, role: str) -> tuple[str, int]:
    data = register_test_user(client, email=_email(role), full_name=f"User {role}", role_slug=role)
    return data["access_token"], data["user"]["id"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_questionnaire_per_user_read_isolation(client: TestClient) -> None:
    """A 90% lvl1, B 30% lvl1 → A GET видит только 90, admin без all avg 60, с ?all=1 2 строки."""
    a_tok, a_id = _register(client, "gk_customer")
    b_tok, b_id = _register(client, "rd_executor")
    admin_tok, _ = _register(client, "cntr_admin")

    async def _create() -> int:
        async with SessionLocal() as db:
            p = Project(name="Iso Test", description="iso", category="IT", target_level=9, current_level=0, created_by=a_id)
            db.add(p)
            await db.flush()
            db.add(ProjectMember(project_id=p.id, user_id=a_id, role_in_project="gk_customer", status="active", is_priority=True))
            db.add(ProjectMember(project_id=p.id, user_id=b_id, role_in_project="rd_executor", status="active"))
            db.add(QuestionnaireResult(project_id=p.id, user_id=a_id, level_id=1, checked_items={"items": ["x"]}, percentage=90.0))
            db.add(QuestionnaireResult(project_id=p.id, user_id=b_id, level_id=1, checked_items={"items": ["y"]}, percentage=30.0))
            await db.commit()
            await db.refresh(p)
            return p.id

    pid = asyncio.run(_create())

    a_resp = client.get(f"/api/v1/projects/{pid}", headers=_auth(a_tok))
    assert a_resp.status_code == 200
    a_qrs = a_resp.json()["questionnaire_results"]
    assert len(a_qrs) == 1, f"A должен видеть 1 строку, получил {a_qrs}"
    assert a_qrs[0]["percentage"] == 90.0

    b_resp = client.get(f"/api/v1/projects/{pid}", headers=_auth(b_tok))
    assert b_resp.status_code == 200
    b_qrs = b_resp.json()["questionnaire_results"]
    assert len(b_qrs) == 1 and b_qrs[0]["percentage"] == 30.0

    # M4 TICKET-08: staff без all → avg per level, ?all=1 → все строки
    admin_resp = client.get(f"/api/v1/projects/{pid}", headers=_auth(admin_tok))
    assert admin_resp.status_code == 200
    admin_qrs = admin_resp.json()["questionnaire_results"]
    assert len(admin_qrs) == 1, f"admin без all должен видеть 1 avg, получил {admin_qrs}"
    assert admin_qrs[0]["percentage"] == 60.0
    assert admin_qrs[0]["members_count"] == 2
    assert admin_qrs[0]["user_id"] is None

    admin_all = client.get(f"/api/v1/projects/{pid}?all=true", headers=_auth(admin_tok))
    assert admin_all.status_code == 200
    admin_qrs_all = admin_all.json()["questionnaire_results"]
    assert len(admin_qrs_all) == 2, f"admin ?all=1 должен видеть 2 строки, получил {admin_qrs_all}"
    assert sorted([x["percentage"] for x in admin_qrs_all]) == [30.0, 90.0]


def test_performance_indexes(client: TestClient) -> None:  # noqa: ARG001
    """ix_questionnaire_results_user_id существует после 0032."""
    import os

    import psycopg

    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname="technozrelost_test",
    )
    try:
        row = conn.execute(
            "SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='questionnaire_results' AND indexname='ix_questionnaire_results_user_id'"
        ).fetchone()
        assert row is not None, "нет индекса ix_questionnaire_results_user_id"
        row2 = conn.execute(
            "SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='questionnaire_results' AND column_name='user_id'"
        ).fetchone()
        assert row2 is not None and row2[0] == "NO", f"user_id должен быть NOT NULL, получил {row2}"
    finally:
        conn.close()
