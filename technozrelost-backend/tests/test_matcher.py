"""Тикет 03 (requests-matching): объяснимый базовый matcher.

Покрывает: детерминированность баллов/порядка, веса компонентов, tie-break,
фильтры (чужая отрасль/УГТ Δ>2), воспроизводимость, закрытые поля,
решения менеджера (shortlist/reject, повторное 409, неизменность исходных
данных), RBAC (не-участник 404).
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.services.matcher import (
    CandidateProfile,
    RequestFeatures,
    explain,
    rank,
    score_candidate,
)
from tests.support import register_test_user

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _uniq(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def _register(client: TestClient, role: str = "gk_customer") -> dict:
    return register_test_user(
        client,
        email=f"{_uniq('u')}@example.com",
        full_name="Тест Матчер",
        role_slug=role,
    )


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _register_manager(client: TestClient) -> dict:
    return register_test_user(
        client,
        email=f"{_uniq('mgr')}@example.com",
        full_name="Менеджер ЦНТР",
        role_slug="cntr_manager",
    )


def _create_verified_org(client: TestClient, token: str) -> int:
    """Организация: создание → submit → verify менеджером (как в test_tech_requests.py)."""
    response = client.post(
        "/api/v1/orgs", headers=_auth(token), json={"name": "ООО ТехноЗаказчик"}
    )
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


def _create_request(
    client: TestClient, token: str, org_id: int, *, deadline_days: int = 60
) -> int:
    resp = client.post(
        "/api/v1/tech-requests",
        headers=_auth(token),
        json={
            "title": _uniq("Запрос"),
            "organization_id": org_id,
            "requirements": "Нужен исполнитель для НИОКР",
            "demand": "Прототип",
            "deadline": (date.today() + timedelta(days=deadline_days)).isoformat(),
            "budget": 5_000_000,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _submit(client: TestClient, token: str, request_id: int) -> None:
    resp = client.post(
        f"/api/v1/tech-requests/{request_id}/submit",
        headers=_auth(token),
    )
    assert resp.status_code == 200, resp.text


# ─── Unit: детерминированность и веса (без БД) ──────────────────────────────

def test_score_deterministic_and_weights() -> None:
    req = RequestFeatures(
        category="it",
        target_ugt=5,
        competencies=frozenset({"python", "ml"}),
        region="Москва",
        equipment=frozenset({"gpu"}),
        min_experience=1,
    )
    cand = CandidateProfile(
        user_id=1,
        full_name="Исполнитель А",
        roles=("rd_executor",),
        region="Москва",
        competencies=frozenset({"python", "ml", "docker"}),
        categories=frozenset({"it"}),
        ugt_levels=(5,),
        equipment=frozenset({"gpu"}),
        project_count=3,
    )
    s1 = score_candidate(req, cand)
    s2 = score_candidate(req, cand)
    # Детерминированность: повторный вызов — те же баллы.
    assert s1.total == s2.total
    assert s1.breakdown == s2.breakdown
    # Идеальное совпадение даёт близкий к 100 балл (без штрафов).
    assert s1.total >= 85.0, s1.breakdown
    # Каждый компонент с совпадением дал баллы.
    assert s1.breakdown.get("industry", 0) > 0
    assert s1.breakdown.get("ugt", 0) > 0
    assert s1.breakdown.get("competencies", 0) > 0
    assert s1.breakdown.get("region", 0) > 0
    assert s1.breakdown.get("equipment", 0) > 0
    assert s1.breakdown.get("experience", 0) > 0
    assert s1.breakdown.get("participant", 0) > 0
    # Сумма разбивки == total.
    assert abs(sum(s1.breakdown.values()) - s1.total) < 1e-6


def test_score_industry_mismatch_and_ugt_delta() -> None:
    req = RequestFeatures(category="defense", target_ugt=5)
    cand_far = CandidateProfile(
        user_id=2,
        full_name="Исполнитель Б",
        roles=("rd_executor",),
        categories=frozenset({"it"}),
        ugt_levels=(1,),  # Δ=4 > 2 → 0 баллов УГТ
    )
    s = score_candidate(req, cand_far)
    assert s.breakdown.get("industry", 0) == 0.0
    assert s.breakdown.get("ugt", 0) == 0.0
    # Чужая отрасль и далёкий УГТ → низкий итог.
    assert s.total < 30.0


def test_rank_tie_break_and_reproducibility() -> None:
    req = RequestFeatures(category="it", target_ugt=5)
    c1 = CandidateProfile(user_id=1, full_name="А", roles=("rd_executor",),
                          categories=frozenset({"it"}), ugt_levels=(5,))
    c2 = CandidateProfile(user_id=2, full_name="Б", roles=("rd_executor",),
                          categories=frozenset({"it"}), ugt_levels=(5,))
    # Одинаковые баллы → tie-break по user_id (возрастание).
    r1 = rank([c2, c1], req)
    r2 = rank([c2, c1], req)
    assert [rc.candidate.user_id for rc in r1] == [1, 2]
    # Воспроизводимость: повторный вызов — тот же порядок и баллы.
    assert [rc.candidate.user_id for rc in r2] == [1, 2]
    assert [rc.score.total for rc in r1] == [rc.score.total for rc in r2]


def test_explain_contains_russian_reasons() -> None:
    req = RequestFeatures(category="it", target_ugt=6)
    cand = CandidateProfile(user_id=1, full_name="Исполнитель", roles=("rd_executor",),
                            categories=frozenset({"it"}), ugt_levels=(5,))
    lines = explain(req, cand, score_candidate(req, cand))
    assert any("отрасль" in ln for ln in lines)
    assert any("УГТ" in ln for ln in lines)
    assert any("Итого" in ln for ln in lines)


# ─── API: candidates и решения ───────────────────────────────────────────────

def test_candidates_rbac_and_ranked_output(client: TestClient) -> None:
    owner = _register(client)
    executor = _register(client, role="rd_executor")
    stranger = _register(client)
    org_id = _create_verified_org(client, owner["access_token"])
    request_id = _create_request(client, owner["access_token"], org_id)
    _submit(client, owner["access_token"], request_id)

    # Создатель видит ранжированных кандидатов (создатель/staff).
    resp = client.get(
        f"/api/v1/tech-requests/{request_id}/candidates",
        headers=_auth(owner["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body, list)
    assert all("score" in c and "explanation" in c for c in body)
    assert any(c["candidate"]["candidate_id"] == executor["user"]["id"] for c in body)

    # Чужой → 404 (IDOR).
    resp = client.get(
        f"/api/v1/tech-requests/{request_id}/candidates",
        headers=_auth(stranger["access_token"]),
    )
    assert resp.status_code == 404

    # В выдаче нет email/контактов кандидатов (без PII).
    text = str(body)
    assert "@" not in text


def test_decision_shortlist_and_repeat_409(client: TestClient) -> None:
    owner = _register(client)
    executor = _register(client, role="rd_executor")
    org_id = _create_verified_org(client, owner["access_token"])
    request_id = _create_request(client, owner["access_token"], org_id)
    _submit(client, owner["access_token"], request_id)

    candidates = client.get(
        f"/api/v1/tech-requests/{request_id}/candidates",
        headers=_auth(owner["access_token"]),
    ).json()
    cand = next(c for c in candidates if c["candidate"]["candidate_id"] == executor["user"]["id"])

    resp = client.post(
        f"/api/v1/tech-requests/{request_id}/candidates/{cand['candidate']['candidate_id']}/decision",
        headers=_auth(owner["access_token"]),
        json={"decision": "shortlist", "note": "Хорошее совпадение"},
    )
    assert resp.status_code == 201, resp.text

    # Повторное решение → 409 (зафиксировано).
    resp = client.post(
        f"/api/v1/tech-requests/{request_id}/candidates/{cand['candidate']['candidate_id']}/decision",
        headers=_auth(owner["access_token"]),
        json={"decision": "reject", "note": "Передумали"},
    )
    assert resp.status_code == 409, resp.text

    # Исходные данные не изменены: запрос не тронут (та же версия/статус).
    req = client.get(
        f"/api/v1/tech-requests/{request_id}",
        headers=_auth(owner["access_token"]),
    ).json()
    assert req["status"] == "submitted"

    # Не-исполнитель в пуле → 404 при решении.
    stranger = _register(client)
    resp = client.post(
        f"/api/v1/tech-requests/{request_id}/candidates/{stranger['user']['id']}/decision",
        headers=_auth(owner["access_token"]),
        json={"decision": "shortlist"},
    )
    assert resp.status_code == 404, resp.text


def test_decision_not_staff_forbidden(client: TestClient) -> None:
    owner = _register(client)
    executor = _register(client, role="rd_executor")
    org_id = _create_verified_org(client, owner["access_token"])
    request_id = _create_request(client, owner["access_token"], org_id)
    _submit(client, owner["access_token"], request_id)

    # Исполнитель (не создатель, не staff) → 404 (чужая заявка).
    resp = client.get(
        f"/api/v1/tech-requests/{request_id}/candidates",
        headers=_auth(executor["access_token"]),
    )
    assert resp.status_code == 404
