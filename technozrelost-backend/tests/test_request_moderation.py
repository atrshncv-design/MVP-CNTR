"""Тикет 02 requests-matching: конфиденциальность и модерация запроса.

Покрытие: модерация staff approve/reject + причина (статус, append-only лог,
аудит tech_request.moderated, уведомление создателю; не-staff → 403); публичный
реестр (только approved+public — анонимам; approved+public/platform —
авторизованным; private отсутствует; пагинация); закрытый запрос (чужой GET →
404, не 403; в реестре отсутствует; документы не раскрываются); platform виден
авторизованным; смена режима после approved → повторная модерация (pending +
лог visibility_changed); reject — запрос возвращается на доработку (PATCH и
повторный submit разрешены, новый цикл модерации).

Решения, зафиксированные в коде (см. docstring tech_requests.py):
- reject не терминален: создатель правит запрос и повторно отправляет;
- повторное решение менеджера — только после новой отправки/смены режима (409).
"""

from __future__ import annotations

import os

import psycopg
from fastapi import Response
from fastapi.testclient import TestClient

from tests.test_tech_requests import (
    _audit_actions,
    _auth,
    _create_request,
    _create_verified_org,
    _register,
    _register_manager,
)

REASON = "Требования недостаточно детализированы для публикации"


def _moderation_log(request_id: int) -> list[dict]:
    """Прямое чтение append-only журнала модерации (нет API-эндпоинта)."""
    conn = psycopg.connect(
        host=os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        user=os.environ.get("POSTGRES_USER", "technoz"),
        password=os.environ.get("POSTGRES_PASSWORD", "change_me"),
        dbname=os.environ.get("POSTGRES_DB", "technozrelost_test"),
        autocommit=True,
    )
    try:
        rows = conn.execute(
            "SELECT action, moderator_id, reason FROM public.tech_request_moderation_log "
            "WHERE request_id = %s ORDER BY id",
            (request_id,),
        ).fetchall()
        return [
            {"action": row[0], "moderator_id": row[1], "reason": row[2]} for row in rows
        ]
    finally:
        conn.close()


def _notifications(client: TestClient, token: str) -> list[dict]:
    response = client.get("/api/v1/notifications", headers=_auth(token))
    assert response.status_code == 200, response.text
    return response.json()


def _create_submitted(
    client: TestClient, token: str, org_id: int, visibility: str | None = None
) -> dict:
    request = _create_request(client, token, org_id)
    # platform — режим по умолчанию: PATCH не нужен (no-op дал бы 422)
    if visibility is not None and visibility != "platform":
        patched = client.patch(
            f"/api/v1/tech-requests/{request['id']}",
            headers=_auth(token),
            json={"visibility": visibility},
        )
        assert patched.status_code == 200, patched.text
        request = patched.json()
    submitted = client.post(
        f"/api/v1/tech-requests/{request['id']}/submit", headers=_auth(token)
    )
    assert submitted.status_code == 200, submitted.text
    return submitted.json()


def _moderate(
    client: TestClient, manager_token: str, request_id: int, approve: bool, reason: str
) -> Response:
    return client.post(
        f"/api/v1/tech-requests/{request_id}/moderate",
        headers=_auth(manager_token),
        json={"approve": approve, "reason": reason},
    )


# ── Модерация: approve/reject ────────────────────────────────────────────────


def test_moderate_approve_sets_status_log_audit_notification(
    client: TestClient,
) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    request = _create_submitted(client, creator["access_token"], org_id, "public")
    manager = _register_manager(client)

    response = _moderate(client, manager["access_token"], request["id"], True, "Одобрено")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["moderation_status"] == "approved"
    assert data["moderated_by"] == manager["user"]["id"]
    assert data["moderated_at"] is not None
    assert data["moderation_reason"] == "Одобрено"

    log = _moderation_log(request["id"])
    assert [entry["action"] for entry in log] == ["visibility_changed", "approve"]
    assert log[-1] == {
        "action": "approve",
        "moderator_id": manager["user"]["id"],
        "reason": "Одобрено",
    }

    audit = _audit_actions(client, "tech_request.moderated")
    entry = next(
        e for e in audit if e["details"].get("request_id") == request["id"]
    )
    assert entry["details"]["decision"] == "approved"
    assert entry["details"]["reason"] == "Одобрено"

    inbox = _notifications(client, creator["access_token"])
    note = next(n for n in inbox if n["type"] == "tech_request.moderated")
    assert note["payload"]["decision"] == "approved"
    assert note["payload"]["request_id"] == request["id"]
    assert "одобрен" in note["title"].lower()


