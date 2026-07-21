from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class RoleOut(BaseModel):
    role_no: int
    slug: str
    name: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    organization: str | None = None
    role_slug: str = Field(description="slug одной из 9 ролей, например 'gk_customer'")


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    organization: str | None = None
    is_active: bool
    roles: list[RoleOut]


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ─── Project & Questionnaire ─────────────────────────────────────────────────

class ProjectOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    category: str | None = None
    target_level: int = 9
    current_level: int = 0
    status: str = "draft"
    budget: float | None = None
    created_by: int | None = None
    created_at: str | None = None
    updated_at: str | None = None


class QuestionnaireResultIn(BaseModel):
    project_id: int
    level_id: int
    checked_items: list[str] = []
    percentage: float = 0.0


class QuestionnaireResultOut(BaseModel):
    id: int
    project_id: int
    level_id: int
    checked_items: list
    percentage: float
    created_at: str | None = None
    updated_at: str | None = None


class ControlPointOut(BaseModel):
    id: int
    project_id: int
    title: str
    description: str | None = None
    point_type: str = "gate"
    status: str = "pending"
    decision: str | None = None
    decided_by: int | None = None
    decided_at: str | None = None
    created_at: str | None = None


class ProjectDocumentOut(BaseModel):
    id: int
    project_id: int
    title: str
    doc_type: str
    file_url: str | None = None
    status: str = "draft"
    version: int = 1
    uploaded_by: int | None = None
    created_at: str | None = None
    updated_at: str | None = None


class ProjectMemberOut(BaseModel):
    id: int
    project_id: int
    user_id: int
    role_in_project: str
    joined_at: str | None = None


class AuditTrailEntryOut(BaseModel):
    id: int
    project_id: int
    user_id: int | None = None
    action: str
    details: dict = {}
    created_at: str | None = None


class ProjectDetailOut(BaseModel):
    project: ProjectOut
    questionnaire_results: list[QuestionnaireResultOut] = []
    control_points: list[ControlPointOut] = []
    documents: list[ProjectDocumentOut] = []
    members: list[ProjectMemberOut] = []
    audit_trail: list[AuditTrailEntryOut] = []


# ─── RAG ─────────────────────────────────────────────────────────────────────


class RagDocumentOut(BaseModel):
    id: int
    title: str
    doc_type: str
    ugt_level: int | None = None
    raw_text: str
    source_uri: str | None = None
    template_metadata: dict = {}
    created_at: str | None = None


class RagDocumentIn(BaseModel):
    title: str
    doc_type: str
    ugt_level: int | None = None
    raw_text: str
    source_uri: str | None = None
    template_metadata: dict = {}


class RagSearchIn(BaseModel):
    query: str
    doc_type: str | None = None
    ugt_level: int | None = None
    top_k: int = 5


class RagSearchResult(BaseModel):
    document: RagDocumentOut
    similarity: float


# ─── Document Generation ─────────────────────────────────────────────────────


class GeneratedDocumentOut(BaseModel):
    doc_type: str
    title: str
    content: str
    template_id: int | None = None
    variables: dict[str, str] = {}


# ─── Executors & Technologies (Реестры) ──────────────────────────────────────


class ExecutorOut(BaseModel):
    id: int
    full_name: str
    organization: str | None = None
    role_slug: str
    role_name: str
    competencies: list[str] = []
    completed_projects: int = 0


class TechnologyOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    category: str | None = None
    status: str
    current_level: int
    target_level: int
    organization: str | None = None
    created_by_name: str | None = None
    created_at: str | None = None


# ─── AI Assistant (Чат) ──────────────────────────────────────────────────────


class ChatIn(BaseModel):
    message: str
    history: list[dict] = []


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatOut(BaseModel):
    reply: ChatMessage
    sources: list[RagDocumentOut] = []
