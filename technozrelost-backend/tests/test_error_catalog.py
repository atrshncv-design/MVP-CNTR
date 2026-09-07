"""Шов каталога ошибок (таск 01, R03): каждый ключ — код + текст в обеих локалях."""

from __future__ import annotations

import inspect

import pytest

import app.core.errors as errors


def test_every_error_key_has_code_and_both_locales() -> None:
    assert errors.CATALOG
    for code, entry in errors.CATALOG.items():
        assert code.isupper(), code
        assert isinstance(entry["status"], int), code
        assert entry["ru"].strip(), code
        assert entry["en"].strip(), code


def test_every_readiness_key_has_both_locales() -> None:
    assert errors.READINESS_TEXTS
    for key, entry in errors.READINESS_TEXTS.items():
        assert key.startswith("READINESS_"), key
        assert entry["ru"].strip(), key
        assert entry["en"].strip(), key


def test_reference_errors_exact_texts_both_locales() -> None:
    assert errors.get_message("AUTH_INVALID", "ru") == "Неверный email или пароль"
    assert errors.get_message("AUTH_INVALID", "en") == "Invalid email or password"
    assert errors.get_message("AUTH_REQUIRED", "ru") == "Не авторизован"
    assert errors.get_message("AUTH_REQUIRED", "en") == "Authentication required"
    assert (
        errors.get_message("REGISTRY_RATE_LIMITED", "ru")
        == "Слишком много запросов к реестру, попробуйте позже"
    )
    assert (
        errors.get_message("REGISTRY_RATE_LIMITED", "en")
        == "Too many registry requests, please try again later"
    )


def test_default_locale_is_russian_with_catalog_status() -> None:
    exc = errors.raise_error("AUTH_INVALID")
    assert exc.status_code == 401
    assert exc.detail == "Неверный email или пароль"
    assert exc.headers[errors.ERROR_HEADER] == "AUTH_INVALID"
    exc_en = errors.raise_error("AUTH_INVALID", accept_language="en")
    assert exc_en.status_code == 401
    assert exc_en.detail == "Invalid email or password"
    assert exc_en.headers[errors.ERROR_HEADER] == "AUTH_INVALID"


def test_params_format_exact_in_both_locales() -> None:
    assert (
        errors.get_message("AUTH_UNKNOWN_ROLE", "ru", {"role": "manager"})
        == "Неизвестная роль: manager"
    )
    assert (
        errors.get_message("AUTH_UNKNOWN_ROLE", "en", {"role": "manager"})
        == "Unknown role: manager"
    )
    assert (
        errors.get_message("FILE_TOO_LARGE", "ru", {"limit": 25})
        == "Файл превышает лимит 25 МБ"
    )
    assert (
        errors.get_message("FILE_TOO_LARGE", "en", {"limit": 25})
        == "File exceeds the 25 MB limit"
    )
    assert (
        errors.get_message("DOC_INVALID_TYPE", "ru", {"valid_types": "A, B"})
        == "Неверный тип документа. Допустимые: A, B"
    )
    assert (
        errors.get_message("DOC_INVALID_TYPE", "en", {"valid_types": "A, B"})
        == "Invalid document type. Allowed: A, B"
    )
    assert (
        errors.get_message("READINESS_UNKNOWN_STATUS", "ru", {"status": "bogus"})
        == "Неизвестный статус ответа: bogus"
    )
    assert (
        errors.get_message("READINESS_UNKNOWN_STATUS", "en", {"status": "bogus"})
        == "Unknown answer status: bogus"
    )


def test_placeholder_without_params_fails_closed() -> None:
    with pytest.raises(KeyError):
        errors.get_message("AUTH_UNKNOWN_ROLE", "ru")
    with pytest.raises(KeyError):
        errors.get_message("FILE_TOO_LARGE", "en")


def test_status_only_from_catalog() -> None:
    assert "status_code" not in inspect.signature(errors.raise_error).parameters


def test_no_extra_public_helpers() -> None:
    assert not hasattr(errors, "is_known")
    assert not hasattr(errors, "available_codes")