def test_moderate_reject_sets_status_and_reason_visible_to_creator(
    client: TestClient,
) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    request = _create_submitted(client, creator["access_token"], org_id, "public")
    manager = _register_manager(client)

    response = _moderate(client, manager["access_token"], request["id"], False, REASON)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["moderation_status"] == "rejected"
    assert data["moderation_reason"] == REASON

    log = _moderation_log(request["id"])
    assert log[-1]["action"] == "reject"
    assert log[-1]["reason"] == REASON

    # Создатель видит причину отклонения в деталях запроса
    detail = client.get(
        f"/api/v1/tech-requests/{request['id']}", headers=_auth(creator["access_token"])
    )
    assert detail.status_code == 200, detail.text
    assert detail.json()["moderation_status"] == "rejected"
    assert detail.json()["moderation_reason"] == REASON

    audit = _audit_actions(client, "tech_request.moderated")
    entry = next(
        e for e in audit if e["details"].get("request_id") == request["id"]
    )
    assert entry["details"]["decision"] == "rejected"

    inbox = _notifications(client, creator["access_token"])
    note = next(n for n in inbox if n["type"] == "tech_request.moderated")
    assert note["payload"]["decision"] == "rejected"
    assert note["payload"]["reason"] == REASON
    assert "отклонён" in note["title"].lower()


