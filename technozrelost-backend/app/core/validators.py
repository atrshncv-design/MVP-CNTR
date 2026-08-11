"""Валидаторы реквизитов организаций (тикет 03 identity-organizations).

ИНН: 10 цифр (юрлицо) или 12 (ИП), контрольная сумма по весам ФНС.
ОГРН: 13 цифр (если указан) — контрольная сумма по брифу не требуется.
Нормализация: из входа убираются пробелы, остаются только цифры.
"""

from __future__ import annotations

# Веса контрольных разрядов ИНН (приказ ФНС / алгоритм контрольной суммы).
# 10-значный ИНН: 1 контрольный разряд — веса на первые 9 цифр.
INN_WEIGHTS_10 = (2, 4, 10, 3, 5, 9, 4, 6, 8)
# 12-значный ИНН: 1-й контрольный разряд (11-я цифра) — веса на первые 10 цифр.
INN_WEIGHTS_12_1 = (7, 2, 4, 10, 3, 5, 9, 4, 6, 8)
# 2-й контрольный разряд (12-я цифра) — веса на первые 11 цифр.
INN_WEIGHTS_12_2 = (3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8)


def normalize_inn(value: str | None) -> str:
    """Нормализация ИНН: убирает пробелы и разделители, оставляет только цифры.

    Возвращает строку из цифр; пустую — для пустого/None входа. Если во входе
    есть нецифровые символы (кроме пробелов/разделителей), результат не является
    валидным ИНН (проверяется is_valid_inn / validate_inn).
    """
    if not value:
        return ""
    return "".join(value.split())


def _control_digit(inn: str, weights: tuple[int, ...]) -> int:
    """Контрольный разряд по весам: (sum % 11) % 10."""
    total = sum(int(digit) * weight for digit, weight in zip(inn, weights, strict=False))
    return (total % 11) % 10


def is_valid_inn(value: str | None) -> bool:
    """Проверка ИНН: нормализация + длина (10/12) + контрольная сумма."""
    inn = normalize_inn(value)
    if not inn.isdigit():
        return False
    if len(inn) == 10:
        return _control_digit(inn[:9], INN_WEIGHTS_10) == int(inn[9])
    if len(inn) == 12:
        first = _control_digit(inn[:10], INN_WEIGHTS_12_1)
        if first != int(inn[10]):
            return False
        return _control_digit(inn[:11], INN_WEIGHTS_12_2) == int(inn[11])
    return False


def validate_inn(value: str | None) -> str:
    """Возвращает нормализованный ИНН или бросает ValueError с понятным текстом."""
    inn = normalize_inn(value)
    if not inn:
        raise ValueError("ИНН обязателен")
    if not inn.isdigit():
        raise ValueError("ИНН должен содержать только цифры")
    if len(inn) not in (10, 12):
        raise ValueError("ИНН должен содержать 10 цифр (юрлицо) или 12 (ИП)")
    if not is_valid_inn(inn):
        raise ValueError("ИНН не прошёл проверку контрольной суммы")
    return inn


def is_valid_ogrn(value: str | None) -> bool:
    """ОГРН: 13 цифр, если указан (необязательное поле)."""
    if value is None or not value.strip():
        return True
    return len(value.strip()) == 13 and value.strip().isdigit()
