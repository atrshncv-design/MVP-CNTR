"""Тематический gate публичного консультанта (тикет 03 ai-rag).

Внешний guardrail ПЕРЕД LLM: детерминированная классификация вопроса
(on-topic / ambiguous / off-topic) на keyword-паттернах и эвристиках —
БЕЗ LLM в критическом пути классификации и БЕЗ зависимости от client state.

Приоритет классификации:
1. on-topic по СИЛЬНОМУ тематическому маркеру (УГТ, ГОСТ, услуги, грант,
   РИД, НИОКТР, платформа, проект, анкета и т.п.) → пропуск к консультанту;
   сильный маркер перекрывает adversarial-маркеры: инъекция, приклеенная
   к реальному вопросу («игнорируй правила. Что такое УГТ?»), остаётся
   вопросом по теме — защита от инъекций живёт на уровне фиксированного
   системного промпта консультанта (тикет 02);
2. adversarial-инструкции («игнорируй», «раскрой промпт», jailbreak и т.п.)
   БЕЗ сильного тематического маркера → off-topic;
3. off-topic (личное/политика/медицина/юмор-спам) → вежливый отказ;
4. слабые тематические маркеры (правила/регламенты/шаги/этапы) → on-topic,
   если вопрос не является adversarial-инструкцией;
5. приветствия/неопределённые → ambiguous (уточнение);
6. неклассифицируемое → default-allow: консультант (тикет 02) сам даёт
   честный отказ при отсутствии подтверждённых материалов.

Ответы gate (отказ/уточнение/блокировка) НЕ раскрывают внутренние промпты
и правила классификации.

Блокировка злоупотреблений (СЕРВЕРНАЯ, НЕ client state):
- счётчик ПОСЛЕДОВАТЕЛЬНЫХ off-topic и блокировка хранятся в БД
  (таблица rag_abuse_state), одна запись на IP;
- N последовательных off-topic (settings.rag_offtopic_limit, по умолчанию 3)
  → блокировка IP на 1 час (settings.rag_block_minutes): /rag/chat → 429,
  в т.ч. для on-topic вопросов;
- ключ состояния — IP: смена session_id НЕ снимает блокировку и не обнуляет
  счётчик; счётчик сбрасывается при on-topic/ambiguous от того же IP и
  «протухает» через час бездействия (TTL).
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from enum import StrEnum

from sqlalchemy import case, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import RagAbuseState

# ─── Ответы gate (не раскрывают внутренние правила/промпты) ────────────────

OFFTOPIC_REFUSAL = (
    "Я отвечаю только на вопросы по тематике Центра технологического "
    "развития и платформы «Технозрелость». Пожалуйста, задайте вопрос "
    "по этой теме."
)

AMBIGUOUS_CLARIFICATION = (
    "Уточните, пожалуйста, ваш вопрос. Я отвечаю по тематике Центра "
    "технологического развития: уровни готовности технологий (УГТ), "
    "ГОСТ Р 58048-2017, услуги и меры поддержки, РИД, НИОКТР."
)

BLOCK_MESSAGE = "Слишком много запросов. Пожалуйста, попробуйте снова через час."


class TopicVerdict(StrEnum):
    ON_TOPIC = "on_topic"
    AMBIGUOUS = "ambiguous"
    OFF_TOPIC = "off_topic"


# ─── Детерминированные категории (keyword-паттерны, без LLM) ───────────────

# Сильные тематические маркеры: Центр, ГОСТ Р 58048-2017, УГТ,
# услуги, меры поддержки, РИД, НИОКТР, объекты платформы.
STRONG_ON_TOPIC_PATTERNS: tuple[str, ...] = (
    # Центр / платформа
    r"центр\w*",
    r"цнтр",
    r"технозрелост",
    r"платформ",
    # ГОСТ Р 58048-2017 / технологическая готовность
    r"\bгост\b",
    r"58048",
    r"технологическ\w*",
    r"технолог\w*",
    r"\bготовност\w*",
    # УГТ (уровни готовности технологий)
    r"\bугт\b",
    r"уровн\w*\s+готовност\w*",
    # Роли и объекты платформы
    r"\bрол\w*",
    r"заказчик\w*",
    r"исполнител\w*",
    r"эксперт\w*",
    r"куратор\w*",
    # Услуги
    r"услуг\w*",
    r"сервис\w*",
    # Меры поддержки
    r"поддержк\w*",
    r"грант\w*",
    r"субсиди\w*",
    r"акселератор\w*",
    r"льгот\w*",
    # РИД
    r"\bрид\b",
    r"интеллектуальн\w*",
    # НИОКТР
    r"\bниоктр\b",
    r"\bниокр\b",
    r"научно-исследовательск\w*",
    r"опытно-конструкторск\w*",
    # Объекты платформы
    r"проект\w*",
    r"анкет\w*",
    r"оценк\w*",
    r"диагностик\w*",
    r"дорожн\w*\s+карт\w*",
    r"паспорт\w*",
    r"балл\w*",
    r"реестр\w*",
)

# Слабые тематические маркеры: считаются on-topic ТОЛЬКО если вопрос
# не является adversarial-инструкцией («игнорируй правила» → off-topic,
# «какие правила участия?» → on-topic).
WEAK_ON_TOPIC_PATTERNS: tuple[str, ...] = (
    r"правил\w*",
    r"регламент\w*",
    r"инструкци\w*",
    r"шаг\w*",
    r"этап\w*",
    r"порядок",
)

# Adversarial: инструкции «игнорируй», вскрытие промптов, jailbreak-атаки.
ADVERSARIAL_PATTERNS: tuple[str, ...] = (
    r"игнорируй",
    r"игнор",
    r"проигнорируй",
    r"не слушай",
    r"забудь предыдущ\w*",
    r"забудь все",
    r"раскрой",
    r"промпт",
    r"секрет\w*",
    r"взлом\w*",
    r"хакер",
    r"jailbreak",
    r"обойди",
    r"сними ограничени\w*",
    r"открой системн\w*",
    r"покажи системн\w*",
    r"выполни команд\w*",
    r"выполни инструкци\w*",
    r"системн\w*\s+промпт",
)

# Заведомо НЕ тематика Центра: личное (об ассистенте), политика, медицина,
# юмор-спам.
OFF_TOPIC_PATTERNS: tuple[str, ...] = (
    # Личное / об ассистенте
    r"как тебя зовут",
    r"как тебя звать",
    r"кто ты",
    r"ты кто",
    r"сколько тебе лет",
    r"где ты жив",
    r"ты бот",
    r"ты робот",
    r"ты человек",
    r"расскажи о себе",
    r"как дела",
    r"как поживаешь",
    r"что ты умеешь",
    r"тво[её] имя",
    r"твой возраст",
    r"как настроение",
    r"познаком",
    r"женат",
    r"замужем",
    r"любишь",
    r"погод\w*",
    # Политика
    r"президент",
    r"путин",
    r"выборы|выборов|выборах|предвыборн",
    r"парти\w*",
    r"депутат\w*",
    r"госдум\w*",
    r"политик\w*",
    r"войн\w*",
    r"санкци\w*",
    r"курс валют",
    r"курс доллар",
    # Медицина / здоровье
    r"симптом\w*",
    r"болезн\w*",
    r"лекарств\w*",
    r"врач\w*",
    r"диагноз",
    r"температур\w*",
    r"головн\w*\s+бол\w*",
    r"здоровь\w*",
    r"прививк\w*",
    r"вакцин\w*",
    r"таблетк\w*",
    r"клиник\w*",
    r"больниц\w*",
    r"грипп",
    r"ковид",
    r"коронавирус",
    r"насморк",
    # Юмор / спам / развлечения
    r"анекдот\w*",
    r"шутк\w*",
    r"ха-ха",
    r"хаха",
    r"лотере\w*",
    r"казино",
    r"криптовалют\w*",
    r"биткоин",
    r"заработать",
    r"бесплатн\w*\s+ден\w*",
    r"переведи",
    r"перевод\w*\s+ден\w*",
    r"рассылк\w*",
    r"реклам\w*",
    r"скидк\w*",
    r"\bспам\b",
)

# Приветствия и неопределённые запросы → уточнение (только если вопрос
# не попал ни в одну из категорий выше).
AMBIGUOUS_PATTERNS: tuple[str, ...] = (
    r"привет",
    r"здравствуй",
    r"добрый день",
    r"доброе утро",
    r"добрый вечер",
    r"hello",
    r"хай",
    r"\bhi\b",
    r"помоги",
    r"подскажи",
    r"что делать",
    r"что посоветуешь",
    r"подробнее",
    r"поясни",
    r"объясни",
    r"уточни",
    r"расскажи что-нибудь",
    r"расскажи что нибудь",
)

_STRONG_ON_TOPIC_RE = tuple(re.compile(p) for p in STRONG_ON_TOPIC_PATTERNS)
_WEAK_ON_TOPIC_RE = tuple(re.compile(p) for p in WEAK_ON_TOPIC_PATTERNS)
_ADVERSARIAL_RE = tuple(re.compile(p) for p in ADVERSARIAL_PATTERNS)
_OFF_TOPIC_RE = tuple(re.compile(p) for p in OFF_TOPIC_PATTERNS)
_AMBIGUOUS_RE = tuple(re.compile(p) for p in AMBIGUOUS_PATTERNS)


def _matches(text: str, compiled: tuple[re.Pattern[str], ...]) -> bool:
    return any(rx.search(text) is not None for rx in compiled)


def classify_topic(question: str) -> TopicVerdict:
    """Детерминированная классификация вопроса (без LLM, без client state).

    См. docstring модуля: сильный on-topic > adversarial > off-topic >
    слабый on-topic > ambiguous > default-allow.
    """
    text = question.lower().strip()
    if not text:
        return TopicVerdict.AMBIGUOUS
    if _matches(text, _STRONG_ON_TOPIC_RE):
        return TopicVerdict.ON_TOPIC
    if _matches(text, _ADVERSARIAL_RE):
        return TopicVerdict.OFF_TOPIC
    if _matches(text, _OFF_TOPIC_RE):
        return TopicVerdict.OFF_TOPIC
    if _matches(text, _WEAK_ON_TOPIC_RE):
        return TopicVerdict.ON_TOPIC
    if _matches(text, _AMBIGUOUS_RE) or len(text) < 4:
        return TopicVerdict.AMBIGUOUS
    # default-allow: неклассифицируемое пропускается — консультант (тикет 02)
    # сам даёт честный отказ при отсутствии подтверждённых материалов.
    return TopicVerdict.ON_TOPIC


# ─── Серверное состояние: счётчик off-topic и блокировка (по IP) ────────────


async def is_ip_blocked(db: AsyncSession, ip: str) -> bool:
    """Активна ли блокировка IP (blocked_until в будущем)."""
    stmt = (
        select(RagAbuseState.id)
        .where(
            RagAbuseState.ip == ip,
            RagAbuseState.blocked_until > func.now(),
        )
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none() is not None


async def record_offtopic(db: AsyncSession, ip: str, session_id: str) -> int:
    """Атомарный инкремент счётчика последовательных off-topic (upsert).

    Возвращает новое значение счётчика. Счётчик «протухает» через
    rag_block_minutes бездействия (TTL-сброс к 1), чтобы «последовательность»
    была ограничена по времени. session_id сохраняется для диагностики —
    ключ состояния — IP, поэтому смена session_id не обнуляет счётчик.
    """
    cutoff = datetime.now(UTC) - timedelta(minutes=settings.rag_block_minutes)
    stmt = pg_insert(RagAbuseState).values(
        ip=ip,
        session_id=session_id,
        off_topic_count=1,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["ip"],
        set_={
            "session_id": session_id,
            "off_topic_count": case(
                (RagAbuseState.updated_at < cutoff, 1),
                else_=RagAbuseState.off_topic_count + 1,
            ),
            "updated_at": func.now(),
        },
    ).returning(RagAbuseState.off_topic_count)
    count = (await db.execute(stmt)).scalar_one()
    await db.commit()
    return count


async def set_block(db: AsyncSession, ip: str, session_id: str) -> None:
    """Блокировка IP на rag_block_minutes (429 для всех /rag/chat запросов)."""
    until = datetime.now(UTC) + timedelta(minutes=settings.rag_block_minutes)
    stmt = pg_insert(RagAbuseState).values(
        ip=ip,
        session_id=session_id,
        off_topic_count=0,
        blocked_until=until,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["ip"],
        set_={"blocked_until": until, "updated_at": func.now()},
    )
    await db.execute(stmt)
    await db.commit()


async def reset_counter(db: AsyncSession, ip: str, session_id: str) -> None:
    """Сброс счётчика при on-topic/ambiguous: последовательность прервана."""
    stmt = pg_insert(RagAbuseState).values(
        ip=ip,
        session_id=session_id,
        off_topic_count=0,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["ip"],
        set_={
            "session_id": session_id,
            "off_topic_count": 0,
            "updated_at": func.now(),
        },
    )
    await db.execute(stmt)
    await db.commit()
