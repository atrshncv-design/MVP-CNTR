"""Таск 06: карточка проекта после устранения N+1 по верифицирующим документам.

Поведение (имена загрузивших) должно сохраниться при переходе от
по-строчного ``db.get(User)`` к пакетному запросу, а число SQL-запросов
на GET /projects/{id} не должно расти вместе с числом документов:
гард считает statement'ы через event на engine и ловит возврат N+1.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
from fastapi.testclient import TestClient
from sqlalchemy import event

from app.core.database import engine
from tests.support import register_test_user

# Верхняя граница statement'ов на один GET карточки. Замер: 11 на пакетном
# коде и не зависит от числа документов; возврат построчного db.get(User)
# добавляет запрос на КАЖДОГО uploader'а (identity map не спасает при разных
# id): 8 сидированных авторов дают 26. Бюджет 14 = база + запас на
# доброкачественные правки, но пробивается любым построчным шаблоном.
QUERY_BUDGET = 14
N_DOCS = 8


@contextmanager
def _count_statements() -> Iterator[list[str]]:
    statements: list[str] = []

    def _before_cursor_execute(
        _conn, _cursor, statement, _parameters, _context, _executemany
    ) -> None:
        statements.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", _before_cursor_execute)
    try:
        yield statements
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _before_cursor_execute)


def _create_project(client: TestClient, token: str) -> dict:
    response = client.post(
        "/api/v1/assessments",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Карточка N+1",
            "category": "it",
            "target_level": 9,
            "questionnaire_results": [
                {"level_id": 1, "checked_items": ["a"], "percentage": 100.0}
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_detail_returns_uploader_names(client: TestClient) -> None:
    owner = register_test_user(
        client, email="card.owner@example.com", full_name="Владелец Карточки",
        role_slug="gk_customer",
    )
    project = _create_project(client, owner["access_token"])
    for title in ("Подтверждение А", "Подтверждение Б"):
        doc = client.post(
            f"/api/v1/projects/{project['id']}/verification-docs",
            headers={"Authorization": f"Bearer {owner['access_token']}"},
            json={"title": title, "comment": None, "file_ref": "ref-1"},
        )
        assert doc.status_code == 201, doc.text

    detail = client.get(
        f"/api/v1/projects/{project['id']}",
        headers={"Authorization": f"Bearer {owner['access_token']}"},
    )
    assert detail.status_code == 200, detail.text
    vdocs = detail.json()["verification_documents"]
    assert [d["title"] for d in vdocs] == ["Подтверждение А", "Подтверждение Б"]
    assert all(d["uploader_name"] == "Владелец Карточки" for d in vdocs)


def test_detail_query_count_bounded(client: TestClient) -> None:
    """GET карточки не должен обрасти запросами на каждый документ (N+1).

    Гард: у каждого документа СВОЙ uploader (сидируются напрямую через
    psycopg), поэтому построчные db.get(User)/lazy-load не гасятся
    identity map'ом и каждый добавил бы отдельный SQL-запрос. Число
    statement'ов на фиксированном числе документов ограничено бюджетом,
    не зависящим от N_DOCS.
    """
    owner = register_test_user(
        client, email="card.perf@example.com", full_name="Перф Владелец",
        role_slug="gk_customer",
    )
    project = _create_project(client, owner["access_token"])
    uploaders = _seed_uploaders_with_docs(project["id"], N_DOCS)

    with _count_statements() as statements:
        detail = client.get(
            f"/api/v1/projects/{project['id']}",
            headers={"Authorization": f"Bearer {owner['access_token']}"},
        )
    assert detail.status_code == 200, detail.text
    vdocs = detail.json()["verification_documents"]
    assert len(vdocs) == N_DOCS
    assert {d["uploader_name"] for d in vdocs} == set(uploaders.values())
    assert len(statements) <= QUERY_BUDGET, (
        f"карточка выполняет {len(statements)} SQL-запросов "
        f"(бюджет {QUERY_BUDGET}) — похоже на возврат N+1"
    )


def _seed_uploaders_with_docs(project_id: int, n: int) -> dict[int, str]:
    """n пользователей-загрузчиков и по документу от каждого (напрямую в БД)."""
    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )
    try:
        uploaders: dict[int, str] = {}
        for i in range(n):
            name = f"Загрузчик {i}"
            email = f"card.uploader.{i}@example.com"
            row = conn.execute(
                """
                INSERT INTO public.users (email, password_hash, full_name)
                VALUES (%s, 'seed-only', %s)
                ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
                RETURNING id
                """,
                (email, name),
            ).fetchone()
            user_id = row[0]
            conn.execute(
                """
                INSERT INTO public.verification_documents
                    (project_id, uploader_id, title, comment, file_ref)
                VALUES (%s, %s, %s, NULL, %s)
                """,
                (project_id, user_id, f"Документ {i}", f"ref-{i}"),
            )
            uploaders[user_id] = name
        return uploaders
    finally:
        conn.close()
