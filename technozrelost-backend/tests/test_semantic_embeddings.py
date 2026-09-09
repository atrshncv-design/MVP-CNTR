"""Task 12 — настоящие эмбеддинги и честный rerank (R05i, история 14).

Шов — публичная HTTP-граница API (spec «Границы и швы», модуль ai):
POST /rag/templates, POST /rag/search, POST /match.
Эталонные пары «синоним -> документ» — часть теста.
"""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "gk_customer") -> str:
    return register_test_user(
        client, email=_email("sem"), full_name="Sem User", role_slug=role
    )["access_token"]


def _seed_doc(client: TestClient, admin_token: str, title: str, raw_text: str) -> None:
    r = client.post(
        "/api/v1/rag/templates",
        json={"title": title, "doc_type": "methodology", "raw_text": raw_text},
        headers=_auth(admin_token),
    )
    assert r.status_code == 201, r.text


def _seed_semantic_docs(client: TestClient, admin_token: str) -> None:
    docs = [
        ("БПЛА мониторинг ЛЭП",
         "Беспилотный летательный аппарат обследует линии электропередач. "
         "Технология платформа ЦНТР."),
        ("Двигательная установка",
         "Электрический двигатель приводит в движение установку. Технология платформа ЦНТР."),
        ("Корпус из углепластика",
         "Углепластик применяется для корпуса изделия. Технология платформа ЦНТР."),
        ("Дефектоскопия снимков",
         "Искусственный интеллект распознает дефекты на снимках. Технология платформа ЦНТР."),
        ("Послойное выращивание",
         "Аддитивные технологии выращивают детали послойно. Технология платформа ЦНТР."),
    ]
    for title, raw in docs:
        _seed_doc(client, admin_token, title, raw)


def _search(client: TestClient, token: str, query: str, top_k: int = 5):
    r = client.post(
        "/api/v1/rag/search",
        json={"query": query, "top_k": top_k},
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    return r.json()


GOLDEN_PAIRS = [
    ("дрон технология", "БПЛА мониторинг ЛЭП"),
    ("мотор технология", "Двигательная установка"),
    ("композит технология", "Корпус из углепластика"),
    ("нейросеть технология", "Дефектоскопия снимков"),
    ("трехмерная печать технология", "Послойное выращивание"),
]


def test_synonym_queries_find_relevant_documents(client: TestClient) -> None:
    """Запрос-синоним возвращает релевантный документ топ-1 (набор эталонных пар)."""
    admin_token = _register(client, "cntr_admin")
    _seed_semantic_docs(client, admin_token)
    token = _register(client)
    for query, expected_title in GOLDEN_PAIRS:
        results = _search(client, token, query)
        assert results, f"пустой ответ на запрос {query!r}"
        assert results[0]["document"]["title"] == expected_title, (
            f"запрос {query!r}: топ-1 {results[0]['document']['title']!r}, "
            f"ожидался {expected_title!r}"
        )


def test_embedding_dimension_and_model_consistent(client: TestClient) -> None:
    """Размерность модели, конфига и индекса согласованы; модель — semantic-ru-v2."""
    from app.core import embeddings as emb
    from app.core.config import settings

    assert emb.VECTOR_DIM == 1536
    assert settings.vector_dimension == 1536
    assert emb.EMBEDDING_MODEL == "semantic-ru-v2"
    assert emb.EMBEDDING_DIM == 1536
    vec = emb.embed_text("дрон технология")
    assert len(vec) == 1536


def _seed_match_orgs() -> None:
    import asyncio

    from sqlalchemy import select

    from app.db.models import Organization

    async def _create() -> None:
        from app.core.database import SessionLocal

        async with SessionLocal() as db:
            existing = await db.scalar(select(Organization).limit(1))
            if existing:
                return
            db.add_all(
                [
                    Organization(
                        name="Альфа композитные системы",
                        org_type="scientific_org",
                        region="Москва",
                        competencies=["композиты"],
                        projects_count=10,
                    ),
                    Organization(
                        name="Бета двигательные установки",
                        org_type="scientific_org",
                        region="Москва",
                        competencies=["двигатели"],
                        projects_count=9,
                    ),
                    Organization(
                        name="Гамма нейросетевые решения",
                        org_type="scientific_org",
                        region="Москва",
                        competencies=["нейросети"],
                        projects_count=8,
                    ),
                ]
            )
            await db.commit()

    asyncio.run(_create())


def test_match_rerank_changes_order_not_only_reasons(
    client: TestClient, monkeypatch
) -> None:
    """Порядок matching меняется при другом ранжировании LLM, а не только текст причин."""
    from app.services import ai_assistant as ai_module

    _seed_match_orgs()
    token = _register(client)
    payload = {
        "title": "Композитный корпус",
        "annotation": "легкий углепластик для изделия",
        "competencies": ["композиты"],
        "region": "Москва",
    }
    script_resp = client.post("/api/v1/match", json=payload, headers=_auth(token))
    assert script_resp.status_code == 200, script_resp.text
    script_ids = [c["id"] for c in script_resp.json()["results"]]
    assert len(script_ids) >= 3

    # LLM возвращает обратный порядок номерами кандидатов входного топа.
    async def _fake_reverse(system: str, user_msg: str) -> str:
        return (
            "3 - наиболее релевантен по синонимам\n"
            "2 - средняя релевантность\n"
            "1 - наименьшая релевантность\n"
        )

    monkeypatch.setattr(ai_module, "ask_llm", _fake_reverse)
    old_gateway = ai_module.settings.llm_gateway_enabled
    old_key = ai_module.settings.llm_api_key
    ai_module.settings.llm_gateway_enabled = True  # type: ignore[assignment]
    ai_module.settings.llm_api_key = "sk-test-rerank"  # type: ignore[assignment]
    try:
        llm_resp = client.post("/api/v1/match", json=payload, headers=_auth(token))
    finally:
        ai_module.settings.llm_gateway_enabled = old_gateway  # type: ignore[assignment]
        ai_module.settings.llm_api_key = old_key  # type: ignore[assignment]
    assert llm_resp.status_code == 200, llm_resp.text
    body = llm_resp.json()
    assert body["method"] == "llm"
    llm_ids = [c["id"] for c in body["results"]]
    assert llm_ids == script_ids[::-1][: len(llm_ids)], (
        f"порядок не изменился по ранжированию LLM: script={script_ids} llm={llm_ids}"
    )


def test_search_fallback_on_model_failure_is_honest(
    client: TestClient, monkeypatch
) -> None:
    """Деградация модели — честный fallback (200 + документы), не молчание."""
    from app.core import embeddings as emb_module

    admin_token = _register(client, "cntr_admin")
    _seed_doc(
        client,
        admin_token,
        "БПЛА мониторинг ЛЭП",
        "Беспилотный летательный аппарат обследует линии. Технология платформа.",
    )
    token = _register(client)

    def _boom(text: str, dim: int = 1536):
        raise RuntimeError("embedding model down")

    from app.services import rag as rag_module

    monkeypatch.setattr(emb_module, "embed_text", _boom)
    monkeypatch.setattr(rag_module, "embed_text", _boom)
    results = _search(client, token, "дрон технология")
    assert results, "fallback вернул пусто вместо документов"