def test_moderate_forbidden_for_non_staff(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    request = _create_submitted(client, creator["access_token"], org_id)

    response = _moderate(client, creator["access_token"], request["id"], True, "Ок")
    assert response.status_code == 403, response.text


def test_moderate_requires_submitted_request(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    request = _create_request(client, creator["access_token"], org_id)  # draft
    manager = _register_manager(client)

    response = _moderate(client, manager["access_token"], request["id"], True, "Ок")
    assert response.status_code == 409, response.text


def test_moderate_twice_conflicts_until_remoderation(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    request = _create_submitted(client, creator["access_token"], org_id)
    manager = _register_manager(client)

    first = _moderate(client, manager["access_token"], request["id"], True, "Ок")
    assert first.status_code == 200, first.text

    # Повторный approve напрямую — 409 (решение уже принято)
    second = _moderate(client, manager["access_token"], request["id"], True, "Опять")
    assert second.status_code == 409, second.text
    # Reject после approve — тоже 409: только через повторную модерацию
    reject = _moderate(client, manager["access_token"], request["id"], False, "Нет")
    assert reject.status_code == 409, reject.text

    assert len(_moderation_log(request["id"])) == 1  # append-only: одно решение


def test_moderate_requires_reason(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    request = _create_submitted(client, creator["access_token"], org_id)
    manager = _register_manager(client)

    response = _moderate(client, manager["access_token"], request["id"], True, "   ")
    assert response.status_code == 422, response.text


# ── Публичный реестр ─────────────────────────────────────────────────────────


def _registry(client: TestClient, token: str | None = None, **params: object) -> dict:
    headers = _auth(token) if token else None
    response = client.get("/api/v1/tech-requests/public", headers=headers, params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_public_registry_only_approved_public(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    public_approved = _create_submitted(client, creator["access_token"], org_id, "public")
    _moderate(
        client,
        _register_manager(client)["access_token"],
        public_approved["id"],
        True,
        "Ок",
    )
    _create_submitted(client, creator["access_token"], org_id, "platform")
    _create_submitted(client, creator["access_token"], org_id, "private")
    _create_submitted(client, creator["access_token"], org_id, "public")  # pending

    # Аноним: только approved + public
    anonymous = _registry(client)
    assert [item["id"] for item in anonymous["items"]] == [public_approved["id"]]
    assert anonymous["total"] == 1
    item = anonymous["items"][0]
    assert item["title"] == public_approved["title"]
    assert item["deadline"] and item["budget"] is not None
    assert "created_by" not in item and "documents" not in item

    # Авторизованный: approved + public/platform
    authorized = _registry(client, creator["access_token"])
    ids = {item["id"] for item in authorized["items"]}
    assert public_approved["id"] in ids
    assert authorized["total"] == 1  # platform-запрос не одобрен менеджером


def test_platform_approved_visible_to_authorized_registry(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    platform_approved = _create_submitted(
        client, creator["access_token"], org_id, "platform"
    )
    manager = _register_manager(client)
    decided = _moderate(
        client, manager["access_token"], platform_approved["id"], True, "Ок"
    )
    assert decided.status_code == 200, decided.text

    anonymous = _registry(client)
    assert platform_approved["id"] not in {
        item["id"] for item in anonymous["items"]
    }

    outsider = _register(client)
    authorized = _registry(client, outsider["access_token"])
    assert platform_approved["id"] in {item["id"] for item in authorized["items"]}


def test_public_registry_pagination(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    manager = _register_manager(client)
    created: list[int] = []
    for index in range(3):
        request = _create_submitted(client, creator["access_token"], org_id, "public")
        created.append(request["id"])
        decided = _moderate(
            client, manager["access_token"], request["id"], True, f"Ок {index}"
        )
        assert decided.status_code == 200, decided.text

    page1 = _registry(client, limit=2)
    assert len(page1["items"]) == 2
    assert page1["total"] == 3
    assert page1["limit"] == 2 and page1["offset"] == 0

    page2 = _registry(client, limit=2, offset=2)
    assert len(page2["items"]) == 1
    assert page2["total"] == 3
    assert {item["id"] for item in page1["items"]} | {
        item["id"] for item in page2["items"]
    } == set(created)


# ── Закрытый запрос не раскрывается ─────────────────────────────────────────


def test_private_request_hidden_404_not_403(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    private_approved = _create_submitted(client, creator["access_token"], org_id, "private")
    manager = _register_manager(client)
    decided = _moderate(
        client, manager["access_token"], private_approved["id"], True, "Ок"
    )
    assert decided.status_code == 200, decided.text

    outsider = _register(client)

    for headers in (None, _auth(outsider["access_token"])):
        response = client.get(
            f"/api/v1/tech-requests/{private_approved['id']}", headers=headers
        )
        assert response.status_code == 404, response.text

    # В реестре отсутствует даже для авторизованных
    registry = _registry(client, outsider["access_token"])
    assert private_approved["id"] not in {
        item["id"] for item in registry["items"]
    }

    # Создатель и Центр видят
    owner_get = client.get(
        f"/api/v1/tech-requests/{private_approved['id']}",
        headers=_auth(creator["access_token"]),
    )
    assert owner_get.status_code == 200, owner_get.text
    staff_get = client.get(
        f"/api/v1/tech-requests/{private_approved['id']}",
        headers=_auth(manager["access_token"]),
    )
    assert staff_get.status_code == 200, staff_get.text


def test_private_request_documents_not_exposed(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    draft = _create_request(client, creator["access_token"], org_id)
    uploaded = client.post(
        f"/api/v1/tech-requests/{draft['id']}/documents",
        headers=_auth(creator["access_token"]),
        data={"title": "ТЗ"},
        files={"file": ("tz.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")},
    )
    assert uploaded.status_code == 201, uploaded.text

    # Тот же запрос: private → submit → approved
    private_set = client.patch(
        f"/api/v1/tech-requests/{draft['id']}",
        headers=_auth(creator["access_token"]),
        json={"visibility": "private"},
    )
    assert private_set.status_code == 200, private_set.text
    submitted = client.post(
        f"/api/v1/tech-requests/{draft['id']}/submit",
        headers=_auth(creator["access_token"]),
    )
    assert submitted.status_code == 200, submitted.text
    manager = _register_manager(client)
    decided = _moderate(client, manager["access_token"], draft["id"], True, "Ок")
    assert decided.status_code == 200, decided.text
    assert decided.json()["visibility"] == "private"

    # Посторонний не видит ни запрос, ни его вложения (404, не 403)
    outsider = _register(client)
    response = client.get(
        f"/api/v1/tech-requests/{draft['id']}", headers=_auth(outsider["access_token"])
    )
    assert response.status_code == 404, response.text
    assert "documents" not in response.text  # детали не раскрываются вовсе


def test_pending_request_hidden_from_outsiders(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    pending = _create_submitted(client, creator["access_token"], org_id, "public")
    outsider = _register(client)

    response = client.get(
        f"/api/v1/tech-requests/{pending['id']}", headers=_auth(outsider["access_token"])
    )
    assert response.status_code == 404, response.text

    registry = _registry(client, outsider["access_token"])
    assert pending["id"] not in {item["id"] for item in registry["items"]}


# ── Platform: авторизованным ─────────────────────────────────────────────────


def test_platform_request_visible_to_authorized_detail(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    platform_approved = _create_submitted(
        client, creator["access_token"], org_id, "platform"
    )
    manager = _register_manager(client)
    decided = _moderate(
        client, manager["access_token"], platform_approved["id"], True, "Ок"
    )
    assert decided.status_code == 200, decided.text

    anonymous = client.get(f"/api/v1/tech-requests/{platform_approved['id']}")
    assert anonymous.status_code == 404, anonymous.text

    outsider = _register(client)
    authorized = client.get(
        f"/api/v1/tech-requests/{platform_approved['id']}",
        headers=_auth(outsider["access_token"]),
    )
    assert authorized.status_code == 200, authorized.text
    assert authorized.json()["visibility"] == "platform"


# ── Смена режима → повторная модерация ───────────────────────────────────────


def test_visibility_change_after_approve_remoderates(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    request = _create_submitted(client, creator["access_token"], org_id, "public")
    manager = _register_manager(client)
    decided = _moderate(client, manager["access_token"], request["id"], True, "Ок")
    assert decided.status_code == 200, decided.text
    assert decided.json()["moderation_status"] == "approved"

    changed = client.patch(
        f"/api/v1/tech-requests/{request['id']}",
        headers=_auth(creator["access_token"]),
        json={"visibility": "private"},
    )
    assert changed.status_code == 200, changed.text
    data = changed.json()
    assert data["visibility"] == "private"
    assert data["moderation_status"] == "pending"
    assert data["moderated_by"] is None
    assert data["moderated_at"] is None

    # Лог + аудит смены режима
    log = _moderation_log(request["id"])
    assert [entry["action"] for entry in log] == [
        "visibility_changed",
        "approve",
        "visibility_changed",
    ]
    audit = _audit_actions(client, "tech_request.visibility_changed")
    entry = next(
        e for e in audit if e["details"].get("request_id") == request["id"]
    )
    assert entry["details"]["from"] == "public"
    assert entry["details"]["to"] == "private"

    # После смены режима запрос исчез из реестра
    registry = _registry(client, creator["access_token"])
    assert request["id"] not in {item["id"] for item in registry["items"]}

    # Повторная модерация возможна и завершается решением
    redecided = _moderate(client, manager["access_token"], request["id"], True, "Ок 2")
    assert redecided.status_code == 200, redecided.text
    assert redecided.json()["moderation_status"] == "approved"
    log_after = _moderation_log(request["id"])
    assert [entry["action"] for entry in log_after] == [
        "visibility_changed",
        "approve",
        "visibility_changed",
        "approve",
    ]


def test_patch_after_submit_only_visibility_allowed(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    request = _create_submitted(client, creator["access_token"], org_id)
    manager = _register_manager(client)

    # submitted + pending: контентные поля закрыты, visibility можно менять
    content = client.patch(
        f"/api/v1/tech-requests/{request['id']}",
        headers=_auth(creator["access_token"]),
        json={"title": "Поздняя правка"},
    )
    assert content.status_code == 409, content.text
    visibility = client.patch(
        f"/api/v1/tech-requests/{request['id']}",
        headers=_auth(creator["access_token"]),
        json={"visibility": "public"},
    )
    assert visibility.status_code == 200, visibility.text
    assert visibility.json()["moderation_status"] == "pending"  # уже pending

    decided = _moderate(client, manager["access_token"], request["id"], True, "Ок")
    assert decided.status_code == 200, decided.text
    assert decided.json()["moderation_status"] == "approved"

    # approved: контентные поля 409, смена режима → повторная модерация
    content2 = client.patch(
        f"/api/v1/tech-requests/{request['id']}",
        headers=_auth(creator["access_token"]),
        json={"demand": "больше"},
    )
    assert content2.status_code == 409, content2.text
    visibility2 = client.patch(
        f"/api/v1/tech-requests/{request['id']}",
        headers=_auth(creator["access_token"]),
        json={"visibility": "platform"},
    )
    assert visibility2.status_code == 200, visibility2.text
    assert visibility2.json()["moderation_status"] == "pending"


# ── Reject: доработка и повторная отправка ───────────────────────────────────


def test_rejected_request_editable_and_resubmittable(client: TestClient) -> None:
    creator = _register(client)
    org_id = _create_verified_org(client, creator["access_token"])
    request = _create_submitted(client, creator["access_token"], org_id, "public")
    manager = _register_manager(client)
    rejected = _moderate(client, manager["access_token"], request["id"], False, REASON)
    assert rejected.status_code == 200, rejected.text

    # Создатель дорабатывает запрос после reject
    patched = client.patch(
        f"/api/v1/tech-requests/{request['id']}",
        headers=_auth(creator["access_token"]),
        json={"requirements": "Уточнённые требования после замечаний Центра"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["moderation_status"] == "rejected"  # решение сохранено

    # Повторная отправка → новый цикл модерации (pending)
    resubmitted = client.post(
        f"/api/v1/tech-requests/{request['id']}/submit",
        headers=_auth(creator["access_token"]),
    )
    assert resubmitted.status_code == 200, resubmitted.text
    assert resubmitted.json()["status"] == "submitted"
    assert resubmitted.json()["moderation_status"] == "pending"
    assert resubmitted.json()["moderated_by"] is None

    # Менеджер снова принимает решение
    approved = _moderate(
        client, manager["access_token"], request["id"], True, "После доработки — ок"
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["moderation_status"] == "approved"

    log = _moderation_log(request["id"])
    assert [entry["action"] for entry in log] == [
        "visibility_changed",
        "reject",
        "approve",
    ]
