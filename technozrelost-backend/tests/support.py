"""Test-only account provisioning helpers.

Central staff roles are not self-registerable. Tests provision those roles
through the database, mirroring an administrator assigning the role.
"""

from __future__ import annotations

import os

import psycopg
from fastapi.testclient import TestClient

CNTR_STAFF_SLUGS = {"cntr_admin", "cntr_manager"}
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
            "role_slug": "gk_customer" if role_slug in CNTR_STAFF_SLUGS else role_slug,
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()

    if role_slug not in CNTR_STAFF_SLUGS:
        return data

    _assign_staff_role(data["user"]["id"], role_slug)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
    )
    assert login.status_code == 200, login.text
    return login.json()


def _assign_staff_role(user_id: int, role_slug: str) -> None:
    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )
    try:
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