# Известные величины на момент написания: дословные копии пользовательских
# строк из app/services/readiness_assessment.py. Шов опирается только на errors.py.
_READINESS_RU = {
    "READINESS_ANSWER_NOT_STARTED": "Не начато",
    "READINESS_ANSWER_IN_PROGRESS": "В работе",
    "READINESS_ANSWER_FORMED": "Сформировано",
    "READINESS_ANSWER_DOCUMENTED": "Выполнено и документировано",
    "READINESS_ANSWER_VERIFIED": "Подтверждено",
    "READINESS_ANSWER_NOT_APPLICABLE": "Неприменимо",
    "READINESS_EVIDENCE_MISSING": "Отсутствует",
    "READINESS_EVIDENCE_DRAFT": "Черновик",
    "READINESS_EVIDENCE_READY": "Готово",
    "READINESS_EVIDENCE_VERIFIED": "Проверено",
    "READINESS_DIM_SCIENTIFIC": "Научная",
    "READINESS_DIM_TECHNICAL": "Техническая",
    "READINESS_DIM_ORGANIZATIONAL": "Организационная",
    "READINESS_DIM_PRODUCTION": "Производственная",
    "READINESS_CP_R01_TITLE": (
        "Выявлены и задокументированы фундаментальные принципы технологии"
    ),
    "READINESS_CP_R01_EXPL": (
        "Базовые принципы технологии сформулированы и зафиксированы "
        "в едином документе."
    ),
    "READINESS_CP_R02_TITLE": (
        "Сформулировано и проанализировано техническое решение проблемы"
    ),
    "READINESS_CP_R02_EXPL": (
        "Рассмотрены варианты решения, преимущества и ограничения, выбран "
        "предпочтительный вариант и зафиксированы риски."
    ),
    "READINESS_CP_R03_TITLE": "Сформулирована технологическая концепция",
    "READINESS_CP_R03_EXPL": (
        "Концепция содержит варианты применения, архитектуру, целевые "
        "метрики и ограничения."
    ),
    "READINESS_CP_R04_TITLE": "Обоснована цель разработки технологии",
    "READINESS_CP_R04_EXPL": (
        "Цель разработки связана с потребностью заказчика или "
        "индустриального партнёра."
    ),
    "READINESS_CP_R05_TITLE": "Подтверждена обоснованность концепции",
    "READINESS_CP_R05_EXPL": (
        "Квалифицированные специалисты оценили концепцию и её реализуемость."
    ),
    "READINESS_CP_R06_TITLE": (
        "Доказана эффективность применения технического решения"
    ),
    "READINESS_CP_R06_EXPL": (
        "Расчёты, допущения, доступные материалы, оборудование и компетенции "
        "подтверждают достижимость целевых метрик."
    ),
    "READINESS_CP_R07_TITLE": "Получен макет",
    "READINESS_CP_R07_EXPL": (
        "Создан макет, на котором проверяются отдельные характеристики "
        "и правильность технических решений."
    ),
    "READINESS_CP_R08_TITLE": "Проведены испытания",
    "READINESS_CP_R08_EXPL": (
        "Испытания проведены по утверждённой методике с критериями приёмки "
        "и отчётом о результатах."
    ),
    "READINESS_CP_R09_TITLE": "Отобраны образцы с лучшими показателями",
    "READINESS_CP_R09_EXPL": (
        "Результаты сопоставлены с целевыми значениями, отклонения разобраны, "
        "дальнейшие действия согласованы."
    ),
    "READINESS_CP_R10_TITLE": (
        "Получен лабораторный образец и подготовлен лабораторный стенд"
    ),
    "READINESS_CP_R10_EXPL": (
        "Лабораторный образец создан для проверки работоспособности концепции "
        "и ключевых характеристик в контролируемых условиях."
    ),
    "READINESS_CP_R11_TITLE": "Проведена верификация",
    "READINESS_CP_R11_EXPL": (
        "Есть объективные свидетельства соответствия образца установленным "
        "требованиям и воспроизводимости результатов."
    ),
    "READINESS_CP_R12_TITLE": "Получен экспериментальный образец",
    "READINESS_CP_R12_EXPL": (
        "Физический прототип создан для проверки ключевых идей в условиях, "
        "приближённых к реальным."
    ),
    "READINESS_CP_R13_TITLE": "Проведена внутренняя валидация образца",
    "READINESS_CP_R13_EXPL": (
        "Организация проверила работоспособность образца и готовность "
        "к созданию репрезентативного образца."
    ),
    "READINESS_CP_R14_TITLE": "Получен репрезентативный образец",
    "READINESS_CP_R14_EXPL": (
        "Образец отражает ключевые характеристики исследуемой технологии "
        "и готов к демонстрации в приближённых к эксплуатационным условиях."
    ),
    "READINESS_CP_R15_TITLE": "Проведена внешняя валидация образца",
    "READINESS_CP_R15_EXPL": (
        "Работоспособность образца подтверждена при внешней демонстрации, "
        "а результаты можно обобщить."
    ),
    "READINESS_CP_R16_TITLE": "Получен опытный образец",
    "READINESS_CP_R16_EXPL": (
        "Опытный образец готов для типовых испытаний и пилотной эксплуатации."
    ),
    "READINESS_CP_R17_TITLE": "Проведена валидация в эксплуатационных условиях",
    "READINESS_CP_R17_EXPL": (
        "Работа подтверждена в реальных условиях по программе, протоколам "
        "и показателям надёжности."
    ),
    "READINESS_CP_R18_TITLE": "Получен контрольный образец",
    "READINESS_CP_R18_EXPL": (
        "Контрольный образец соответствует серийной спецификации и готов "
        "к квалификационным испытаниям."
    ),
    "READINESS_CP_R19_TITLE": (
        "Получены разрешительные документы и проведены "
        "квалификационные испытания"
    ),
    "READINESS_CP_R19_EXPL": (
        "Квалификационные испытания завершены, результаты сопоставлены "
        "с требованиями и отраслевыми стандартами."
    ),
    "READINESS_CP_R20_TITLE": "Запущено установочной серией",
    "READINESS_CP_R20_EXPL": (
        "Установочная серия подтверждает готовность к серийному изготовлению "
        "и поставкам."
    ),
    "READINESS_CP_R21_TITLE": "Запущено серийное производство",
    "READINESS_CP_R21_EXPL": (
        "Серийное производство и эксплуатация сопровождаются показателями "
        "надёжности, инцидентами и экономическими результатами."
    ),
    "READINESS_CP_R22_TITLE": (
        "Разработана стратегия улучшения продукта или технологии"
    ),
    "READINESS_CP_R22_EXPL": (
        "Определены дальнейшие этапы масштабирования, модернизации, выхода "
        "на новые рынки, ресурсы и риски."
    ),
    "READINESS_EV_R01_E1": "Паспорт научно-технического задела",
    "READINESS_EV_R01_E2": "Описание проблемы и потребности",
    "READINESS_EV_R01_E3": "Акт экспертной оценки научно-технического задела",
    "READINESS_EV_R02_E1": "Сравнение вариантов технического решения",
    "READINESS_EV_R02_E2": "Матрица ограничений и рисков",
    "READINESS_EV_R03_E1": "Концепция технологической реализации",
    "READINESS_EV_R03_E2": "Обзор аналогов и лучших практик",
    "READINESS_EV_R03_E3": "Матрица целевых характеристик и критериев приёмки",
    "READINESS_EV_R04_E1": (
        "Письмо, протокол встречи или предварительное ТЗ заказчика"
    ),
    "READINESS_EV_R05_E1": "Экспертная оценка концепции",
    "READINESS_EV_R06_E1": "Расчётно-пояснительная записка",
    "READINESS_EV_R06_E2": "Расчёты, ссылки на аналоги и ресурсы",
    "READINESS_EV_R07_E1": "Акт приёмки макетного образца",
    "READINESS_EV_R07_E2": "Спецификация макета",
    "READINESS_EV_R07_E3": "Фотофиксация и ведомость комплектации",
    "READINESS_EV_R08_E1": "Программа и методика испытаний",
    "READINESS_EV_R08_E2": "План-график испытаний",
    "READINESS_EV_R08_E3": "Отчёт по испытаниям",
    "READINESS_EV_R09_E1": "Анализ отклонений и план корректирующих мероприятий",
    "READINESS_EV_R09_E2": (
        "Протокол согласования с квалифицированным заказчиком"
    ),
    "READINESS_EV_R10_E1": "Акт приёмки лабораторного образца",
    "READINESS_EV_R10_E2": "Спецификация лабораторного образца",
    "READINESS_EV_R10_E3": "Фотофиксация и ведомость комплектации",
    "READINESS_EV_R11_E1": "Протоколы испытаний",
    "READINESS_EV_R11_E2": "Матрица целевых и достигнутых характеристик",
    "READINESS_EV_R11_E3": "Отчёт о воспроизводимости и статистике",
    "READINESS_EV_R11_E4": "Анализ отклонений и корректирующие мероприятия",
    "READINESS_EV_R12_E1": "Акт приёмки экспериментального образца",
    "READINESS_EV_R12_E2": "Спецификация экспериментального образца",
    "READINESS_EV_R12_E3": "Фотофиксация и ведомость комплектации",
    "READINESS_EV_R13_E1": "Протоколы испытаний",
    "READINESS_EV_R13_E2": "Матрица целевых и достигнутых характеристик",
    "READINESS_EV_R13_E3": "Отчёт об устойчивости и статистике",
    "READINESS_EV_R13_E4": "Анализ отклонений и корректирующие мероприятия",
    "READINESS_EV_R14_E1": "Акт приёмки репрезентативного образца",
    "READINESS_EV_R14_E2": "Спецификация репрезентативного образца",
    "READINESS_EV_R14_E3": "Фотофиксация и ведомость комплектации",
    "READINESS_EV_R15_E1": "Протоколы испытаний или демонстраций",
    "READINESS_EV_R15_E2": "Матрица целевых и достигнутых характеристик",
    "READINESS_EV_R15_E3": "Акт экспертной оценки результатов",
    "READINESS_EV_R15_E4": "Протокол согласования с заказчиком",
    "READINESS_EV_R16_E1": "Акт приёмки опытного образца",
    "READINESS_EV_R16_E2": "Спецификация опытного образца",
    "READINESS_EV_R16_E3": "Фотофиксация и ведомость комплектации",
    "READINESS_EV_R17_E1": "Программа и методика эксплуатации",
    "READINESS_EV_R17_E2": "План-график пилотной эксплуатации",
    "READINESS_EV_R17_E3": "Протоколы эксплуатации по циклам или сменам",
    "READINESS_EV_R17_E4": "Отчёт по эксплуатационной надёжности",
    "READINESS_EV_R18_E1": "Акт приёмки контрольного образца",
    "READINESS_EV_R18_E2": "Спецификация контрольного образца",
    "READINESS_EV_R18_E3": "Фотофиксация и ведомость комплектации",
    "READINESS_EV_R19_E1": "Программа и методика квалификационных испытаний",
    "READINESS_EV_R19_E2": "План-график квалификационных испытаний",
    "READINESS_EV_R19_E3": "Протоколы квалификационных испытаний",
    "READINESS_EV_R19_E4": "Разрешительные документы",
    "READINESS_EV_R19_E5": "Отчёт по воспроизводимости и надёжности",
    "READINESS_EV_R20_E1": "Акт экспертной оценки результатов испытаний",
    "READINESS_EV_R20_E2": (
        "Протокол согласования с квалифицированным заказчиком"
    ),
    "READINESS_EV_R20_E3": "План-график установочной серии",
    "READINESS_EV_R21_E1": "Отчёты по эксплуатации и журналы инцидентов",
    "READINESS_EV_R21_E2": "Матрица целевых и достигнутых характеристик",
    "READINESS_EV_R21_E3": "Отчёт по надёжности и экономическим показателям",
    "READINESS_EV_R22_E1": "Акт оценки технологической и коммерческой зрелости",
    "READINESS_EV_R22_E2": "Актуализированный план развития технологии",
}


def test_readiness_ru_matches_source_exactly() -> None:
    assert set(_READINESS_RU) == set(errors.READINESS_TEXTS)
    for key, expected in _READINESS_RU.items():
        assert errors.readiness_text(key, "ru") == expected, key


def test_readiness_en_spot_checks_exact() -> None:
    assert errors.readiness_text("READINESS_ANSWER_NOT_STARTED", "en") == "Not started"
    assert errors.readiness_text("READINESS_EVIDENCE_READY", "en") == "Ready"
    assert errors.readiness_text("READINESS_DIM_SCIENTIFIC", "en") == "Scientific"
    assert (
        errors.readiness_text("READINESS_CP_R01_TITLE", "en")
        == "Fundamental technology principles identified and documented"
    )
    assert (
        errors.readiness_text("READINESS_EV_R19_E4", "en") == "Permits"
    )
    assert errors.readiness_text("READINESS_ANSWER_DOCUMENTED") == (
        "Выполнено и документировано"
    )
