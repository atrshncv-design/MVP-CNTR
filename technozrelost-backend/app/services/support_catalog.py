"""Каталог мер поддержки (тикет 04 operations-modules): детерминированные вычисления.

Все функции — ЧИСТЫЕ (без БД, без LLM, без внешних вызовов): актуальность
программы считается по дате (actuality_date), совпадение УГТ-диапазона — по
числовым границам. Это делает их unit-тестируемыми напрямую (граничные даты,
открытые границы диапазонов).

Решения (зафиксированы):
* «Устарело»/рекомендация НЕ хранятся в БД — вычисляются при каждом чтении:
  - actuality_date < today → «устарело» (is_stale=True) и recommendation=False
    (исключает уверенную рекомендацию);
  - граница: actuality_date == today — ещё актуально весь день (как в тикетах
    01/03: сегодня не считается просрочкой);
  - actuality_date IS NULL (непубликованная/незаполненная) — не устарело,
    рекомендация не исключается (публикация без даты невозможна — 422).
* Фильтр по УГТ-диапазону: программа попадает в фильтр, если её диапазон
  [target_ugt_min, target_ugt_max] пересекается с запрошенным [f_min, f_max];
  NULL-границы трактуются как открытые (без ограничения).
"""

from __future__ import annotations

from datetime import date

STALE_MESSAGE = "Мера поддержки устарела: дата актуальности истекла"


def compute_actuality(
    actuality_date: date | None,
    today: date | None = None,
) -> tuple[bool, bool]:
    """Детерминированная актуальность программы (без LLM).

    Возвращает (is_stale, recommendation). Границы: actuality_date < today →
    устарело + рекомендация исключена; actuality_date == today — актуально
    весь день; None — не устарело. today инъектируется для unit-тестов границ.
    """
    ref = today or date.today()
    if actuality_date is not None and actuality_date < ref:
        return True, False
    return False, True


def ugt_range_overlaps(
    *,
    program_min: int | None,
    program_max: int | None,
    filter_min: int | None,
    filter_max: int | None,
) -> bool:
    """Пересечение УГТ-диапазона программы и фильтра (открытые границы — NULL).

    Программа с диапазоном [program_min, program_max] подходит под фильтр
    [filter_min, filter_max], если диапазоны пересекаются:
    NOT (program_max < filter_min) AND NOT (program_min > filter_max),
    где NULL-граница означает «без ограничения» с соответствующей стороны.
    """
    return not (
        program_max is not None
        and filter_min is not None
        and program_max < filter_min
    ) and not (
        program_min is not None
        and filter_max is not None
        and program_min > filter_max
    )
