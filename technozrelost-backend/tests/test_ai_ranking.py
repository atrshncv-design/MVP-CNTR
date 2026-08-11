"""Тикет 05 requests-matching: AI-ранжирование кандидатов beta.

Покрытие: маска промпта (внешней модели уходят только разрешённые/
обезличенные поля — без email/контактов/budget/demand, в т.ч. для private
запроса); отказ AI (None/исключение) → базовая выдача intact (ai_ranked=false);
AI не пишет в БД (статусы/решения/аудит не тронуты); beta/requires_review
маркеры; порядок AI поверх base; RBAC (не-участник 404, LLM не вызывается).
Live-LLM недоступен (нет ключа) — все тесты на test-double (FakeLLM).
"""

from __future__ import annotations

import json
from collections.abc import Iterator

import psycopg
import pytest
from fastapi.testclient import TestClient

from tests.test_tech_requests import (
    _auth,
    _create_request,
    _register,
    _register_manager,
)

# ─── Test-double LLM (фиксирует payload, как в ai-rag/02) ───────────────────


class FakeLLM:
    """Test-double LLM-клиента: записывает (system_prompt, user_message)."""

    def __init__(self, reply: str | None = None, *, raise_exc: bool = False) -> None:
        self.reply = reply
        self.raise_exc = raise_exc
        self.calls: list[tuple[str, str]] = []

    async def complete(self, system_prompt: str, user_message: str) -> str | None:
        self.calls.append((system_prompt, user_message))
        if self.raise_exc:
            raise RuntimeError("LLM timeout")
        return self.reply


@pytest.fixture()
def fake_llm() -> Iterator[FakeLLM]:
    from app.main import app
    from app.services.ai_ranking import get_ai_ranking_llm_client

    fake = FakeLLM()
    app.dependency_overrides[get_ai_ranking_llm_client] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_ai_ranking_llm_client, None)


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _register_executor(client: TestClient) -> dict:
    return _register(client, role="rd_executor")


def _create_verified_org(
    client: TestClient, token: str, *, org_type: str | None = None
) -> int:
    """Организация: создание (опционально org_type/region) → submit → verify."""
    payload: dict[str, object] = {"name": "ООО ТехноЗаказчик"}
    if org_type:
        payload["org_type"] = org_type
        payload["region"] = "Москва"
    response = client.post("/api/v1/orgs", headers=_auth(token), json=payload)
    assert response.status_code == 201, response.text
    org_id = response.json()["id"]
    submitted = client.post(f"/api/v1/orgs/{org_id}/submit", headers=_auth(token))
    assert submitted.status_code == 200, submitted.text
    manager = _register_manager(client)
    decided = client.post(
        f"/api/v1/manager/orgs/{org_id}/decide",
        headers=_auth(manager["access_token"]),
        json={"action": "verify", "comment": "ОК"},
    )
    assert decided.status_code == 200, decided.text
    assert decided.json()["state"] == "verified"
    return org_id


def _submit(client: TestClient, token: str, request_id: int) -> None:
    resp = client.post(
        f"/api/v1/tech-requests/{request_id}/submit", headers=_auth(token)
    )
    assert resp.status_code == 200, resp.text


def _set_candidate_profile(client: TestClient, token: str) -> None:
    """Профиль исполнителя: headline/region/skills (PATCH /profile, state=draft)."""
    resp = client.patch(
        "/api/v1/profile",
        headers=_auth(token),
        json={
            "headline": "Ведущий инженер",
            "region": "Москва",
            "skills": ["ML", "композитные материалы"],
        },
    )
    assert resp.status_code == 200, resp.text


