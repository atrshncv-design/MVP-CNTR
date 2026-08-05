from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


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
    refresh_token: str | None = None
    token_type: str = "bearer"
    user: UserOut


class RefreshTokenIn(BaseModel):
    refresh_token: str = Field(
        min_length=1, description="Refresh-токен из пары при логине/обновлении"
    )


class UserUpdateIn(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    organization: str | None = Field(default=None, max_length=255)


class PasswordChangeIn(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=128)


class UserAdminOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    organization: str | None = None
    is_active: bool
    roles: list[RoleOut]
    created_at: str | None = None


class UserRoleUpdateIn(BaseModel):
    roles: list[str] = []
    is_active: bool | None = None


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
    join_token: str | None = None
    created_by: int | None = None
    created_at: str | None = None
    updated_at: str | None = None
    legal_owner: str | None = None
    rights_holder: str | None = None
    contract_number: str | None = None
    contract_basis: str | None = None
    legal_updated_by: int | None = None
    legal_updated_at: str | None = None
    control_points: list[ControlPointOut] = []
    verification_documents_count: int = 0


class QuestionnaireAnswerIn(BaseModel):
    """Ответы по одному уровню УГТ (без project_id — он известен из контекста)."""

    level_id: int
    checked_items: list[str] = []
    percentage: float = 0.0


class ProjectCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category: str | None = None
    target_level: int = Field(default=9, ge=1, le=9)
    budget: float | None = Field(default=None, ge=0)
    questionnaire_results: list[QuestionnaireAnswerIn] = []


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


class ReadinessEvidenceIn(BaseModel):
    evidence_code: str = Field(min_length=1, max_length=64)
    status: Literal["missing", "draft", "ready", "verified"] = "missing"


class ReadinessAnswerIn(BaseModel):
    checkpoint_code: str = Field(min_length=3, max_length=16)
    status: Literal[
        "not_started",
        "in_progress",
        "formed",
        "documented",
        "verified",
        "not_applicable",
    ] = "not_started"
    applicable: bool = True
    comment: str | None = Field(default=None, max_length=2000)
    evidence: list[ReadinessEvidenceIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def require_not_applicable_reason(self) -> ReadinessAnswerIn:
        if self.status == "not_applicable" and not (self.comment or "").strip():
            raise ValueError("Для ответа «Неприменимо» нужно указать обоснование.")
        return self


class ReadinessResultOut(BaseModel):
    template_version: str
    preliminary_ugt: int
    completion_pct: float
    evidence_pct: float
    confidence_pct: float
    latest_checkpoint: int
    not_applicable_count: int
    dimension_scores: dict[str, float] = {}
    level_scores: list[dict] = []
    blockers: list[dict] = []
    checkpoint_results: list[dict] = []


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


class ControlPointDecisionIn(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")
    decision: str | None = Field(default=None, max_length=255)


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
    status: str = "active"
    invited_by: int | None = None
    is_priority: bool = False
    joined_at: str | None = None


class JoinRequestOut(BaseModel):
    """Заявка на вступление (или участник) для очереди модерации."""

    id: int
    user_id: int
    user_name: str
    user_email: str
    role_in_project: str
    status: str
    invited_by: int | None = None
    invited_by_name: str | None = None
    is_priority: bool = False
    joined_at: str | None = None


class JoinIn(BaseModel):
    token: str = Field(
        min_length=6, max_length=16, description="Join-токен проекта, напр. TZ-XXXXXX"
    )
    role_in_project: str = Field(default="participant", min_length=1, max_length=64)
    shared_by: int | None = Field(
        default=None,
        description="ID пользователя, чьей ссылкой вступают. None = ручной ввод токена.",
    )


class JoinResultOut(BaseModel):
    status: str  # active | pending
    project: ProjectOut


class JoinDecisionIn(BaseModel):
    approve: bool
    role_in_project: str | None = None


class RegenerateTokenOut(BaseModel):
    join_token: str


class MemberPriorityIn(BaseModel):
    is_priority: bool


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
    verification_documents: list[VerificationDocOut] = []
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
    document_id: int | None = None


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


# ─── Новое ядро (тикеты 20-25) ───────────────────────────────────────────────


class AssessmentIn(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    category: str | None = Field(default=None, max_length=100)
    target_level: int = Field(default=9, ge=1, le=9)
    questionnaire_results: list[QuestionnaireAnswerIn] = Field(default_factory=list)
    answers: list[ReadinessAnswerIn] = Field(default_factory=list)
    template_version: str | None = Field(default=None, max_length=64)


class DraftProjectOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    category: str | None = None
    preliminary_level: int | None = None
    current_level: int = 0
    target_level: int = 9
    status: str
    rejection_reason: str | None = None
    created_at: str | None = None
    questionnaire_results: list[QuestionnaireResultOut] = []
    readiness_result: ReadinessResultOut | None = None
    assessment_version: str | None = None


class DraftDecisionIn(BaseModel):
    approve: bool
    level: int | None = Field(default=None, ge=1, le=9)
    reason: str | None = Field(default=None, max_length=500)


class PromotionRequestOut(BaseModel):
    id: int
    project_id: int
    project_name: str
    from_level: int
    to_level: int
    status: str
    rejection_reason: str | None = None
    attempt_no: int = 1
    evaluation_result: dict = {}
    created_at: str | None = None
    stage_docs: list[dict] = []
    verification_docs: list[dict] = []


class PromotionDecisionIn(BaseModel):
    approve: bool
    reason: str | None = Field(default=None, max_length=500)
    missing: list[str] = Field(default_factory=list, max_length=20)


class StageRequirementOut(BaseModel):
    id: int
    from_level: int
    to_level: int
    title: str
    description: str
    template_version: str = "v1"
    uploaded: bool = False


class StageDocumentIn(BaseModel):
    stage_requirement_id: int
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=20000)


class StageEvaluateOut(BaseModel):
    request_id: int | None = None
    success: bool | None = None  # None = LLM unavailable
    missing: list[str] = []
    summary: str = ""


class VerificationDocIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    comment: str | None = None
    file_ref: str | None = None


class VerificationDocOut(BaseModel):
    id: int
    project_id: int
    uploader_id: int
    uploader_name: str | None = None
    title: str
    comment: str | None = None
    file_ref: str | None = None
    created_at: str | None = None


class RegistryProjectOut(BaseModel):
    id: int
    name: str
    category: str | None = None
    current_level: int = 0
    preliminary_level: int | None = None
    target_level: int = 9
    budget: float | None = None
    organization: str | None = None
    created_at: str | None = None


class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    payload: dict = {}
    is_read: bool = False
    created_at: str | None = None


# ─── НИОКТР-реестр (тикеты 01-07) ────────────────────────────────────────────


class NioktrCardOut(BaseModel):
    id: int
    registration_number: str
    name: str
    annotation: str | None = None
    keywords: list = []
    nioktr_types: list = []
    state_program: str | None = None
    federal_program: str | None = None
    created_date: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_ai_area: bool = False
    is_ai_usage: bool = False
    executor_name: str | None = None
    executor_short_name: str | None = None
    executor_ogrn: str | None = None
    executor_territory: str | None = None
    customer_name: str | None = None
    budgets: list = []
    organization_id: int | None = None
    created_at: str | None = None


class OrgCardOut(BaseModel):
    id: int
    name: str
    short_name: str | None = None
    ogrn: str | None = None
    org_type: str | None = None
    competencies: list = []
    projects_count: int = 0
    region: str | None = None


class OrganizationDetailOut(OrgCardOut):
    nioktr_cards: list[NioktrCardOut] = []


# ── Тикет 03 Friday RC: профили, организации, членство ──────────────────────

PROFILE_STATES = ("draft", "pending", "verified", "rejected")
ORG_STATES = PROFILE_STATES


class ProfileIn(BaseModel):
    headline: str | None = Field(default=None, max_length=255)
    bio: str | None = Field(default=None, max_length=5000)
    region: str | None = Field(default=None, max_length=128)
    skills: list[str] = []


class ProfileOut(BaseModel):
    id: int
    user_id: int
    headline: str | None = None
    bio: str | None = None
    region: str | None = None
    skills: list[str] = []
    state: str
    review_comment: str | None = None
    reviewed_at: str | None = None


class OrgIn(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    short_name: str | None = Field(default=None, max_length=255)
    ogrn: str | None = Field(default=None, max_length=32)
    org_type: str | None = Field(default=None, max_length=64)
    region: str | None = Field(default=None, max_length=128)
    description: str | None = Field(default=None, max_length=5000)


class OrgOut(BaseModel):
    id: int
    name: str
    short_name: str | None = None
    ogrn: str | None = None
    org_type: str | None = None
    region: str | None = None
    description: str | None = None
    state: str
    review_comment: str | None = None
    created_by: int
    member_role: str | None = None
    is_primary: bool = False


class ManagerDecideIn(BaseModel):
    action: Literal["verify", "reject"]
    comment: str = Field(min_length=1, max_length=2000)


class ProfileQueueOut(ProfileOut):
    full_name: str
    email: EmailStr
    role_slugs: list[str] = []


class OrgQueueOut(OrgOut):
    creator_name: str = ""


# ── Тикет 04 Friday RC: приглашения, project_admin, договорные поля ──────────


class InviteIn(BaseModel):
    invite_type: Literal["single", "bulk"] = "single"
    allowed_roles: list[str] = []
    max_uses: int = Field(default=1, ge=1, le=1000)
    expires_in_hours: int | None = Field(default=None, ge=1, le=2160)


class InviteOut(BaseModel):
    id: int
    project_id: int
    token: str
    invite_type: str
    allowed_roles: list[str] = []
    max_uses: int
    used_count: int
    expires_at: str | None = None
    revoked_at: str | None = None
    created_at: str | None = None


class InviteAcceptIn(BaseModel):
    token: str = Field(min_length=6, max_length=32)
    role_in_project: str = Field(default="participant", min_length=1, max_length=64)


class TransferAdminIn(BaseModel):
    user_id: int


class LegalIn(BaseModel):
    legal_owner: str | None = Field(default=None, max_length=2000)
    rights_holder: str | None = Field(default=None, max_length=2000)
    contract_number: str | None = Field(default=None, max_length=128)
    contract_basis: str | None = Field(default=None, max_length=2000)


class LegalOut(BaseModel):
    legal_owner: str | None = None
    rights_holder: str | None = None
    contract_number: str | None = None
    contract_basis: str | None = None
    legal_updated_by: int | None = None
    legal_updated_at: str | None = None


class DocumentFileOut(BaseModel):
    id: int
    project_id: int
    title: str
    doc_type: str
    file_name: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    sha256: str | None = None
    scan_status: str = "pending"
    scan_result: str | None = None
    version: int = 1
    uploaded_by: int | None = None
    created_at: str | None = None
