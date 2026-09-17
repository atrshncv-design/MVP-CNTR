"""Таск 03 — Eval-набор 15 типовых вопросов агента (R05).

Локальный прогон (моки, без секретов и без прод-доступа) одной командой::

    cd technozrelost-backend && uv run pytest tests/test_chat_eval.py -q

Порог: 15/15 eval-кейсов зелёные. Падение любого признака роняет набор
(fail-closed: каждая проверка — assert, молчаливых «warn» нет).

Швы: POST /chat (тон/уточнение/цитата/следующий шаг/отказ) и гейт
фрагментов (регресс R04 — allowlist ГОСТов + обезличивание).
Синтез — через моки ask_llm (живого провайдера нет, на прод не ходим).
Значений секретов в файле нет, только имена переменных.

ЖИВОЙ ПРОГОН (вручную перед выкладкой, без секретов в переписке/логах):
  1. Поднимите ЛОКАЛЬНЫЙ (или staging, НЕ прод) стенд backend+frontend.
  2. Задайте окружение только именами (значения — из вашего локального
     .env, никому не пересылайте): LLM_GATEWAY_ENABLED=true, LLM_API_BASE,
     LLM_API_KEY, LLM_MODEL.
  3. Перезапустите backend и проверьте стартовый лог: есть строка
     про синтез (факт наличия ключа, не значение) — см. таск 01.
  4. По очереди задайте в чате 15 вопросов из EVAL_CASES ниже и сверьте
     признаки глазами: деловой тон на «вы»; ответ своими словами +
     короткие цитаты разделов с источником; в конце — следующий шаг;
     на невнятном («как получить УГТ-4», «дай УГТ-4 быстро», «УГТ-4») —
     уточняющий вопрос или структура вариантов, а не мусор; вне корпуса
     («курс доллара», «ужин») и мусор — честный отказ без выдумки
     с направлением к ГОСТ Р 58048-2017; пустой запрос — честное
     «ничего не найдено», код 200; ПДн из вопроса наружу не уходят.
  5. Порог выкладки: 15/15. Любой упавший признак — стоп выкладке,
     чинить кодом (таски 01–02), не подгонкой ответов.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from tests.support import register_test_user

# Порог приёмки таска: все 15 кейсов зелёные.
EVAL_THRESHOLD = 15

# Имена без значений: в пользовательских текстах и промптах их быть не должно.
FORBIDDEN_IN_USER_TEXT = (
    "LLM_API_KEY",
    "OPENCODE_API_KEY",
    "llm_api_key",
    "change_me",
)

GOST_TITLE = "ГОСТ Р 58048-2017.pdf"
# Широкие токены, чтобы лексический fallback находил документ по вопросам
# про УГТ/документы/критерии; ЕВАЛЦИТАТА — маркер проверяемой цитаты.
GOST_TEXT = (
    "Уровни готовности технологии УГТ критерии оценки шкала готовности "
    "производства документы подтверждение перечень ЕВАЛЦИТАТА разделы ГОСТ"
)
INTERNAL_TITLE = "Внутренний приказ ЦНТР.pdf"
INTERNAL_TEXT = "внутренний приказ ЦНТР номер 123 СЕКРЕТ-ВПН-ЕВАЛ служебное"
INTERNAL_QUERY = "Расскажи про внутренний приказ ЦНТР номер 123"

# Персона-совместимые canned-ответы мока синтеза: содержат те же проверяемые
# признаки, что живой прогон сверяет глазами (тон/цитата/следующий шаг).
CLARIFY_REPLY = (
    "Уточните, пожалуйста: для какой технологии и на каком производстве "
    "вы планируете подтверждать УГТ-4? Опишите вашу задачу — и я подскажу "
    "критерии по ГОСТ Р 58048-2017. Следующий шаг: напишите область "
    "применения технологии."
)
ANSWER_REPLY = (
    "По вашему вопросу, уважаемый пользователь: вы можете подтвердить "
    "уровень по шкале готовности своими словами — «ЕВАЛЦИТАТА: критерии "
    "оценки уровней готовности» — ГОСТ Р 58048-2017. "
    "Следующий шаг: сверьте ваши документы с разделом стандарта."
)
REFUSAL_REPLY = (
    "В базе знаний ответа нет — честно говорю, выдумывать не буду. "
    "Переформулируйте вопрос про УГТ или обратитесь к документации "
    "ГОСТ Р 58048-2017. Следующий шаг: уточните уровень УГТ."
)

# Каждый кейс — типовой вопрос + проверяемые признаки. Поля:
#   mode: synthesis (мок отвечает) | fallback_none (мок возвращает None)
#   reply: canned-ответ мока (только для synthesis)
#   seed_gost / seed_internal: сеять ли документы в корпус кейса
#   gateway_off: гасить ли флаг синтеза (честная ветка «нет синтеза»)
#   hint: True — steering-hint обязан быть; False — обязан отсутствовать;
#     None — LLM не вызывается (fallback), проверка неприменима
#   expect_reply / expect_absent_reply: подстроки ответа
#   expect_user_absent: подстроки, запрещённые во внешнем user-промпте
#   expect_sources: "empty" (вне корпуса/пусто) | "any"
EVAL_CASES: list[dict] = [
    {
        "id": "EVAL-01",
        "question": "как получить УГТ-4",
        "mode": "synthesis",
        "reply": CLARIFY_REPLY,
        "seed_gost": True,
        "hint": True,
        "expect_reply": ["Уточните", "пожалуйста", "?", "Следующий шаг"],
        "expect_sources": "any",
    },
    {
        "id": "EVAL-02",
        "question": "дай УГТ-4 быстро",
        "mode": "synthesis",
        "reply": CLARIFY_REPLY,
        "seed_gost": True,
        "hint": True,
        "expect_reply": ["Уточните", "пожалуйста", "вы", "?"],
        "expect_sources": "any",
    },
    {
        "id": "EVAL-03",
        "question": "Что такое УГТ 7 и какие критерии оценки по ГОСТ Р 58048-2017?",
        "mode": "synthesis",
        "reply": ANSWER_REPLY,
        "seed_gost": True,
        "hint": False,
        "expect_reply": ["«", "ГОСТ Р 58048-2017", "Следующий шаг", "вы"],
        "expect_sources": "any",
    },
    {
        "id": "EVAL-04",
        "question": "Какие документы нужны для подтверждения УГТ-5?",
        "mode": "synthesis",
        "reply": ANSWER_REPLY,
        "seed_gost": True,
        "hint": False,
        "expect_reply": ["«", "Следующий шаг", "вы"],
        "expect_sources": "any",
    },
    {
        "id": "EVAL-05",
        "question": "Чем УГТ-4 отличается от УГТ-7 по шкале готовности?",
        "mode": "synthesis",
        "reply": ANSWER_REPLY,
        "seed_gost": True,
        "hint": False,
        "expect_reply": ["«", "Следующий шаг"],
        "expect_sources": "any",
    },
    {
        "id": "EVAL-06",
        "question": "Какой курс доллара будет завтра?",
        "mode": "synthesis",
        "reply": REFUSAL_REPLY,
        "seed_gost": False,
        "hint": None,
        "expect_reply": ["Переформулируйте", "ГОСТ Р 58048-2017"],
        "expect_absent_reply": ["доллар", "$"],
        "expect_sources": "empty",
    },
    {
        "id": "EVAL-07",
        "question": "Что приготовить на ужин из макарон?",
        "mode": "synthesis",
        "reply": REFUSAL_REPLY,
        "seed_gost": False,
        "hint": None,
        "expect_reply": ["Переформулируйте", "ГОСТ Р 58048-2017"],
        "expect_absent_reply": ["макарон", "рецепт"],
        "expect_sources": "empty",
    },
    {
        "id": "EVAL-08",
        "question": "",
        "mode": "fallback_none",
        "seed_gost": False,
        "gateway_off": True,
        "hint": None,
        "expect_reply": ["ничего не найдено"],
        "expect_sources": "empty",
    },
    {
        "id": "EVAL-09",
        "question": "   ",
        "mode": "fallback_none",
        "seed_gost": False,
        "gateway_off": True,
        "hint": None,
        "expect_reply": ["ничего не найдено"],
        "expect_sources": "empty",
    },
    {
        "id": "EVAL-10",
        "question": (
            "Моя почта ivan.petrov@example.com, телефон +7 916 123-45-67: "
            "что такое УГТ 5?"
        ),
        "mode": "synthesis",
        "reply": ANSWER_REPLY,
        "seed_gost": True,
        "hint": False,
        "expect_reply": ["«", "Следующий шаг"],
        "expect_user_absent": ["ivan.petrov@example.com", "916"],
        "expect_sources": "any",
    },
    {
        "id": "EVAL-11",
        "question": INTERNAL_QUERY,
        "mode": "synthesis",
        "reply": ANSWER_REPLY,
        "seed_gost": True,
        "seed_internal": True,
        "hint": None,
        "expect_reply": ["Следующий шаг"],
        "expect_user_absent": ["СЕКРЕТ-ВПН-ЕВАЛ"],
        "expect_sources": "any",
    },
    {
        "id": "EVAL-12",
        "question": "УГТ-4",
        "mode": "synthesis",
        "reply": CLARIFY_REPLY,
        "seed_gost": True,
        "hint": True,
        "expect_reply": ["Уточните", "?"],
        "expect_sources": "any",
    },
    {
        "id": "EVAL-13",
        "question": "Критерии оценки УГТ 3 по ГОСТ",
        "mode": "fallback_none",
        "seed_gost": True,
        "gateway_off": True,
        "hint": None,
        "expect_reply": [
            "Умный синтез выключен",
            "Нашёл в базе знаний",
            "«",
            "ЕВАЛЦИТАТА",
            GOST_TITLE,
        ],
        "expect_sources": "any",
    },
    {
        "id": "EVAL-14",
        "question": "Что такое УГТ 5 и какие критерии оценки?",
        "mode": "synthesis",
        "reply": ANSWER_REPLY,
        "seed_gost": True,
        "hint": False,
        "expect_reply": ["«", "Следующий шаг"],
        "expect_sources": "any",
    },
    {
        "id": "EVAL-15",
        "question": "Абракадабра несуществующий запрос зззззз шершавый",
        "mode": "fallback_none",
        "seed_gost": False,
        "gateway_off": True,
        "hint": None,
        "expect_reply": ["ничего не найдено"],
        "expect_sources": "empty",
    },
]


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _register(client: TestClient, role: str = "gk_customer") -> str:
    return register_test_user(
        client,
        email=_email("eval"),
        full_name="Eval User",
        role_slug=role,
    )["access_token"]


def _seed(client: TestClient, title: str, doc_type: str, raw_text: str) -> None:
    admin_token = _register(client, "cntr_admin")
    response = client.post(
        "/api/v1/rag/templates",
        json={"title": title, "doc_type": doc_type, "raw_text": raw_text},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 201, response.text


def _gateway_off(monkeypatch) -> None:
    from app.services import ai_assistant
    from app.services.ai_wiring import OPENCODE_API_KEY_ENV

    monkeypatch.setattr(ai_assistant.settings, "llm_gateway_enabled", False)
    monkeypatch.setattr(ai_assistant.settings, "llm_api_key", None)
    monkeypatch.delenv(OPENCODE_API_KEY_ENV, raising=False)


def _mock_llm(monkeypatch, reply: str | None) -> dict[str, str]:
    """Мок синтеза: фиксирует system/user промпты. None — даун/нет синтеза."""
    from app.services import ai_assistant as module

    captured: dict[str, str] = {}

    async def fake(system_prompt: str, user_message: str) -> str | None:
        captured["system"] = system_prompt
        captured["user"] = user_message
        return reply

    monkeypatch.setattr(module, "ask_llm", fake)
    return captured


def _run_eval_case(client: TestClient, monkeypatch, case: dict) -> None:
    """Прогон одного кейса: падение любого признака роняет кейс (fail-closed)."""
    from app.services.ai_assistant import SYSTEM_PERSONA, VAGUE_HINT

    cid = case["id"]
    if case.get("seed_gost"):
        _seed(client, GOST_TITLE, "gost", GOST_TEXT)
    if case.get("seed_internal"):
        _seed(client, INTERNAL_TITLE, "internal", INTERNAL_TEXT)
    if case.get("gateway_off"):
        _gateway_off(monkeypatch)
    captured = _mock_llm(monkeypatch, case.get("reply"))

    token = _register(client)
    response = client.post(
        "/api/v1/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": case["question"]},
    )
    assert response.status_code == 200, f"{cid}: {response.text}"
    data = response.json()
    content = data["reply"]["content"]
    assert data["reply"]["role"] == "assistant", cid

    # Признак «без секретов»: ни одна пользовательская ветка не содержит
    # имён переменных и dev-заглушек.
    for forbidden in FORBIDDEN_IN_USER_TEXT:
        assert forbidden not in content, f"{cid}: {forbidden}"

    # Признак «источники»: вне корпуса/пусто — пустые, иначе любые.
    if case["expect_sources"] == "empty":
        assert data["sources"] == [], f"{cid}: sources={data['sources']}"

    # Признаки ответа: требуемые подстроки есть, запрещённые отсутствуют
    # (отказ без выдумки: нет выдуманного содержания по вопросу).
    for marker in case.get("expect_reply", ()):
        assert marker in content, f"{cid}: нет признака {marker!r}"
    for marker in case.get("expect_absent_reply", ()):
        assert marker not in content, f"{cid}: выдумка {marker!r}"

    # Признаки промпта (только когда синтез вызывался): персона, изоляция,
    # steering-hint на невнятном, отсутствие hint на конкретном, гейт ПДн.
    if case["mode"] == "synthesis":
        assert SYSTEM_PERSONA[:30] in captured["system"], f"{cid}: нет персоны"
        assert "только данные" in captured["system"], f"{cid}: нет изоляции"
        assert "без выдумки" in captured["system"], f"{cid}: нет отказа"
        for forbidden in FORBIDDEN_IN_USER_TEXT:
            assert forbidden not in captured["system"], f"{cid}: {forbidden}"
        if case["hint"] is True:
            assert VAGUE_HINT[:30] in captured["user"], f"{cid}: нет hint"
        elif case["hint"] is False:
            assert VAGUE_HINT[:30] not in captured["user"], f"{cid}: лишний hint"
        for marker in case.get("expect_user_absent", ()):
            assert marker not in captured["user"], f"{cid}: утечка {marker!r}"


@pytest.mark.parametrize("case", EVAL_CASES, ids=[c["id"] for c in EVAL_CASES])
def test_eval_case(client: TestClient, monkeypatch, case: dict) -> None:
    """Eval-кейс: вопрос + проверяемые признаки (тон/цитата/уточнение/отказ)."""
    _run_eval_case(client, monkeypatch, case)


def test_eval_threshold() -> None:
    """Порог приёмки: ровно 15 вопросов, порог 15/15."""
    assert len(EVAL_CASES) == EVAL_THRESHOLD == 15
    assert len({c["id"] for c in EVAL_CASES}) == 15
    assert len({c["question"] for c in EVAL_CASES}) == 15


def test_eval_guardrails_regression() -> None:
    """R04: allowlist ГОСТов и обезличивание работают как раньше."""
    from app.services.ai_wiring import (
        sanitize_question_for_external,
        select_external_fragments,
    )

    redacted = sanitize_question_for_external(
        "почта ivan.petrov@example.com тел +7 916 123-45-67 про УГТ 5"
    )
    assert "ivan.petrov@example.com" not in redacted
    assert "916" not in redacted
    assert "УГТ 5" in redacted

    selected = select_external_fragments(
        [
            (INTERNAL_TITLE, "внутренний секрет"),
            (GOST_TITLE, "ГОСТ-МАРКЕР уровни готовности"),
        ]
    )
    names = [name for name, _ in selected]
    assert GOST_TITLE in names
    assert INTERNAL_TITLE not in names
