from __future__ import annotations

import re

from sqlalchemy import select

from app.core.deps import DBSession
from app.db.models import (
    AuditTrailEntry,
    Project,
    ProjectDocument,
    QuestionnaireResult,
    RagDocument,
)
from app.schemas import GeneratedDocumentOut

VARIABLE_RE = re.compile(r"\{\{(\w+)\}\}")

# Распределение бюджета по этапам для ТЭО (30/40/30 — по умолчанию)
BUDGET_STAGE_PERCENTS = (30, 40, 30)


def _resolve_variable(
    name: str,
    project: Project,
    questionnaire_results: list[QuestionnaireResult],
) -> str:
    name_lower = name.lower()

    project_fields = {
        "project_name": project.name,
        "project_description": project.description or "",
        "project_category": project.category or "",
        "target_level": str(project.target_level),
        "current_level": str(project.current_level),
        "project_status": project.status,
        "project_budget": str(project.budget) if project.budget else "",
    }

    if name_lower in project_fields:
        return project_fields[name_lower]

    # {{project_budget_percent_30}} / _40 / _30 → доля бюджета по этапу
    budget_match = re.match(r"project_budget_percent_(\d+)", name_lower)
    if budget_match and project.budget is not None:
        percent = int(budget_match.group(1))
        return f"{project.budget * percent / 100:,.2f}".replace(",", " ")

    level_match = re.match(r"level_(\d+)_(.+)", name_lower)
    if level_match:
        level_id = int(level_match.group(1))
        field = level_match.group(2)
        for qr in questionnaire_results:
            if qr.level_id == level_id:
                items = qr.checked_items
                if isinstance(items, dict):
                    items = items.get("items", [])
                if field == "percentage":
                    return f"{qr.percentage:.0f}%"
                if field == "items_count":
                    return str(len(items))
                if field == "items":
                    return "\n".join(f"- {item}" for item in items)
                if field.startswith("checked_"):
                    try:
                        idx = int(field.split("_", 1)[1])
                        if idx < len(items):
                            return str(items[idx])
                    except (ValueError, IndexError):
                        pass

    return f"{{{{{name}}}}}"


async def generate_document(
    db: DBSession,
    project_id: int,
    doc_type: str,
    user_id: int | None = None,
) -> GeneratedDocumentOut:
    project = await db.get(Project, project_id)
    if project is None:
        raise ValueError("Проект не найден")

    qr_stmt = select(QuestionnaireResult).where(
        QuestionnaireResult.project_id == project_id
    )
    qr_rows = await db.execute(qr_stmt)
    questionnaire_results = list(qr_rows.scalars().all())

    tmpl_stmt = select(RagDocument).where(
        RagDocument.doc_type == doc_type,
        RagDocument.raw_text.isnot(None),
    ).order_by(RagDocument.updated_at.desc())
    tmpl_rows = await db.execute(tmpl_stmt)
    templates = list(tmpl_rows.scalars().all())

    if not templates:
        raise ValueError(f"Шаблон типа '{doc_type}' не найден в RAG-базе")

    template = templates[0]
    content = template.raw_text
    variables: dict[str, str] = {}

    for match in VARIABLE_RE.finditer(content):
        var_name = match.group(1)
        if var_name not in variables:
            resolved = _resolve_variable(var_name, project, questionnaire_results)
            variables[var_name] = resolved

    for var_name, value in variables.items():
        content = content.replace(f"{{{{{var_name}}}}}", value)

    title_map = {
        "tz": "Техническое задание",
        "passport": "Паспорт проекта",
        "teo": "Технико-экономическое обоснование",
    }

    # Сохраняем сгенерированный документ в реестр документов проекта + аудит
    document = ProjectDocument(
        project_id=project_id,
        title=title_map.get(doc_type, doc_type),
        doc_type=doc_type,
        status="draft",
        version=1,
        uploaded_by=user_id,
    )
    db.add(document)
    db.add(
        AuditTrailEntry(
            project_id=project_id,
            user_id=user_id,
            action="document.generated",
            details={"doc_type": doc_type, "template_id": template.id},
        )
    )
    await db.commit()
    await db.refresh(document)

    return GeneratedDocumentOut(
        doc_type=doc_type,
        title=title_map.get(doc_type, doc_type),
        content=content,
        template_id=template.id,
        variables=variables,
        document_id=document.id,
    )
