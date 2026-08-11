"""Versioned project-readiness questionnaire and server-side scoring.

The source questionnaire contains 22 project-readiness milestones. They are
mapped to the platform's 9 UGT levels but deliberately kept as separate
milestones so partial completion and evidence quality remain visible.
"""
# The catalog keeps source-language formulations intact; long content lines are intentional.
# ruff: noqa: E501

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

READINESS_TEMPLATE_VERSION = "2026-08-04-v1"

ANSWER_STATUSES = (
    "not_started",
    "in_progress",
    "formed",
    "documented",
    "verified",
    "not_applicable",
)
ANSWER_STATUS_LABELS = {
    "not_started": "Не начато",
    "in_progress": "В работе",
    "formed": "Сформировано",
    "documented": "Выполнено и документировано",
    "verified": "Подтверждено",
    "not_applicable": "Неприменимо",
}
ANSWER_STATUS_SCORES = {
    "not_started": 0.0,
    "in_progress": 0.25,
    "formed": 0.5,
    "documented": 0.75,
    "verified": 1.0,
}
EVIDENCE_STATUSES = ("missing", "draft", "ready", "verified")
EVIDENCE_STATUS_LABELS = {
    "missing": "Отсутствует",
    "draft": "Черновик",
    "ready": "Готово",
    "verified": "Проверено",
}
EVIDENCE_STATUS_SCORES = {
    "missing": 0.0,
    "draft": 0.25,
    "ready": 0.75,
    "verified": 1.0,
}
DIMENSIONS = ("scientific", "technical", "organizational", "production")
DIMENSION_LABELS = {
    "scientific": "Научная",
    "technical": "Техническая",
    "organizational": "Организационная",
    "production": "Производственная",
}


@dataclass(frozen=True)
class EvidenceRequirement:
    code: str
    title: str
    required: bool = True


@dataclass(frozen=True)
class ReadinessCheckpoint:
    code: str
    number: int
    ugt_level: int
    title: str
    explanation: str
    dimensions: tuple[str, ...]
    critical: bool
    evidence: tuple[EvidenceRequirement, ...]


