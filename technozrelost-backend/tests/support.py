"""Test-only account provisioning helpers.

Privileged roles (R04i, task 03) are not self-registerable. Tests provision
those roles through the database, mirroring an administrator assigning the
role via PATCH /users/{id}. Unprivileged roles register over HTTP as usual.
"""

from __future__ import annotations

import os

import psycopg
from fastapi.testclient import TestClient

CNTR_STAFF_SLUGS = {"cntr_admin", "cntr_manager"}
# R04i (таск 03): привилегии выдаёт только администратор — в тестах их
# назначаем через БД (зеркало PATCH /users/{id}), а не через /auth/register.
ADMIN_ASSIGNED_SLUGS = {
    "cntr_admin",
    "cntr_manager",
    "auditor",
    "regulating_organization",
    "ugt_expert",
    "investor",
}
PASSWORD = "Probe12345"


def register_test_user(
    client: TestClient,
    *,
    email: str,
    full_name: str,
    role_slug: str,
    organization: str | None = None,
) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
            "full_name": full_name,
            "organization": organization,
            "role_slug": "gk_customer" if role_slug in ADMIN_ASSIGNED_SLUGS else role_slug,
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()

    if role_slug not in ADMIN_ASSIGNED_SLUGS:
        return data

    _assign_role(data["user"]["id"], role_slug)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    assert login.status_code == 200, login.text
    return login.json()


def priority_share_sig(client: TestClient, token: str, project_id: int) -> str:
    """Серверная подпись атрибуции ссылки (N-01): легитимная замена shared_by из тела.

    Симулирует шаг «приоритетный участник получил ссылку у сервера» перед
    вступлением по ней другого пользователя.
    """
    response = client.get(
        f"/api/v1/projects/{project_id}/share-sig",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text
    return response.json()["share_sig"]


def _assign_role(user_id: int, role_slug: str) -> None:
    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )
    try:
        # Зеркало администратора: снять всё выданное при регистрации и выдать
        # назначенную роль как primary (как PATCH /users/{id} с одной ролью).
        conn.execute("DELETE FROM public.user_roles WHERE user_id = %s", (user_id,))
        conn.execute(
            """
            INSERT INTO public.user_roles (user_id, role_id, is_primary)
            SELECT %s, id, TRUE FROM public.roles WHERE slug = %s
            """,
            (user_id, role_slug),
        )
    finally:
        conn.close()


_assign_staff_role = _assign_role  # backward-compat alias
