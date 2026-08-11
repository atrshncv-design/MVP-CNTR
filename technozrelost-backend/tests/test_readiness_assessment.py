import uuid

from fastapi.testclient import TestClient

from app.services.readiness_assessment import (
    READINESS_CHECKPOINTS,
    compute_readiness,
)


def _answer(code: str, status: str, evidence: list[dict] | None = None) -> dict:
    return {
        "checkpoint_code": code,
        "status": status,
        "applicable": True,
        "comment": "Не применяется к данному типу проекта" if status == "not_applicable" else None,
        "evidence": evidence or [],
    }


def test_template_contains_22_mapped_checkpoints() -> None:
    assert len(READINESS_CHECKPOINTS) == 22
    assert READINESS_CHECKPOINTS[0].code == "R01"
    assert READINESS_CHECKPOINTS[-1].code == "R22"
    assert [item.ugt_level for item in READINESS_CHECKPOINTS[:2]] == [1, 1]
    assert [item.ugt_level for item in READINESS_CHECKPOINTS[2:6]] == [2, 2, 2, 2]
    assert READINESS_CHECKPOINTS[-1].ugt_level == 9


def test_readiness_keeps_ugt_continuous_and_reports_dimension_scores() -> None:
    answers = [
        _answer("R01", "documented", [{"evidence_code": "R01-E1", "status": "ready"}]),
        _answer("R02", "documented"),
        _answer("R03", "documented"),
        _answer("R04", "verified"),
        _answer("R05", "documented"),
        _answer("R06", "not_started"),
    ]

    result = compute_readiness(answers)

    assert result["preliminary_ugt"] == 1
    assert result["latest_checkpoint"] == 5
    assert result["completion_pct"] > 0
    assert 0 < result["evidence_pct"] < result["completion_pct"]
    assert set(result["dimension_scores"]) == {
        "scientific",
        "technical",
        "organizational",
        "production",
    }
    assert any(blocker["checkpoint_code"] == "R06" for blocker in result["blockers"])


def test_not_applicable_is_excluded_from_project_fill_rate() -> None:
    answers = [_answer("R01", "documented"), _answer("R02", "documented")]
    answers.extend(_answer(f"R{number:02d}", "not_applicable") for number in range(3, 23))

    result = compute_readiness(answers)

    assert result["preliminary_ugt"] == 1
    assert result["completion_pct"] > 70
    assert result["not_applicable_count"] == 20


def test_verified_evidence_increases_confidence() -> None:
    documented = compute_readiness(
        [_answer("R01", "documented", [{"evidence_code": "R01-E1", "status": "ready"}])]
    )
    verified = compute_readiness(
        [_answer("R01", "verified", [{"evidence_code": "R01-E1", "status": "verified"}])]
    )

    assert verified["evidence_pct"] > documented["evidence_pct"]
    assert verified["confidence_pct"] > documented["confidence_pct"]


def test_template_endpoint_exposes_versioned_22_checkpoint_contract(client: TestClient) -> None:
    response = client.get("/api/v1/assessments/template")

    assert response.status_code == 200
    payload = response.json()
    assert payload["version"]
    assert len(payload["checkpoints"]) == 22
    assert {item["value"] for item in payload["answer_statuses"]} == {
        "not_started",
        "in_progress",
        "formed",
        "documented",
        "verified",
        "not_applicable",
    }


def test_new_assessment_calculates_and_persists_readiness_result(client: TestClient) -> None:
    email = f"readiness-{uuid.uuid4().hex[:8]}@example.com"
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Probe12345",
            "full_name": "Readiness Tester",
            "organization": "Орг",
            "role_slug": "gk_customer",
            "consents": [
                {"slug": "terms", "version": 1, "accepted": True},
                {"slug": "privacy", "version": 1, "accepted": True},
            ],
        },
    )
    assert registration.status_code == 201, registration.text
    token = registration.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    answers = [
        _answer("R01", "documented", [{"evidence_code": "R01-E1", "status": "ready"}]),
        _answer("R02", "documented"),
    ]
    answers.extend(_answer(f"R{number:02d}", "not_applicable") for number in range(3, 23))

    response = client.post(
        "/api/v1/assessments",
        headers=headers,
        json={
            "name": "Проект с доказательной базой",
            "description": "Проверка новой анкеты",
            "category": "Программное обеспечение",
            "target_level": 6,
            "answers": answers,
        },
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["preliminary_level"] == 1
    assert payload["category"] == "Программное обеспечение"
    assert payload["target_level"] == 6
    assert payload["readiness_result"]["completion_pct"] > 70
    assert payload["readiness_result"]["dimension_scores"]["scientific"] > 0
    assert payload["readiness_result"]["template_version"]
