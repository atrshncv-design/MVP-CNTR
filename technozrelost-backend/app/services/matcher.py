"""Детерминированный объяснимый matcher технологических запросов (тикет 03).

Чистые функции БЕЗ LLM и БЕЗ доступа к БД: на вход — структурированные
признаки запроса и кандидата, на выход — баллы, разбивка и человекочитаемые
объяснения на русском. Одинаковые входные данные всегда дают одинаковые
баллы и одинаковый порядок (стабильная сортировка с tie-break по id).

Признаки (веса фиксированы константами, сумма = 100):
- отрасль/направление (совпадение категорий)       — 25
- УГТ (близость уровней: |Δ| ≤ 2)                  — 20
- компетенции (пересечение множеств)               — 20
- регион (совпадение)                              — 10
- оборудование (пересечение множеств)              — 10
- опыт (пороговые: project_count ≥ min_experience) — 10
- тип участника (совместимость роли исполнителя)   —  5

Зафиксированные решения тикета 03 (см. также docstring tech_requests.py):
1. Закрытые поля запроса (budget/demand) НЕ участвуют в скоринге (у кандидатов
   в модели данных нет сопоставимых полей) и НЕ попадают в выдачу кандидатов
   ни для какого субъекта — «закрытые поля не участвуют» выполнено строго.
2. Компоненты, для которых в запросе нет структурированного источника
   (компетенции/оборудование/порог опыта), оцениваются в 0 баллов с
   объяснением «не указано» и не штрафуют кандидата (нет данных — не минус).
3. Пул кандидатов — активные пользователи с ролями исполнителя
   (rd_executor / scientific_org / serial_manufacturer), как в каталоге
   исполнителей (EXECUTOR_ROLE_SLUGS в executors.py).
"""

from __future__ import annotations

from dataclasses import dataclass, field

# ── Фиксированные веса компонентов (сумма = 100) ────────────────────────────

W_INDUSTRY = 25.0
W_UGT = 20.0
W_COMPETENCIES = 20.0
W_REGION = 10.0
W_EQUIPMENT = 10.0
W_EXPERIENCE = 10.0
W_PARTICIPANT = 5.0

# |Δ| уровней УГТ, при котором компонент ещё даёт баллы (иначе 0).
UGT_DELTA_LIMIT = 2
# Полное пересечение множеств для 100% компонента.
COMPETENCY_FULL_OVERLAP = 3
EQUIPMENT_FULL_OVERLAP = 2

# Роли исполнителя: полностью и частично совместимые типы участника.
EXECUTOR_ROLES = frozenset({"rd_executor", "scientific_org"})
PARTIAL_EXECUTOR_ROLES = frozenset({"serial_manufacturer"})
# Пул кандидатов (совпадает с каталогом исполнителей executors.py).
CANDIDATE_POOL_ROLES = frozenset({"rd_executor", "scientific_org", "serial_manufacturer"})

ROLE_DISPLAY_NAMES = {
    "rd_executor": "R&D-исполнитель",
    "scientific_org": "Научная организация (ВУЗ/НИИ)",
    "serial_manufacturer": "Серийный производитель",
}


def participant_type_names(roles: tuple[str, ...]) -> list[str]:
    """Человекочитаемые названия ролей кандидата (для краткого профиля)."""
    return [ROLE_DISPLAY_NAMES[r] for r in roles if r in ROLE_DISPLAY_NAMES]


@dataclass(frozen=True)
class RequestFeatures:
    """Структурированные признаки запроса для matcher (строит роутер)."""

    category: str | None = None  # отрасль/направление запроса
    target_ugt: int | None = None  # целевой УГТ запроса
    competencies: frozenset[str] = field(default_factory=frozenset)
    region: str | None = None
    equipment: frozenset[str] = field(default_factory=frozenset)
    min_experience: int | None = None  # порог опыта (число проектов)


@dataclass(frozen=True)
class CandidateProfile:
    """Профиль кандидата-исполнителя для matcher (строит роутер).

    Содержит только данные, разрешённые к выдаче: контакты (email, ogrn)
    и закрытые поля запроса в профиль не попадают.
    """

    user_id: int
    full_name: str
    roles: tuple[str, ...] = ()
    headline: str | None = None
    region: str | None = None
    competencies: frozenset[str] = field(default_factory=frozenset)
    categories: frozenset[str] = field(default_factory=frozenset)
    ugt_levels: tuple[int, ...] = ()
    equipment: frozenset[str] = field(default_factory=frozenset)
    project_count: int = 0
    organization_name: str | None = None
    organization_type: str | None = None