# Content adapted from «Чек-лист готовности проекта.docx».
READINESS_CHECKPOINTS: tuple[ReadinessCheckpoint, ...] = (
    ReadinessCheckpoint("R01", 1, 1, "Выявлены и задокументированы фундаментальные принципы технологии", "Базовые принципы технологии сформулированы и зафиксированы в едином документе.", ("scientific",), True, (
        EvidenceRequirement("R01-E1", "Паспорт научно-технического задела"),
        EvidenceRequirement("R01-E2", "Описание проблемы и потребности"),
        EvidenceRequirement("R01-E3", "Акт экспертной оценки научно-технического задела", False),
    )),
    ReadinessCheckpoint("R02", 2, 1, "Сформулировано и проанализировано техническое решение проблемы", "Рассмотрены варианты решения, преимущества и ограничения, выбран предпочтительный вариант и зафиксированы риски.", ("scientific", "technical"), False, (
        EvidenceRequirement("R02-E1", "Сравнение вариантов технического решения"),
        EvidenceRequirement("R02-E2", "Матрица ограничений и рисков"),
    )),
    ReadinessCheckpoint("R03", 3, 2, "Сформулирована технологическая концепция", "Концепция содержит варианты применения, архитектуру, целевые метрики и ограничения.", ("technical", "organizational"), True, (
        EvidenceRequirement("R03-E1", "Концепция технологической реализации"),
        EvidenceRequirement("R03-E2", "Обзор аналогов и лучших практик"),
        EvidenceRequirement("R03-E3", "Матрица целевых характеристик и критериев приёмки"),
    )),
    ReadinessCheckpoint("R04", 4, 2, "Обоснована цель разработки технологии", "Цель разработки связана с потребностью заказчика или индустриального партнёра.", ("scientific", "organizational"), False, (
        EvidenceRequirement("R04-E1", "Письмо, протокол встречи или предварительное ТЗ заказчика"),
    )),
    ReadinessCheckpoint("R05", 5, 2, "Подтверждена обоснованность концепции", "Квалифицированные специалисты оценили концепцию и её реализуемость.", ("scientific", "organizational"), False, (
        EvidenceRequirement("R05-E1", "Экспертная оценка концепции"),
    )),
    ReadinessCheckpoint("R06", 6, 2, "Доказана эффективность применения технического решения", "Расчёты, допущения, доступные материалы, оборудование и компетенции подтверждают достижимость целевых метрик.", ("technical",), True, (
        EvidenceRequirement("R06-E1", "Расчётно-пояснительная записка"),
        EvidenceRequirement("R06-E2", "Расчёты, ссылки на аналоги и ресурсы"),
    )),
    ReadinessCheckpoint("R07", 7, 3, "Получен макет", "Создан макет, на котором проверяются отдельные характеристики и правильность технических решений.", ("technical", "production"), True, (
        EvidenceRequirement("R07-E1", "Акт приёмки макетного образца"),
        EvidenceRequirement("R07-E2", "Спецификация макета"),
        EvidenceRequirement("R07-E3", "Фотофиксация и ведомость комплектации"),
    )),
    ReadinessCheckpoint("R08", 8, 3, "Проведены испытания", "Испытания проведены по утверждённой методике с критериями приёмки и отчётом о результатах.", ("technical", "organizational"), True, (
        EvidenceRequirement("R08-E1", "Программа и методика испытаний"),
        EvidenceRequirement("R08-E2", "План-график испытаний"),
        EvidenceRequirement("R08-E3", "Отчёт по испытаниям"),
    )),
    ReadinessCheckpoint("R09", 9, 3, "Отобраны образцы с лучшими показателями", "Результаты сопоставлены с целевыми значениями, отклонения разобраны, дальнейшие действия согласованы.", ("technical", "organizational"), False, (
        EvidenceRequirement("R09-E1", "Анализ отклонений и план корректирующих мероприятий"),
        EvidenceRequirement("R09-E2", "Протокол согласования с квалифицированным заказчиком", False),
    )),
    ReadinessCheckpoint("R10", 10, 4, "Получен лабораторный образец и подготовлен лабораторный стенд", "Лабораторный образец создан для проверки работоспособности концепции и ключевых характеристик в контролируемых условиях.", ("technical", "production"), True, (
        EvidenceRequirement("R10-E1", "Акт приёмки лабораторного образца"),
        EvidenceRequirement("R10-E2", "Спецификация лабораторного образца"),
        EvidenceRequirement("R10-E3", "Фотофиксация и ведомость комплектации"),
    )),
    ReadinessCheckpoint("R11", 11, 4, "Проведена верификация", "Есть объективные свидетельства соответствия образца установленным требованиям и воспроизводимости результатов.", ("technical", "organizational"), True, (
        EvidenceRequirement("R11-E1", "Протоколы испытаний"),
        EvidenceRequirement("R11-E2", "Матрица целевых и достигнутых характеристик"),
        EvidenceRequirement("R11-E3", "Отчёт о воспроизводимости и статистике"),
        EvidenceRequirement("R11-E4", "Анализ отклонений и корректирующие мероприятия"),
    )),
    ReadinessCheckpoint("R12", 12, 5, "Получен экспериментальный образец", "Физический прототип создан для проверки ключевых идей в условиях, приближённых к реальным.", ("technical", "production"), True, (
        EvidenceRequirement("R12-E1", "Акт приёмки экспериментального образца"),
        EvidenceRequirement("R12-E2", "Спецификация экспериментального образца"),
        EvidenceRequirement("R12-E3", "Фотофиксация и ведомость комплектации"),
    )),
    ReadinessCheckpoint("R13", 13, 5, "Проведена внутренняя валидация образца", "Организация проверила работоспособность образца и готовность к созданию репрезентативного образца.", ("technical", "organizational"), True, (
        EvidenceRequirement("R13-E1", "Протоколы испытаний"),
        EvidenceRequirement("R13-E2", "Матрица целевых и достигнутых характеристик"),
        EvidenceRequirement("R13-E3", "Отчёт об устойчивости и статистике"),
        EvidenceRequirement("R13-E4", "Анализ отклонений и корректирующие мероприятия"),
    )),
    ReadinessCheckpoint("R14", 14, 6, "Получен репрезентативный образец", "Образец отражает ключевые характеристики исследуемой технологии и готов к демонстрации в приближённых к эксплуатационным условиях.", ("technical", "production"), True, (
        EvidenceRequirement("R14-E1", "Акт приёмки репрезентативного образца"),
        EvidenceRequirement("R14-E2", "Спецификация репрезентативного образца"),
        EvidenceRequirement("R14-E3", "Фотофиксация и ведомость комплектации"),
    )),
    ReadinessCheckpoint("R15", 15, 6, "Проведена внешняя валидация образца", "Работоспособность образца подтверждена при внешней демонстрации, а результаты можно обобщить.", ("technical", "organizational"), True, (
        EvidenceRequirement("R15-E1", "Протоколы испытаний или демонстраций"),
        EvidenceRequirement("R15-E2", "Матрица целевых и достигнутых характеристик"),
        EvidenceRequirement("R15-E3", "Акт экспертной оценки результатов"),
        EvidenceRequirement("R15-E4", "Протокол согласования с заказчиком", False),
    )),
    ReadinessCheckpoint("R16", 16, 7, "Получен опытный образец", "Опытный образец готов для типовых испытаний и пилотной эксплуатации.", ("technical", "production"), True, (
        EvidenceRequirement("R16-E1", "Акт приёмки опытного образца"),
        EvidenceRequirement("R16-E2", "Спецификация опытного образца"),
        EvidenceRequirement("R16-E3", "Фотофиксация и ведомость комплектации"),
    )),
    ReadinessCheckpoint("R17", 17, 7, "Проведена валидация в эксплуатационных условиях", "Работа подтверждена в реальных условиях по программе, протоколам и показателям надёжности.", ("technical", "organizational", "production"), True, (
        EvidenceRequirement("R17-E1", "Программа и методика эксплуатации"),
        EvidenceRequirement("R17-E2", "План-график пилотной эксплуатации"),
        EvidenceRequirement("R17-E3", "Протоколы эксплуатации по циклам или сменам"),
        EvidenceRequirement("R17-E4", "Отчёт по эксплуатационной надёжности"),
    )),
    ReadinessCheckpoint("R18", 18, 8, "Получен контрольный образец", "Контрольный образец соответствует серийной спецификации и готов к квалификационным испытаниям.", ("technical", "production"), True, (
        EvidenceRequirement("R18-E1", "Акт приёмки контрольного образца"),
        EvidenceRequirement("R18-E2", "Спецификация контрольного образца"),
        EvidenceRequirement("R18-E3", "Фотофиксация и ведомость комплектации"),
    )),
    ReadinessCheckpoint("R19", 19, 8, "Получены разрешительные документы и проведены квалификационные испытания", "Квалификационные испытания завершены, результаты сопоставлены с требованиями и отраслевыми стандартами.", ("organizational", "production"), True, (
        EvidenceRequirement("R19-E1", "Программа и методика квалификационных испытаний"),
        EvidenceRequirement("R19-E2", "План-график квалификационных испытаний"),
        EvidenceRequirement("R19-E3", "Протоколы квалификационных испытаний"),
        EvidenceRequirement("R19-E4", "Разрешительные документы"),
        EvidenceRequirement("R19-E5", "Отчёт по воспроизводимости и надёжности"),
    )),
    ReadinessCheckpoint("R20", 20, 8, "Запущено установочной серией", "Установочная серия подтверждает готовность к серийному изготовлению и поставкам.", ("production", "organizational"), True, (
        EvidenceRequirement("R20-E1", "Акт экспертной оценки результатов испытаний"),
        EvidenceRequirement("R20-E2", "Протокол согласования с квалифицированным заказчиком"),
        EvidenceRequirement("R20-E3", "План-график установочной серии"),
    )),
    ReadinessCheckpoint("R21", 21, 9, "Запущено серийное производство", "Серийное производство и эксплуатация сопровождаются показателями надёжности, инцидентами и экономическими результатами.", ("production", "organizational"), True, (
        EvidenceRequirement("R21-E1", "Отчёты по эксплуатации и журналы инцидентов"),
        EvidenceRequirement("R21-E2", "Матрица целевых и достигнутых характеристик"),
        EvidenceRequirement("R21-E3", "Отчёт по надёжности и экономическим показателям"),
    )),
    ReadinessCheckpoint("R22", 22, 9, "Разработана стратегия улучшения продукта или технологии", "Определены дальнейшие этапы масштабирования, модернизации, выхода на новые рынки, ресурсы и риски.", ("organizational", "production"), False, (
        EvidenceRequirement("R22-E1", "Акт оценки технологической и коммерческой зрелости"),
        EvidenceRequirement("R22-E2", "Актуализированный план развития технологии"),
    )),
)

