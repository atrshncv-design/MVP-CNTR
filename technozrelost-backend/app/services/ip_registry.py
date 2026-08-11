"""Реестр РИД (тикет 03 operations-modules): детерминированные вычисления.

Все функции — ЧИСТЫЕ (без БД, без LLM, без внешних вызовов): предупреждения
считаются по датам/полям карточки, маскировка авторов — по роли. Это делает
их unit-тестируемыми напрямую (граничные даты, роли).

Решения (зафиксированы):
* Предупреждения НЕ хранятся в БД — вычисляются при каждом чтении:
  - expiry_date < today → «истёк» (граница: сегодня — ещё действует);
  - owner_organization_id IS NULL → «правообладатель не указан».
* Маскировка ПДн авторов: staff видит ФИО (full_name пользователя или name
  внешнего автора) и user_id; остальные роли получают «Автор N» без user_id.
"""

from __future__ import annotations

from datetime import date

WARNING_EXPIRED = "expired"
WARNING_NO_OWNER = "no_owner"

WARNING_MESSAGES: dict[str, str] = {
    WARNING_EXPIRED: "Срок действия РИД истёк",
    WARNING_NO_OWNER: "Правообладатель не указан",
}


def compute_ip_warnings(
    *,
    expiry_date: date | None,
    owner_organization_id: int | None,
    today: date | None = None,
) -> list[dict[str, str]]:
    """Детерминированные предупреждения карточки РИД (без LLM).

    Границы: expiry_date == today → предупреждения НЕТ (действует весь день);
    expiry_date < today → «истёк». owner_organization_id=None → «правообладатель
    не указан». today инъектируется для unit-тестов границ.
    """
    ref = today or date.today()
    warnings: list[dict[str, str]] = []
    if expiry_date is not None and expiry_date < ref:
        warnings.append({"code": WARNING_EXPIRED, "message": WARNING_MESSAGES[WARNING_EXPIRED]})
    if owner_organization_id is None:
        warnings.append({"code": WARNING_NO_OWNER, "message": WARNING_MESSAGES[WARNING_NO_OWNER]})
    return warnings


def author_display_name(
    author_id: int,
    *,
    is_staff: bool,
    user_full_name: str | None = None,
    external_name: str | None = None,
) -> str:
    """Маскировка ПДн автора по роли.

    staff: ФИО пользователя (user_id) или имя внешнего автора; остальные:
    «Автор N» (N — id записи автора, не user_id).
    """
    if is_staff:
        return user_full_name or external_name or f"Автор {author_id}"
    return f"Автор {author_id}"