@dataclass(frozen=True)
class MatcherScore:
    """Итоговый балл и разбивка по компонентам (0..100)."""

    total: float
    breakdown: dict[str, float]


@dataclass(frozen=True)
class RankedCandidate:
    """Кандидат с баллом и объяснением (результат rank)."""

    candidate: CandidateProfile
    score: MatcherScore
    explanation: list[str]


def _norm(value: str) -> str:
    return value.strip().casefold()


def _norm_set(values: set[str] | frozenset[str]) -> frozenset[str]:
    return frozenset(v.strip().casefold() for v in values if v and v.strip())


def score_candidate(request: RequestFeatures, candidate: CandidateProfile) -> MatcherScore:
    """Детерминированные баллы кандидата по признакам запроса.

    Каждый компонент считается независимо; отсутствие данных в запросе
    даёт 0 баллов компонента (с объяснением), отсутствие данных кандидата —
    тоже 0, но не штрафует остальные компоненты.
    """
    breakdown: dict[str, float] = {}

    # Отрасль/направление: совпадение категорий (casefold).
    req_category = _norm(request.category) if request.category else ""
    cand_categories = _norm_set(candidate.categories)
    if not req_category:
        breakdown["industry"] = 0.0
    elif req_category in cand_categories:
        breakdown["industry"] = W_INDUSTRY
    else:
        breakdown["industry"] = 0.0

    # УГТ: близость уровней |Δ| ≤ 2 (уровень кандидата = max по проектам).
    target = request.target_ugt
    levels = tuple(int(level) for level in candidate.ugt_levels if level)
    best = max(levels) if levels else None
    if target is None or best is None:
        breakdown["ugt"] = 0.0
    else:
        delta = abs(target - best)
        if delta == 0:
            breakdown["ugt"] = W_UGT
        elif delta <= UGT_DELTA_LIMIT:
            breakdown["ugt"] = round(W_UGT - 5.0 * delta, 1)  # Δ1 → 15, Δ2 → 10
        else:
            breakdown["ugt"] = 0.0

    # Компетенции: пересечение множеств (насыщение на 3+ совпадениях).
    req_comp = _norm_set(request.competencies)
    cand_comp = _norm_set(candidate.competencies)
    overlap_comp = len(req_comp & cand_comp)
    if not req_comp:
        breakdown["competencies"] = 0.0
    else:
        breakdown["competencies"] = round(
            W_COMPETENCIES
            * min(overlap_comp, COMPETENCY_FULL_OVERLAP)
            / COMPETENCY_FULL_OVERLAP,
            1,
        )

    # Регион: совпадение.
    req_region = _norm(request.region) if request.region else ""
    cand_region = _norm(candidate.region) if candidate.region else ""
    if req_region and cand_region and req_region == cand_region:
        breakdown["region"] = W_REGION
    else:
        breakdown["region"] = 0.0

    # Оборудование: пересечение множеств (насыщение на 2+ совпадениях).
    req_eq = _norm_set(request.equipment)
    cand_eq = _norm_set(candidate.equipment)
    overlap_eq = len(req_eq & cand_eq)
    if not req_eq:
        breakdown["equipment"] = 0.0
    else:
        breakdown["equipment"] = round(
            W_EQUIPMENT * min(overlap_eq, EQUIPMENT_FULL_OVERLAP) / EQUIPMENT_FULL_OVERLAP,
            1,
        )

    # Опыт: пороговое условие (число проектов кандидата ≥ порога запроса).
    if request.min_experience is None:
        breakdown["experience"] = 0.0
    elif candidate.project_count >= request.min_experience:
        breakdown["experience"] = W_EXPERIENCE
    else:
        breakdown["experience"] = 0.0

    # Тип участника: совместимость роли исполнителя.
    roles = frozenset(candidate.roles)
    if roles & EXECUTOR_ROLES:
        breakdown["participant"] = W_PARTICIPANT
    elif roles & PARTIAL_EXECUTOR_ROLES:
        breakdown["participant"] = round(W_PARTICIPANT / 2, 1)
    else:
        breakdown["participant"] = 0.0

    return MatcherScore(total=round(sum(breakdown.values()), 1), breakdown=breakdown)


