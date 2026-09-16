"""AI-проводка через OpenAI-совместимый endpoint (таск 08, G51–G56).

- Провайдер (OpenCode Go) — OpenAI-совместимый; базовый URL берётся из
  серверных настроек `llm_api_base`, значение ключа — только из окружения.
  В репо фиксируются только имена: `LLM_API_KEY` (настройка) и
  `OPENCODE_API_KEY` (fallback окружения). Значений здесь нет и не будет.
- Наружу уходят только фрагменты allowlist-корпуса ГОСТов и обезличенный
  вопрос. Гейт корпуса — из таска 06 (`ensure_allowed_for_external`),
  импортируется, а не дублируется. ПДн, файлы проектов и данные ЛК
  во внешний промпт не попадают (deny-by-default по полям: наружу
  собирается только struktura ниже, а не объект пользователя/проекта).
- Недоверенный текст по-прежнему оборачивается разделителями
  `wrap_untrusted` из `ai_assistant` (изоляция промпта, таск 11).
"""

from __future__ import annotations

import os
import re
from pathlib import Path

from app.core.config import settings

# Имя переменной окружения с ключом провайдера (только имя, не значение).
OPENCODE_API_KEY_ENV = "OPENCODE_API_KEY"

# Маркеры обезличивания — стабильные строки для тестов и логов.
REDACTED_EMAIL = "[email скрыт]"
REDACTED_PHONE = "[телефон скрыт]"

# Верхняя граница обезличенного вопроса (символы).
MAX_QUESTION_CHARS = 2000

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_PHONE_RE = re.compile(
    r"(?:\+7|8)[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d"
    r"[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d"
    r"[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d"
)


def _looks_present(value: str | None) -> bool:
    """Ключ задан по-настоящему, а не пуст/dev-заглушка."""
    return bool(value and value.strip() and value.strip() != "change_me")


def resolve_llm_api_key() -> str | None:
    """Значение ключа провайдера без хранения в репо.

    Приоритет: серверная настройка `llm_api_key` (env `LLM_API_KEY`),
    затем окружение `OPENCODE_API_KEY`. Пусто/`change_me` — как отсутствие.
    """
    if _looks_present(settings.llm_api_key):
        return settings.llm_api_key
    env_key = os.environ.get(OPENCODE_API_KEY_ENV)
    if _looks_present(env_key):
        return env_key
    return None


def sanitize_question_for_external(question: str) -> str:
    """Обезличивание вопроса перед внешним запросом (G56).

    Вырезает email и телефоны РФ (+7/8 с разделителями), обрезает длину.
    Номера ГОСТов (58048-2017) и УГТ под маску телефона не попадают:
    маска требует префикс +7/8 и 10 цифр абонента.
    """
    redacted = _EMAIL_RE.sub(REDACTED_EMAIL, question)
    redacted = _PHONE_RE.sub(REDACTED_PHONE, redacted)
    return redacted.strip()[:MAX_QUESTION_CHARS]


def fragment_source_name(title: str | None, source_uri: str | None) -> str:
    """Имя источника фрагмента для allowlist-гейта (G56/G58)."""
    if source_uri:
        base = Path(source_uri).name
        if base:
            return base
    return title or "без названия"


def _allowed_by_corpus_gate(name: str) -> bool:
    """Гейт таска 06: не-allowlist никогда не уходит наружу.

    Импорт ленивый (модуль `scripts` вне пакета `app`); недоступность
    гейта — тоже deny (фрагмент исключается, чат продолжает локально).
    """
    try:
        from scripts.rag_import import ensure_allowed_for_external
    except ImportError:
        return False
    try:
        ensure_allowed_for_external(name)
    except ValueError:
        return False
    return True


def select_external_fragments(pairs: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """Отбор фрагментов для внешнего промпта (deny-by-default).

    Файлоподобные источники (имя с суффиксом) проходят гейт корпуса
    таска 06; платформенные документы без файлового имени (методология,
    шаблоны — vetted на staff-границе записи) идут как есть.
    """
    selected: list[tuple[str, str]] = []
    for name, text in pairs:
        if Path(name).suffix and not _allowed_by_corpus_gate(name):
            continue
        selected.append((name, text))
    return selected