_CHECKPOINTS_BY_CODE = {item.code: item for item in READINESS_CHECKPOINTS}


def _round_pct(value: float) -> float:
    return round(value * 100, 1)


def _evidence_score(
    checkpoint: ReadinessCheckpoint,
    answer: dict[str, Any],
    status_score: float,
) -> float:
    entries = {item.get("evidence_code"): item.get("status") for item in answer.get("evidence", [])}
    if not checkpoint.evidence:
        return status_score
    scores = []
    for requirement in checkpoint.evidence:
        evidence_status = entries.get(requirement.code)
        if evidence_status not in EVIDENCE_STATUS_SCORES:
            scores.append(0.0)
        else:
            scores.append(EVIDENCE_STATUS_SCORES[evidence_status])
    return sum(scores) / len(scores)


def compute_readiness(answers: list[dict[str, Any]]) -> dict[str, Any]:
    """Calculate a conservative, continuous preliminary assessment.

    The result is intentionally server-side and deterministic. A UGT block is
    achieved when its average maturity is at least 70% and all critical
    checkpoints in that block are at least documented (0.75).
    """
    supplied = {answer.get("checkpoint_code"): answer for answer in answers}
    checkpoint_results: list[dict[str, Any]] = []
    applicable_results: list[dict[str, Any]] = []
    not_applicable_count = 0

    for checkpoint in READINESS_CHECKPOINTS:
        answer = supplied.get(checkpoint.code, {})
        status = answer.get("status", "not_started")
        if status not in ANSWER_STATUS_SCORES and status != "not_applicable":
            raise ValueError(f"Unknown answer status: {status}")
        applicable = answer.get("applicable", status != "not_applicable")
        if status == "not_applicable":
            applicable = False
        if not applicable:
            not_applicable_count += 1
            checkpoint_results.append({
                "checkpoint_code": checkpoint.code,
                "number": checkpoint.number,
                "ugt_level": checkpoint.ugt_level,
                "title": checkpoint.title,
                "status": "not_applicable",
                "score_pct": None,
                "evidence_pct": None,
                "applicable": False,
                "critical": checkpoint.critical,
            })
            continue

        status_score = ANSWER_STATUS_SCORES[status]
        evidence_score = _evidence_score(checkpoint, answer, status_score)
        item = {
            "checkpoint_code": checkpoint.code,
            "number": checkpoint.number,
            "ugt_level": checkpoint.ugt_level,
            "title": checkpoint.title,
            "status": status,
            "score_pct": _round_pct(status_score),
            "evidence_pct": _round_pct(evidence_score),
            "applicable": True,
            "critical": checkpoint.critical,
        }
        checkpoint_results.append(item)
        applicable_results.append({**item, "score": status_score, "evidence_score": evidence_score, "dimensions": checkpoint.dimensions})

    def average(items: list[dict[str, Any]], key: str = "score") -> float:
        return sum(item[key] for item in items) / len(items) if items else 0.0

    completion_score = average(applicable_results)
    evidence_score = average(applicable_results, "evidence_score")
    confidence_score = average([
        {"score": (item["score"] * 0.4) + (item["evidence_score"] * 0.6)}
        for item in applicable_results
    ])

    level_scores = []
    for level in range(1, 10):
        items = [item for item in applicable_results if item["ugt_level"] == level]
        critical = [item for item in items if item["critical"]]
        score = average(items)
        achieved = bool(items) and score >= 0.7 and all(item["score"] >= 0.75 for item in critical)
        level_scores.append({
            "ugt_level": level,
            "percentage": _round_pct(score),
            "achieved": achieved,
            "checkpoint_codes": [item["checkpoint_code"] for item in items],
        })

    preliminary_ugt = 0
    for item in level_scores:
        if item["achieved"]:
            preliminary_ugt = item["ugt_level"]
        else:
            break

    dimension_scores = {}
    for dimension in DIMENSIONS:
        items = [item for item in applicable_results if dimension in item["dimensions"]]
        dimension_scores[dimension] = _round_pct(average(items))

    latest_checkpoint = max(
        (item["number"] for item in applicable_results if item["score"] >= 0.5),
        default=0,
    )
    next_level = min(preliminary_ugt + 1, 9)
    blockers = []
    for item in applicable_results:
        if item["ugt_level"] == next_level and item["score"] < 0.75:
            blockers.append({
                "checkpoint_code": item["checkpoint_code"],
                "title": item["title"],
                "status": item["status"],
                "required_status": "documented",
                "critical": item["critical"],
            })

    return {
        "template_version": READINESS_TEMPLATE_VERSION,
        "preliminary_ugt": preliminary_ugt,
        "completion_pct": _round_pct(completion_score),
        "evidence_pct": _round_pct(evidence_score),
        "confidence_pct": _round_pct(confidence_score),
        "latest_checkpoint": latest_checkpoint,
        "not_applicable_count": not_applicable_count,
        "dimension_scores": dimension_scores,
        "level_scores": level_scores,
        "blockers": blockers,
        "checkpoint_results": checkpoint_results,
    }


def template_payload() -> dict[str, Any]:
    return {
        "version": READINESS_TEMPLATE_VERSION,
        "answer_statuses": [
            {"value": value, "label": ANSWER_STATUS_LABELS[value], "score_pct": int(ANSWER_STATUS_SCORES.get(value, 0) * 100)}
            for value in ANSWER_STATUSES
        ],
        "evidence_statuses": [
            {"value": value, "label": EVIDENCE_STATUS_LABELS[value], "score_pct": int(EVIDENCE_STATUS_SCORES[value] * 100)}
            for value in EVIDENCE_STATUSES
        ],
        "dimensions": [{"value": value, "label": DIMENSION_LABELS[value]} for value in DIMENSIONS],
        "checkpoints": [
            {
                "code": item.code,
                "number": item.number,
                "ugt_level": item.ugt_level,
                "title": item.title,
                "explanation": item.explanation,
                "dimensions": list(item.dimensions),
                "critical": item.critical,
                "evidence": [
                    {"code": evidence.code, "title": evidence.title, "required": evidence.required}
                    for evidence in item.evidence
                ],
            }
            for item in READINESS_CHECKPOINTS
        ],
    }