def explain(
    request: RequestFeatures, candidate: CandidateProfile, score: MatcherScore
) -> list[str]:
    """Человекочитаемые причины на русском (по одному пункту на компонент)."""
    reasons: list[str] = []

    req_category = _norm(request.category) if request.category else ""
    cand_categories = _norm_set(candidate.categories)
    if not req_category:
        reasons.append("Направление запроса не указано — отрасль не оценивается (+0)")
    elif req_category in cand_categories:
        reasons.append(
            f"Совпадает отрасль/направление: «{request.category}» "
            f"(+{score.breakdown['industry']:g})"
        )
    else:
        reasons.append(
            f"Направление кандидата не совпадает с запросом «{request.category}» (+0)"
        )

    target = request.target_ugt
    levels = tuple(int(level) for level in candidate.ugt_levels if level)
    best = max(levels) if levels else None
    if target is None:
        reasons.append("УГТ в запросе не указан — близость уровней не оценивается (+0)")
    elif best is None:
        reasons.append("У кандидата нет проектов с уровнем УГТ (+0)")
    else:
        delta = abs(target - best)
        if delta == 0:
            reasons.append(f"УГТ совпадает: {best} (+{score.breakdown['ugt']:g})")
        elif delta <= UGT_DELTA_LIMIT:
            reasons.append(
                f"УГТ {best} vs запрос {target} (Δ{delta}) "
                f"(+{score.breakdown['ugt']:g})"
            )
        else:
            reasons.append(
                f"УГТ {best} vs запрос {target} (Δ{delta} > {UGT_DELTA_LIMIT}) — "
                f"вне диапазона (+0)"
            )

    req_comp = _norm_set(request.competencies)
    cand_comp = _norm_set(candidate.competencies)
    if not req_comp:
        reasons.append("Требуемые компетенции в запросе не указаны (+0)")
    else:
        overlap = req_comp & cand_comp
        if overlap:
            listed = ", ".join(sorted(overlap))
            reasons.append(
                f"Пересечение компетенций: {listed} (+{score.breakdown['competencies']:g})"
            )
        else:
            reasons.append("Компетенции кандидата не пересекаются с запросом (+0)")

    req_region = _norm(request.region) if request.region else ""
    cand_region = _norm(candidate.region) if candidate.region else ""
    if not req_region:
        reasons.append("Регион запроса не указан (+0)")
    elif not cand_region:
        reasons.append("Регион кандидата не указан (+0)")
    elif req_region == cand_region:
        reasons.append(f"Регион совпадает: «{candidate.region}» (+{W_REGION:g})")
    else:
        reasons.append(
            f"Регион не совпадает: «{candidate.region}» vs «{request.region}» (+0)"
        )

    req_eq = _norm_set(request.equipment)
    cand_eq = _norm_set(candidate.equipment)
    if not req_eq:
        reasons.append("Оборудование в запросе не указано (+0)")
    else:
        overlap = req_eq & cand_eq
        if overlap:
            listed = ", ".join(sorted(overlap))
            reasons.append(
                f"Пересечение оборудования: {listed} (+{score.breakdown['equipment']:g})"
            )
        else:
            reasons.append("Оборудование кандидата не пересекается с запросом (+0)")

    if request.min_experience is None:
        reasons.append("Порог опыта в запросе не указан (+0)")
    elif candidate.project_count >= request.min_experience:
        reasons.append(
            f"Опыт: {candidate.project_count} проект(ов) ≥ порога "
            f"{request.min_experience} (+{W_EXPERIENCE:g})"
        )
    else:
        reasons.append(
            f"Опыт: {candidate.project_count} проект(ов) < порога "
            f"{request.min_experience} (+0)"
        )

    roles = frozenset(candidate.roles)
    names = participant_type_names(candidate.roles)
    if roles & EXECUTOR_ROLES:
        reasons.append(
            f"Совместимый тип участника: {', '.join(names)} "
            f"(+{score.breakdown['participant']:g})"
        )
    elif roles & PARTIAL_EXECUTOR_ROLES:
        reasons.append(
            f"Частично совместимый тип участника: {', '.join(names)} "
            f"(+{score.breakdown['participant']:g})"
        )
    else:
        reasons.append("Тип участника не совместим с ролью исполнителя (+0)")

    reasons.append(f"Итого: {score.total:g} из 100")
    return reasons


def rank(
    candidates: list[CandidateProfile], request: RequestFeatures
) -> list[RankedCandidate]:
    """Ранжирование: стабильная сортировка по баллам, tie-break по id.

    Порядок детерминирован: (балл по убыванию, user_id по возрастанию) —
    повторные вызовы на тех же данных дают тот же список.
    """
    def _ranked(candidate: CandidateProfile) -> RankedCandidate:
        score = score_candidate(request, candidate)
        return RankedCandidate(
            candidate=candidate,
            score=score,
            explanation=explain(request, candidate, score),
        )

    ranked = [_ranked(candidate) for candidate in candidates]
    return sorted(
        ranked,
        key=lambda entry: (-entry.score.total, entry.candidate.user_id),
    )