def _owner_with_ugt(client: TestClient, token: str) -> None:
    """Проект владельца с current_level=2 (для target_ugt запроса)."""
    resp = client.post(
        "/api/v1/projects",
        headers=_auth(token),
        json={
            "name": "Проект заказчика",
            "questionnaire_results": [
                {"level_id": 1, "percentage": 85.0, "checked_items": ["a"]},
                {"level_id": 2, "percentage": 75.0, "checked_items": ["b"]},
            ],
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["current_level"] == 2


def _setup(
    client: TestClient,
    *,
    private: bool = False,
    n_executors: int = 1,
) -> tuple[dict, list[dict], int]:
    """Заказчик + исполнители + verified-орг + запрос (опц. private) + submit."""
    owner = _register(client)
    _owner_with_ugt(client, owner["access_token"])
    executors = [_register_executor(client) for _ in range(n_executors)]
    for executor in executors:
        _set_candidate_profile(client, executor["access_token"])
    org_id = _create_verified_org(client, owner["access_token"], org_type="it")
    request = _create_request(client, owner["access_token"], org_id)
    request_id = int(request["id"])
    if private:
        patched = client.patch(
            f"/api/v1/tech-requests/{request_id}",
            headers=_auth(owner["access_token"]),
            json={"visibility": "private"},
        )
        assert patched.status_code == 200, patched.text
        assert patched.json()["visibility"] == "private"
    _submit(client, owner["access_token"], request_id)
    return owner, executors, request_id


def _db() -> psycopg.Connection:
    return psycopg.connect(
        host="127.0.0.1",
        port=5432,
        user="technoz",
        password="change_me",
        dbname="technozrelost_test",
        autocommit=True,
    )


def _ai_reply(executor_ids: list[int]) -> str:
    ranked = [
        {"candidate_id": cid, "score": 100.0 - i * 10, "rationale": "Сильное совпадение профиля"}
        for i, cid in enumerate(executor_ids)
    ]
    return json.dumps(ranked, ensure_ascii=False)


# ─── Unit: маска промпта и отказоустойчивость rank_with_ai ──────────────────


def test_build_ai_prompt_mask_excludes_pii_and_closed_fields() -> None:
    from app.services.ai_ranking import build_ai_prompt
    from app.services.matcher import CandidateProfile, RequestFeatures

    request = RequestFeatures(category="it", target_ugt=5, region="Москва")
    candidate = CandidateProfile(
        user_id=42,
        full_name="Иван Петров",
        roles=("rd_executor",),
        headline="Секретный заголовок",
        region="Москва",
        competencies=frozenset({"ML", "CV"}),
        categories=frozenset({"it"}),
        ugt_levels=(5,),
        project_count=3,
        organization_name="ООО Секрет",
        organization_type="it",
    )
    _, user_message = build_ai_prompt(
        [candidate],
        request,
        request_title="Нужен исполнитель",
        requirements="НИОКР, бюджет не важен",
    )
    payload = json.loads(user_message)
    cand_mask = payload["candidates"][0]
    # Только разрешённые поля кандидата (без PII/контактов).
    assert set(cand_mask) == {
        "id",
        "categories",
        "ugt_levels",
        "competencies",
        "region",
        "project_count",
        "participant_types",
    }
    assert cand_mask["id"] == 42
    # Запрос — без закрытых полей (budget/demand) и лишних данных.
    assert set(payload["request"]) == {
        "title",
        "requirements",
        "category",
        "target_ugt",
        "region",
    }
    # Никаких PII-маркеров в промпте.
    assert "full_name" not in user_message
    assert "headline" not in user_message
    assert "organization_name" not in user_message
    assert "email" not in user_message
    assert "budget" not in user_message
    assert "demand" not in user_message
    assert "@" not in user_message


def test_rank_with_ai_none_on_refusal_or_invalid_response() -> None:
    import asyncio

    from app.services.ai_ranking import rank_with_ai
    from app.services.matcher import CandidateProfile, RequestFeatures

    candidate = CandidateProfile(
        user_id=7,
        full_name="Исполнитель",
        roles=("rd_executor",),
        categories=frozenset({"it"}),
        ugt_levels=(5,),
    )
    request = RequestFeatures(category="it", target_ugt=5)

    # None-ответ провайдера (нет ключа/timeout) → None.
    assert (
        asyncio.run(rank_with_ai([candidate], request, FakeLLM(reply=None)))
        is None
    )
    # Невалидный JSON → None.
    assert (
        asyncio.run(rank_with_ai([candidate], request, FakeLLM(reply="не json")))
        is None
    )
    # JSON не-список → None.
    assert (
        asyncio.run(
            rank_with_ai([candidate], request, FakeLLM(reply='{"candidate_id": 7}'))
        )
        is None
    )
    # Исключение провайдера → None (не пробрасывается).
    assert (
        asyncio.run(
            rank_with_ai([candidate], request, FakeLLM(reply="[]", raise_exc=True))
        )
        is None
    )
    # Валидный ответ → результат с порядком.
    result = asyncio.run(
        rank_with_ai(
            [candidate],
            request,
            FakeLLM(reply='[{"candidate_id": 7, "score": 91.0, "rationale": "ОК"}]'),
        )
    )
    assert result is not None
    assert [r.candidate_id for r in result.ranked] == [7]
    assert result.ranked[0].score == 91.0


# ─── API: маска промпта на private-запросе ───────────────────────────────────


def test_ai_prompt_mask_on_private_request(
    client: TestClient, fake_llm: FakeLLM
) -> None:
    owner, executors, request_id = _setup(client, private=True)
    executor_id = executors[0]["user"]["id"]
    fake_llm.reply = _ai_reply([executor_id])

    resp = client.get(
        f"/api/v1/tech-requests/{request_id}/candidates?ai=1",
        headers=_auth(owner["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    assert len(fake_llm.calls) == 1

    system_prompt, user_message = fake_llm.calls[0]
    assert "ранжировани" in system_prompt
    payload = json.loads(user_message)
    assert payload["request"]["title"]
    # Маска: закрытые поля запроса и PII не уходят в промпт (даже для private).
    assert "budget" not in user_message
    assert "demand" not in user_message
    assert "email" not in user_message
    assert "full_name" not in user_message
    assert "headline" not in user_message
    assert "@" not in user_message
    # Разрешённые поля присутствуют.
    assert payload["candidates"][0]["id"] == executor_id
    assert payload["candidates"][0]["categories"] == []
    assert payload["candidates"][0]["region"] == "Москва"
    assert "ML" in payload["candidates"][0]["competencies"]


# ─── API: порядок AI + beta/requires_review ──────────────────────────────────


def test_ai_ranking_order_and_beta_markers(
    client: TestClient, fake_llm: FakeLLM
) -> None:
    owner, executors, request_id = _setup(client, n_executors=2)
    first_id = executors[0]["user"]["id"]
    second_id = executors[1]["user"]["id"]
    # AI ставит второго кандидата первым (отличается от базового порядка).
    fake_llm.reply = _ai_reply([second_id, first_id])

    plain = client.get(
        f"/api/v1/tech-requests/{request_id}/candidates",
        headers=_auth(owner["access_token"]),
    )
    assert plain.status_code == 200, plain.text

    resp = client.get(
        f"/api/v1/tech-requests/{request_id}/candidates?ai=1",
        headers=_auth(owner["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    # base — базовая выдача matcher'а (та же, что без ai).
    assert body["base"] == plain.json()
    # AI — только порядок candidate_id с баллами-объяснением (beta).
    assert body["ai_ranked"] is True
    assert body["beta"] is True
    assert body["requires_review"] is True
    assert [r["candidate_id"] for r in body["ai"]["ranked"]] == [second_id, first_id]
    assert all("rationale" in r and "score" in r for r in body["ai"]["ranked"])
    # AI-порядок не раскрывает данные кандидатов (только id).
    assert all(set(r) == {"candidate_id", "score", "rationale"} for r in body["ai"]["ranked"])


# ─── API: отказ AI → базовая выдача intact ───────────────────────────────────


def test_ai_refusal_keeps_base_intact(client: TestClient, fake_llm: FakeLLM) -> None:
    owner, executors, request_id = _setup(client)
    fake_llm.reply = None  # провайдер недоступен (нет ключа)

    plain = client.get(
        f"/api/v1/tech-requests/{request_id}/candidates",
        headers=_auth(owner["access_token"]),
    )
    assert plain.status_code == 200, plain.text
    # Без ?ai=1 LLM вообще не вызывается.
    assert fake_llm.calls == []

    resp = client.get(
        f"/api/v1/tech-requests/{request_id}/candidates?ai=1",
        headers=_auth(owner["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # Базовая выдача intact.
    assert body["base"] == plain.json()
    assert body["ai"] is None
    assert body["ai_ranked"] is False
    assert body["beta"] is True
    assert body["requires_review"] is True
    assert body["note"] == "AI недоступен — базовая выдача"


def test_ai_exception_keeps_base_intact(client: TestClient, fake_llm: FakeLLM) -> None:
    owner, _, request_id = _setup(client)
    fake_llm.raise_exc = True  # провайдер упал (timeout/500)

    plain = client.get(
        f"/api/v1/tech-requests/{request_id}/candidates",
        headers=_auth(owner["access_token"]),
    ).json()

    resp = client.get(
        f"/api/v1/tech-requests/{request_id}/candidates?ai=1",
        headers=_auth(owner["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["base"] == plain
    assert body["ai"] is None
    assert body["ai_ranked"] is False
    assert "AI недоступен" in body["note"]


# ─── API: AI не пишет в БД ───────────────────────────────────────────────────


def test_ai_does_not_write_db(client: TestClient, fake_llm: FakeLLM) -> None:
    owner, executors, request_id = _setup(client)
    fake_llm.reply = _ai_reply([executors[0]["user"]["id"]])

    def _state() -> dict[str, object]:
        with _db() as conn:
            rows = conn.execute(
                """
                SELECT
                  (SELECT count(*) FROM public.audit_trail),
                  (SELECT count(*) FROM public.tech_request_candidate_decisions),
                  (SELECT count(*) FROM public.tech_request_offers),
                  (SELECT count(*) FROM public.tech_request_disclosures),
                  (SELECT count(*) FROM public.tech_request_projects)
                """
            ).fetchone()
            req = conn.execute(
                "SELECT status, version, moderation_status FROM public.tech_requests WHERE id = %s",
                (request_id,),
            ).fetchone()
        return {"counts": rows, "request": req}

    before = _state()
    resp = client.get(
        f"/api/v1/tech-requests/{request_id}/candidates?ai=1",
        headers=_auth(owner["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["ai_ranked"] is True
    after = _state()

    # Ничего не записано: аудит, решения, офферы, раскрытия, проекты — без изменений.
    assert after["counts"] == before["counts"]
    # Статусы/версия/модерация запроса не тронуты.
    assert after["request"] == before["request"]


# ─── API: RBAC ───────────────────────────────────────────────────────────────


def test_ai_candidates_rbac_stranger_404(
    client: TestClient, fake_llm: FakeLLM
) -> None:
    owner, _, request_id = _setup(client)
    stranger = _register(client)

    resp = client.get(
        f"/api/v1/tech-requests/{request_id}/candidates?ai=1",
        headers=_auth(stranger["access_token"]),
    )
    assert resp.status_code == 404, resp.text
    # LLM не вызывается для не-участника.
    assert fake_llm.calls == []
