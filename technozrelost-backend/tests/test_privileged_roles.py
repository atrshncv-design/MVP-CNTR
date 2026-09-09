"""R04i (таск 03): закрытая выдача привилегированных ролей. Шов — HTTP.

Покрывает критерии приёмки тикета 03 через публичную границу API:
регистрация (403), назначение администратором, решение КТ (матрица),
аудит выдачи/отзыва, миграция отзыва (фикстура, в транзакции с rollback,
чтобы не трогать строки параллельно работающих исполнителей).
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path as _Path

import psycopg
import pytest
from fastapi.testclient import TestClient

from tests.support import priority_share_sig, register_test_user

PRIVILEGED = ["auditor", "regulating_organization", "investor"]


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _provision(client: TestClient, role: str, prefix: str = "priv") -> tuple[str, int]:
    data = register_test_user(
        client, email=_email(prefix), full_name=f"Priv {role}", role_slug=role
    )
    return data["access_token"], data["user"]["id"]


def _create_project(client: TestClient, owner_token: str) -> tuple[int, int]:
    created = client.post(
        "/api/v1/projects",
        json={"name": "Прив-проект", "target_level": 5},
        headers=_auth(owner_token),
    )
    assert created.status_code == 201, created.text
    project_id = created.json()["id"]
    detail = client.get(
        f"/api/v1/projects/{project_id}", headers=_auth(owner_token)
    )
    assert detail.status_code == 200, detail.text
    cp_id = detail.json()["control_points"][0]["id"]
    return project_id, cp_id


def _join(client: TestClient, owner_token: str, project_id: int, token: str, role: str) -> None:
    detail = client.get(
        f"/api/v1/projects/{project_id}", headers=_auth(owner_token)
    )
    join_token = detail.json()["project"]["join_token"]
    joined = client.post(
        "/api/v1/projects/join",
        json={
            "token": join_token,
            "role_in_project": role,
            "share_sig": priority_share_sig(client, owner_token, project_id),
        },
        headers=_auth(token),
    )
    assert joined.status_code == 200, joined.text


# ─── 1. Саморегистрация привилегий закрыта ────────────────────────────────────


@pytest.mark.parametrize("role", PRIVILEGED)
def test_self_register_privileged_role_forbidden(client: TestClient, role: str) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": _email("selfreg"),
            "password": "Probe12345",
            "full_name": f"User {role}",
            "role_slug": role,
        },
    )
    assert response.status_code == 403, response.text
    assert response.headers.get("X-Error-Code") == "AUTH_PRIVILEGED_ROLE_FORBIDDEN"


def test_self_register_unprivileged_still_works(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": _email("plain"),
            "password": "Probe12345",
            "full_name": "Plain",
            "role_slug": "gk_customer",
        },
    )
    assert response.status_code == 201, response.text


# ─── 2. Назначение — только через администратора ──────────────────────────────


def test_admin_assigns_privileged_role(client: TestClient) -> None:
    admin_token, _ = _provision(client, "cntr_admin", "adm")
    target_token, target_id = _provision(client, "gk_customer", "tgt")

    updated = client.patch(
        f"/api/v1/users/{target_id}",
        json={"roles": ["auditor"]},
        headers=_auth(admin_token),
    )
    assert updated.status_code == 200, updated.text
    assert [r["slug"] for r in updated.json()["roles"]] == ["auditor"]

    me = client.get("/api/v1/auth/me", headers=_auth(target_token))
    assert me.status_code == 200  # старая сессия жива, роль подтянется при новом логине


def test_non_admin_cannot_assign_privileged_role(client: TestClient) -> None:
    _, target_id = _provision(client, "gk_customer", "tgt")
    plain_token, _ = _provision(client, "rd_executor", "plain")
    denied = client.patch(
        f"/api/v1/users/{target_id}",
        json={"roles": ["investor"]},
        headers=_auth(plain_token),
    )
    assert denied.status_code == 403, denied.text


# ─── 3. Матрица доступов к чужим КТ ───────────────────────────────────────────


def test_control_point_access_matrix(client: TestClient) -> None:
    owner_token, owner_id = _provision(client, "gk_customer", "own")
    project_id, cp_id = _create_project(client, owner_token)
    url = f"/api/v1/projects/{project_id}/control-points/{cp_id}"
    payload = {"status": "approved", "decision": "ok"}

    # Посторонний с обычной ролью (не участник) — 404, без раскрытия проекта.
    outsider_token, _ = _provision(client, "rd_executor", "out")
    r = client.patch(url, json=payload, headers=_auth(outsider_token))
    assert r.status_code == 404, r.text

    # Посторонний аудитор без назначения — 404 (роль сама не открывает проект).
    lone_auditor, _ = _provision(client, "auditor", "lone")
    r = client.patch(url, json=payload, headers=_auth(lone_auditor))
    assert r.status_code == 404, r.text

    # Участник с обычной ролью — 403 (проект видит, решать не вправе).
    member_token, _ = _provision(client, "rd_executor", "mem")
    _join(client, owner_token, project_id, member_token, "rd_executor")
    r = client.patch(url, json=payload, headers=_auth(member_token))
    assert r.status_code == 403, r.text

    # Назначенный аудитор (активный участник) — 200.
    auditor_token, _ = _provision(client, "auditor", "aud")
    _join(client, owner_token, project_id, auditor_token, "auditor")
    r = client.patch(url, json=payload, headers=_auth(auditor_token))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "approved"


def test_owner_cannot_self_decide_kt(client: TestClient) -> None:
    # Владелец с привилегированной ролью свой КТ без назначения не решает.
    admin_token, _ = _provision(client, "cntr_admin", "adm")
    owner_token, owner_id = _provision(client, "gk_customer", "own")
    client.patch(
        f"/api/v1/users/{owner_id}",
        json={"roles": ["auditor"]},
        headers=_auth(admin_token),
    )
    project_id, cp_id = _create_project(client, owner_token)
    # relogin, чтобы JWT подхватил новую роль
    me = client.get("/api/v1/auth/me", headers=_auth(owner_token))
    assert me.status_code == 200
    r = client.patch(
        f"/api/v1/projects/{project_id}/control-points/{cp_id}",
        json={"status": "approved"},
        headers=_auth(owner_token),
    )
    assert r.status_code == 403, r.text


def test_staff_can_decide_foreign_kt(client: TestClient) -> None:
    owner_token, _ = _provision(client, "gk_customer", "own")
    project_id, cp_id = _create_project(client, owner_token)
    staff_token, _ = _provision(client, "cntr_manager", "mgr")
    r = client.patch(
        f"/api/v1/projects/{project_id}/control-points/{cp_id}",
        json={"status": "approved"},
        headers=_auth(staff_token),
    )
    assert r.status_code == 200, r.text


# ─── 4. Аудит выдачи/отзыва ───────────────────────────────────────────────────


def test_audit_logs_grant_and_revoke(client: TestClient) -> None:
    admin_token, _ = _provision(client, "cntr_admin", "adm")
    _, target_id = _provision(client, "gk_customer", "tgt")

    grant = client.patch(
        f"/api/v1/users/{target_id}",
        json={"roles": ["investor"]},
        headers=_auth(admin_token),
    )
    assert grant.status_code == 200, grant.text

    audit = client.get(
        "/api/v1/admin/audit",
        params={"action": "user.role.granted"},
        headers=_auth(admin_token),
    )
    assert audit.status_code == 200, audit.text
    assert any(
        e["action"] == "user.role.granted"
        and e["details"].get("target_user_id") == target_id
        and e["details"].get("role") == "investor"
        for e in audit.json()
    ), audit.text

    revoke = client.patch(
        f"/api/v1/users/{target_id}",
        json={"roles": ["gk_customer"]},
        headers=_auth(admin_token),
    )
    assert revoke.status_code == 200, revoke.text

    audit2 = client.get(
        "/api/v1/admin/audit",
        params={"action": "user.role.revoked"},
        headers=_auth(admin_token),
    )
    assert audit2.status_code == 200, audit2.text
    assert any(
        e["action"] == "user.role.revoked"
        and e["details"].get("target_user_id") == target_id
        and e["details"].get("role") == "investor"
        for e in audit2.json()
    ), audit2.text


# ─── 5. Миграция отзыва (фикстура, rollback) ──────────────────────────────────


def _dsn() -> dict:
    return {
        "host": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        "port": int(os.environ.get("POSTGRES_PORT", "5432")),
        "user": os.environ.get("POSTGRES_USER", "technoz"),
        "password": os.environ.get("POSTGRES_PASSWORD", "change_me"),
        "dbname": os.environ.get("POSTGRES_DB", "technozrelost_test"),
    }


def test_migration_revokes_self_registered_privileges(client: TestClient) -> None:  # noqa: ARG001
    backend_root = _Path(__file__).resolve().parent.parent
    sql = (
        backend_root / "db" / "migrations" / "sql"
        / "0033_revoke_self_registered_privileges.sql"
    ).read_text(encoding="utf-8")

    conn = psycopg.connect(**_dsn())
    try:
        conn.autocommit = False
        # Комментарии SQL содержат ";" — чистим их перед наивным сплитом
        # на стейтменты (сам файл для alembic валиден целиком).
        sql = "\n".join(
            line for line in sql.splitlines()
            if not line.strip().startswith("--")
        )
        tag = uuid.uuid4().hex[:8]
        # Фикстура «как было до закрытия»: обычные пользователи с самовыданными
        # привилегиями + суперпользователь с аудитором (его не трогаем).
        users = {}
        for key, email, superuser in [
            ("aud_only", f"mig-aud-{tag}@example.com", False),
            ("inv_multi", f"mig-inv-{tag}@example.com", False),
            ("super", f"mig-sup-{tag}@example.com", True),
        ]:
            row = conn.execute(
                "INSERT INTO public.users (email, password_hash, full_name, is_superuser)"
                " VALUES (%s, %s, %s, %s) RETURNING id",
                (email, "x", f"Mig {key}", superuser),
            ).fetchone()
            users[key] = row[0]
        conn.execute(
            "INSERT INTO public.user_roles (user_id, role_id, is_primary)"
            " SELECT %s, id, TRUE FROM public.roles WHERE slug = 'auditor'",
            (users["aud_only"],),
        )
        conn.execute(
            "INSERT INTO public.user_roles (user_id, role_id, is_primary)"
            " SELECT %s, id, TRUE FROM public.roles WHERE slug = 'investor'",
            (users["inv_multi"],),
        )
        conn.execute(
            "INSERT INTO public.user_roles (user_id, role_id, is_primary)"
            " SELECT %s, id, FALSE FROM public.roles WHERE slug = 'gk_customer'",
            (users["inv_multi"],),
        )
        conn.execute(
            "INSERT INTO public.user_roles (user_id, role_id, is_primary)"
            " SELECT %s, id, TRUE FROM public.roles WHERE slug = 'auditor'",
            (users["super"],),
        )
        # Прогон миграции (в транзакции теста).
        for stmt in [s.strip() for s in sql.split(";") if s.strip()]:
            conn.execute(stmt)

        def slugs(uid: int) -> set[str]:
            return {
                r[0]
                for r in conn.execute(
                    "SELECT r.slug FROM public.user_roles ur"
                    " JOIN public.roles r ON r.id = ur.role_id"
                    " WHERE ur.user_id = %s",
                    (uid,),
                ).fetchall()
            }

        # Обычные: привилегии сняты, fallback gk_customer primary.
        assert slugs(users["aud_only"]) == {"gk_customer"}, slugs(users["aud_only"])
        assert slugs(users["inv_multi"]) == {"gk_customer"}, slugs(users["inv_multi"])
        # Суперпользователь: не тронут.
        assert slugs(users["super"]) == {"auditor"}, slugs(users["super"])
        # Аудит отзыва записан на обоих обычных.
        n = conn.execute(
            "SELECT COUNT(*) FROM public.audit_trail WHERE action = 'user.role.revoked'"
            " AND (details ->> 'target_user_id')::bigint IN (%s, %s)",
            (users["aud_only"], users["inv_multi"]),
        ).fetchone()[0]
        assert n == 2, n
        # Идемпотентность: повторный прогон того же SQL — без дублей и ошибок.
        for stmt in [s.strip() for s in sql.split(";") if s.strip()]:
            conn.execute(stmt)
        n2 = conn.execute(
            "SELECT COUNT(*) FROM public.audit_trail WHERE action = 'user.role.revoked'"
            " AND (details ->> 'target_user_id')::bigint IN (%s, %s)",
            (users["aud_only"], users["inv_multi"]),
        ).fetchone()[0]
        assert n2 == 2, n2
    finally:
        conn.rollback()
        conn.close()
