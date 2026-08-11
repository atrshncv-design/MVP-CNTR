from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class RoleOut(BaseModel):
    role_no: int
    slug: str
    name: str


# ─── Согласия и удаление (тикет 04) ─────────────────────────────────────────

class ConsentAcceptIn(BaseModel):
    """Принятие версии согласия (обязательные: terms/privacy; остальные — опциональные)."""

    slug: str = Field(min_length=1, max_length=64)
    version: int = Field(ge=1, description="Номер версии документа")
    accepted: bool = True


class ConsentVersionOut(BaseModel):
    """Публичный каталог версий (GET /consents) с пометкой черновика."""

    id: int
    slug: str
    version: int
    title: str | None
    text: str
    is_draft: bool
    published_at: str | None = None


class ConsentMineOut(BaseModel):
    """Статус согласия пользователя (GET /consents/mine)."""

    id: int
    slug: str
    version: int
    title: str | None
    is_draft: bool
    required: bool
    accepted: bool
    accepted_at: str | None = None
    pending: bool


class ConsentAcceptOut(BaseModel):
    slug: str
    version: int
    accepted: bool = True
    accepted_at: str


class DeletionRequestOut(BaseModel):
    id: int
    user_id: int
    requested_at: str
    processed_at: str | None = None
    state: str
    requested_by: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    organization: str | None = None
    role_slug: str = Field(description="slug одной из 9 ролей, например 'gk_customer'")
    consents: list[ConsentAcceptIn] = Field(
        default_factory=list,
        description=(
            "Принятие обязательных согласий (тикет 04): terms и privacy с "
            "актуальной версией; без принятия обязательных — 400"
        ),
    )


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    organization: str | None = None
    is_active: bool
    status: str = "unverified"
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


class VerifyEmailIn(BaseModel):
    token: str = Field(min_length=1, description="Одноразовый verification-токен из письма")


class ResendVerificationIn(BaseModel):
    email: EmailStr


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=1, description="Одноразовый reset-токен из письма")
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=128)


# ─── MFA (тикет 02) ──────────────────────────────────────────────────────────

class MfaLoginOut(BaseModel):
    """Ответ login-а при включённой MFA: токены НЕ выдаются, нужен challenge."""

    mfa_required: bool = True
    challenge_token: str


class MfaEnrollOut(BaseModel):
    """Секрет TOTP выдаётся ОДИН раз (до confirm); после — 409/не возвращается."""

    secret: str
    otpauth_url: str


class MfaConfirmIn(BaseModel):
    code: str = Field(min_length=6, max_length=6, description="6-значный TOTP-код")


class MfaDisableIn(BaseModel):
    code: str = Field(min_length=6, max_length=6, description="6-значный TOTP-код")


class MfaVerifyIn(BaseModel):
    challenge_token: str = Field(min_length=1)
    code: str = Field(min_length=6, max_length=10, description="TOTP-код или recovery-код")


class MfaRecoveryCodesIn(BaseModel):
    code: str = Field(min_length=6, max_length=6, description="6-значный TOTP-код")


class MfaRecoveryCodesOut(BaseModel):
    recovery_codes: list[str]


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
    status: str = "unverified"
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
    is_public: bool = False
    show_preliminary: bool = False


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
    project_id: int | None = None
    user_id: int | None = None
    user_name: str | None = None
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
    # Редакционный workflow (тикет 01 ai-rag)
    status: str = "draft"
    version: int = 1
    source_type: str = "doc"
    is_ai_reviewed: bool = False
    published_by: int | None = None
    published_at: str | None = None
    reviewed_by: int | None = None
    reviewed_at: str | None = None
    retired_at: str | None = None
    created_at: str | None = None


class RagDocumentIn(BaseModel):
    title: str
    doc_type: str
    ugt_level: int | None = None
    raw_text: str
    source_uri: str | None = None
    template_metadata: dict = {}
    source_type: str | None = None  # gov | doc | center | manual | ... (default 'doc')


class RagSearchIn(BaseModel):
    # extra="forbid": явный guard — поиск по базе знаний НЕ принимает project_id
    # и любые пользовательские контексты (проекты/файлы/чаты не индексируются).
    model_config = ConfigDict(extra="forbid")

    query: str
    doc_type: str | None = None
    ugt_level: int | None = None
    top_k: int = 5


class RagSearchResult(BaseModel):
    document: RagDocumentOut
    similarity: float


class RagRetireIn(BaseModel):
    reason: str | None = None


# ─── Публичный RAG-консультант (тикет 02 ai-rag) ───────────────────────────


class RagConsultantIn(BaseModel):
    # extra="forbid": публичный консультант НЕ принимает пользовательский контекст
    # (project_id, файлы, чаты) — только вопрос и опциональный session_id.
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1, max_length=2000)
    session_id: str | None = Field(default=None, max_length=128)


class RagSourceOut(BaseModel):
    """Использованный утверждённый источник ответа консультанта."""

    title: str
    source_uri: str | None = None
    source_type: str = "doc"
    version: int = 1


class RagConsultantOut(BaseModel):
    reply: str
    sources: list[RagSourceOut] = []
    refused: bool = False


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
    competencies: list[str] = []
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
    is_public: bool = False
    show_preliminary: bool = False
    published_at: str | None = None
    created_at: str | None = None


class PublishIn(BaseModel):
    is_public: bool
    show_preliminary: bool = False


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
    source: str = "МИНОБРНАУКИ России"
    imported_at: str | None = None


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
    inn: str | None = Field(default=None, min_length=10, max_length=12)
    ogrn: str | None = Field(default=None, max_length=32)
    kpp: str | None = Field(default=None, max_length=9)
    org_type: str | None = Field(default=None, max_length=64)
    region: str | None = Field(default=None, max_length=128)
    description: str | None = Field(default=None, max_length=5000)
    contacts: list[dict] = []


class OrgCardIn(BaseModel):
    """Создание карточки организации по ИНН (тикет 03 identity-organizations)."""

    name: str = Field(min_length=1, max_length=500)
    short_name: str | None = Field(default=None, max_length=255)
    inn: str = Field(min_length=10, max_length=12)
    ogrn: str | None = Field(default=None, max_length=32)
    kpp: str | None = Field(default=None, max_length=9)
    org_type: str | None = Field(default=None, max_length=64)
    region: str | None = Field(default=None, max_length=128)
    description: str | None = Field(default=None, max_length=5000)
    contacts: list[dict] = []


class OrgVerifyIn(BaseModel):
    """Ручная верификация карточки менеджером Центра (тикет 03)."""

    decision: Literal["verified", "rejected"]
    internal_comment: str | None = Field(default=None, max_length=2000)


class OrgCardPublicOut(BaseModel):
    """Публичное представление карточки организации по ИНН (тикет 03).

    Поля, помеченные staff-only, возвращаются None для не-сотрудников Центра
    (internal_comment/review_comment, verification_decision, reviewed_by/at,
    created_by — внутренние, не публикуются).
    """

    id: int
    name: str
    short_name: str | None = None
    inn: str | None = None
    ogrn: str | None = None
    kpp: str | None = None
    org_type: str | None = None
    region: str | None = None
    description: str | None = None
    contacts: list[dict] = []
    state: str
    created_at: str | None = None
    member_role: str | None = None
    is_primary: bool = False
    # staff-only:
    review_comment: str | None = None
    verification_decision: str | None = None
    reviewed_by: int | None = None
    reviewed_at: str | None = None
    created_by: int | None = None


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


class RequestOut(BaseModel):
    id: int
    from_level: int
    to_level: int
    status: str
    attempt_no: int
    rejection_reason: str | None = None
    created_at: str | None = None
    comments_count: int = 0


class ManagerTaskOut(BaseModel):
    id: int
    type: str
    title: str
    status: str
    manager_name: str | None = None
    project_id: int | None = None
    created_at: str | None = None


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class CommentOut(BaseModel):
    id: int
    author_id: int
    author_name: str
    body: str
    created_at: str | None = None


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


# ── Тикет 01 requests-matching: черновик технологического запроса ───────────


class TechRequestIn(BaseModel):
    """Создание черновика технологического запроса (только verified представитель)."""

    organization_id: int
    title: str = Field(min_length=1, max_length=255)
    requirements: str = Field(min_length=1, max_length=20000)
    demand: str | None = Field(default=None, max_length=20000)
    deadline: datetime
    budget: float | None = Field(default=None, ge=0)


class TechRequestPatch(BaseModel):
    """Частичное редактирование черновика (только создатель, status=draft).

    Тикет 02: опциональный visibility — смена режима после approved
    переводит запрос на повторную модерацию (pending + лог visibility_changed).
    """

    title: str | None = Field(default=None, min_length=1, max_length=255)
    requirements: str | None = Field(default=None, min_length=1, max_length=20000)
    demand: str | None = Field(default=None, max_length=20000)
    deadline: datetime | None = None
    budget: float | None = Field(default=None, ge=0)
    visibility: Literal["public", "platform", "private"] | None = None


class TechRequestModerateIn(BaseModel):
    """Решение менеджера по запросу (тикет 02): approve/reject + причина."""

    approve: bool
    reason: str = Field(min_length=1, max_length=2000)


class TechRequestDocumentOut(BaseModel):
    id: int
    request_id: int
    title: str
    file_name: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    sha256: str | None = None
    scan_status: str = "pending"
    version: int = 1
    uploaded_by: int | None = None
    created_at: str | None = None


class StageCreateIn(BaseModel):
    """Создание этапа сопровождения (тикет 01 operations-modules)."""

    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    from_level: int | None = Field(default=None, ge=0, le=9)
    to_level: int | None = Field(default=None, ge=1, le=9)
    responsible_id: int | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    plan_result: dict = Field(default_factory=dict)


class StageUpdateIn(BaseModel):
    """Частичное обновление этапа: применяются только переданные поля."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    status: Literal["planned", "in_progress", "completed"] | None = None
    responsible_id: int | None = None
    planned_start_date: date | None = None
    planned_end_date: date | None = None
    actual_start_date: date | None = None
    actual_end_date: date | None = None
    plan_result: dict | None = None
    fact_result: dict | None = None


class StageProgressOut(BaseModel):
    """Детерминированный расчёт: статус, просрочки, прогресс (без LLM)."""

    status: str
    overdue: bool
    overdue_days: int
    progress_pct: float
    tasks_total: int
    tasks_done: int
    tasks_overdue: int
    checkpoints_total: int
    checkpoints_done: int
    checkpoints_overdue: int


class StageTaskOut(BaseModel):
    id: int
    stage_id: int
    title: str
    description: str | None = None
    status: str = "todo"
    assignee_id: int | None = None
    due_date: str | None = None
    completed_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class StageTaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    assignee_id: int | None = None
    due_date: date | None = None


class StageTaskUpdateIn(BaseModel):
    """Обновление задачи: статус может менять и исполнитель (своя задача)."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    status: Literal["todo", "in_progress", "done"] | None = None
    assignee_id: int | None = None
    due_date: date | None = None


class StageCheckpointOut(BaseModel):
    id: int
    stage_id: int
    project_id: int
    title: str
    description: str | None = None
    point_type: str = "milestone"
    status: str = "pending"
    decision: str | None = None
    decided_by: int | None = None
    decided_at: str | None = None
    due_date: str | None = None
    weight: int = 1
    created_at: str | None = None


class StageCheckpointIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    due_date: date | None = None
    weight: int = Field(default=1, ge=1, le=10)


class StageCheckpointDecideIn(BaseModel):
    status: Literal["approved", "rejected"]
    decision: str | None = Field(default=None, max_length=255)


class StageDocumentOut(BaseModel):
    """Документ-доказательство этапа (versioned; metadata без PII по ролям)."""

    id: int
    stage_id: int
    project_id: int
    title: str
    doc_type: str = "stage_evidence"
    version: int = 1
    file_url: str | None = None
    file_name: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    scan_status: str = "pending"
    status: str = "active"
    uploaded_by: int | None = None
    created_at: str | None = None


class TechRequestOut(BaseModel):
    id: int
    created_by: int
    organization_id: int
    organization_name: str | None = None
    title: str
    requirements: str
    demand: str | None = None
    deadline: str
    budget: float | None = None
    status: str
    visibility: str = "platform"
    moderation_status: str = "pending"
    moderated_by: int | None = None
    moderated_at: str | None = None
    moderation_reason: str | None = None
    version: int
    created_at: str | None = None
    updated_at: str | None = None
    documents: list[TechRequestDocumentOut] = []


class TechRequestPublicOut(BaseModel):
    """Карточка публичного реестра (тикет 02): approved + public/platform.

    Конфиденциальные поля (создатель, документы, контакты) не раскрываются;
    demand/budget/deadline — по режиму видимости (public — всем,
    platform — авторизованным).
    """

    id: int
    title: str
    requirements: str
    organization_name: str | None = None
    demand: str | None = None
    deadline: str
    budget: float | None = None
    created_at: str | None = None


class TechRequestPublicPage(BaseModel):
    """Страница публичного реестра с пагинацией."""

    items: list[TechRequestPublicOut]
    total: int
    limit: int
    offset: int


# ── Тикет 03 requests-matching: matcher и решения по кандидатам ─────────────


class TechRequestCandidateDecisionIn(BaseModel):
    """Решение менеджера/заказчика по кандидату (тикет 03).

    Повторное решение по той же паре (request_id, candidate_id) → 409:
    решение фиксируется, исходные данные кандидата/запроса не изменяются.
    """

    decision: Literal["shortlist", "reject"]
    note: str | None = Field(default=None, max_length=2000)


class TechRequestCandidateDecisionOut(BaseModel):
    id: int
    request_id: int
    candidate_id: int
    decision: str
    note: str | None = None
    decided_by: int
    created_at: str | None = None


class CandidateSummaryOut(BaseModel):
    """Краткий профиль кандидата — без контактов и лишнего PII.

    email/ogrn/контакты не раскрываются; бюджет/спрос запроса в выдаче
    кандидатов не участвуют ни для кого (закрытые поля запроса).
    """

    candidate_id: int
    full_name: str
    headline: str | None = None
    region: str | None = None
    organization_name: str | None = None
    organization_type: str | None = None
    participant_types: list[str] = []
    skills: list[str] = []
    categories: list[str] = []
    ugt_levels: list[int] = []
    project_count: int = 0


class RankedCandidateOut(BaseModel):
    """Кандидат с баллами, разбивкой и человекочитаемым объяснением (matcher)."""

    candidate: CandidateSummaryOut
    score: float
    breakdown: dict[str, float]
    explanation: list[str]


# ── Тикет 04 requests-matching: офферы, раскрытия, связанные проекты ─────────


class TechRequestOfferIn(BaseModel):
    """Создание обезличенного предложения кандидату (только staff).

    Предложение НЕ содержит контактов заказчика и закрытых полей запроса
    (budget/demand); кандидат видит только отрасль/направление/УГТ и
    краткое описание до момента approved-раскрытия.
    """

    candidate_id: int
    message: str | None = Field(default=None, max_length=2000)


class TechRequestOfferOut(BaseModel):
    """Полная карточка оффера (staff/создатель запроса)."""

    id: int
    request_id: int
    request_title: str | None = None
    candidate_id: int
    candidate_name: str | None = None
    status: str
    message: str | None = None
    offered_by: int
    created_at: str | None = None
    responded_at: str | None = None


class OfferRequestSummaryOut(BaseModel):
    """Обезличенная сводка запроса для кандидата (тикет 04).

    Только отрасль/направление (organization_type), целевой УГТ, регион и
    краткое описание — БЕЗ контактов заказчика и закрытых полей.
    """

    request_id: int
    title: str
    requirements: str
    organization_type: str | None = None
    target_ugt: int | None = None
    region: str | None = None


class OfferContactOut(BaseModel):
    """Контакты и полные данные запроса — только после approved раскрытия."""

    organization_name: str | None = None
    region: str | None = None
    creator_full_name: str | None = None
    creator_email: str | None = None
    demand: str | None = None
    budget: float | None = None
    deadline: str | None = None


class OfferMineOut(BaseModel):
    """Оффер в ленте кандидата: обезличенный до approved раскрытия.

    contacts заполняется ТОЛЬКО после решения staff/создателя
    (disclosure.status == approved); до этого — None.
    """

    id: int
    request_id: int
    status: str
    message: str | None = None
    created_at: str | None = None
    responded_at: str | None = None
    disclosure_status: str | None = None
    request: OfferRequestSummaryOut
    contacts: OfferContactOut | None = None


class TechRequestDisclosureIn(BaseModel):
    """Решение по запросу раскрытия (staff/создатель запроса).

    approved → контакты раскрываются кандидату; denied → причина обязательна.
    """

    approve: bool
    reason: str | None = Field(default=None, max_length=2000)


class TechRequestDisclosureOut(BaseModel):
    id: int
    offer_id: int
    request_id: int | None = None
    requested_by: int
    status: str
    decided_by: int | None = None
    decided_at: str | None = None
    reason: str | None = None
    created_at: str | None = None


# Поля проекта, наследуемые из запроса, и их источники в модели запроса.
OFFER_SELECTABLE_FIELDS: tuple[str, ...] = (
    "name",
    "description",
    "category",
    "target_level",
)
OFFER_SELECTABLE_FIELD_SOURCES: dict[str, str] = {
    "name": "title",
    "description": "requirements",
    "category": "org_type",
    "target_level": "target_ugt",
}


class TechRequestProjectIn(BaseModel):
    """Связь оффера с проектом (staff, после approved раскрытия ИЛИ решение менеджера).

    project_id — существующий проект (только связь + selected_fields) или
    None (создать новый проект, наследуя ТОЛЬКО выбранные поля).
    selected_fields ⊆ {name, description, category, target_level}.
    """

    project_id: int | None = None
    selected_fields: list[str] = Field(default_factory=list)


class TechRequestProjectOut(BaseModel):
    id: int
    request_id: int
    offer_id: int
    project_id: int
    project_name: str | None = None
    created_by: int
    selected_fields: list[str]
    created_at: str | None = None


# ── Тикет 05 requests-matching: AI-ранжирование кандидатов beta ─────────────


class AiRankedCandidateOut(BaseModel):
    """Одна позиция AI-ранжирования: только id + балл-объяснение (beta).

    Никаких данных кандидата — AI возвращает только порядок; раскрытие
    профиля идёт через base-выдачу matcher'а.
    """

    candidate_id: int
    score: float
    rationale: str


class AiRankingOut(BaseModel):
    """Результат AI-ранжирования (только порядок; решений не принимает)."""

    ranked: list[AiRankedCandidateOut] = []
    note: str = "AI-ранжирование выполнено — рекомендация требует ручной проверки менеджером"


class AiCandidatesOut(BaseModel):
    """Ответ GET /tech-requests/{id}/candidates?ai=1.

    base — официальная детерминированная выдача matcher'а (всегда);
    ai — опциональный AI-порядок (null при отказе AI); beta/requires_review —
    маркеры «предварительно, требует ручной проверки менеджером»;
    ai_ranked — true, когда AI вернул порядок.
    """

    base: list[RankedCandidateOut]
    ai: AiRankingOut | None = None
    ai_ranked: bool = False
    beta: bool = True
    requires_review: bool = True
    note: str


class StageEvidenceIn(BaseModel):
    """Доказательство этапа текстом/ссылкой (legacy-стиль, storage_key=None)."""

    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)


class StageListOut(BaseModel):
    """Этап в списке: карточка + прогресс, без вложенных задач/точек."""

    id: int
    project_id: int
    from_level: int
    to_level: int
    title: str
    description: str | None = None
    status: str = "planned"
    responsible_id: int | None = None
    planned_start_date: str | None = None
    planned_end_date: str | None = None
    actual_start_date: str | None = None
    actual_end_date: str | None = None
    plan_result: dict = Field(default_factory=dict)
    fact_result: dict = Field(default_factory=dict)
    progress: StageProgressOut
    created_by: int | None = None
    created_at: str | None = None
    updated_at: str | None = None


class StageOut(StageListOut):
    """Полная карточка этапа: прогресс, задачи, контрольные точки, документы."""

    tasks: list[StageTaskOut] = Field(default_factory=list)
    checkpoints: list[StageCheckpointOut] = Field(default_factory=list)
    documents: list[StageDocumentOut] = Field(default_factory=list)


class StageHistoryOut(BaseModel):
    """Запись истории этапа (audit stage.* / task.* / checkpoint.*)."""

    id: int
    action: str
    details: dict = Field(default_factory=dict)
    user_id: int | None = None
    created_at: str | None = None


# ─── Тикет 02 operations-modules: реестр экспертов и заключение ──────────────

EXPERT_ASSIGNMENT_STATUSES = ("assigned", "accepted", "declined", "submitted", "reviewed")
EXPERT_CONCLUSION_STATUSES = ("draft", "submitted", "approved")


class ExpertAssignIn(BaseModel):
    """Назначение эксперта на scope материалов проекта (staff)."""

    expert_user_id: int = Field(gt=0)
    scope: dict = Field(
        default_factory=lambda: {"stage_ids": [], "checkpoint_ids": []},
        description="Разрешённые материалы: {'stage_ids': [...], 'checkpoint_ids': [...]}",
    )

    @model_validator(mode="after")
    def _validate_scope(self) -> ExpertAssignIn:
        if not isinstance(self.scope, dict):
            raise ValueError("scope должен быть объектом {'stage_ids': [], 'checkpoint_ids': []}")
        unknown = set(self.scope) - {"stage_ids", "checkpoint_ids"}
        if unknown:
            raise ValueError(f"scope содержит неизвестные ключи: {sorted(unknown)}")
        for key in ("stage_ids", "checkpoint_ids"):
            value = self.scope.get(key, [])
            if not isinstance(value, list) or not all(
                isinstance(item, int) and item > 0 for item in value
            ):
                raise ValueError(f"scope.{key} должен быть списком положительных id")
        return self


class ExpertCoiIn(BaseModel):
    """Декларация отсутствия конфликта интересов."""

    declared: bool

    @model_validator(mode="after")
    def _must_declare(self) -> ExpertCoiIn:
        if not self.declared:
            raise ValueError("Для доступа к материалам необходимо подтвердить COI (declared=true)")
        return self


class ExpertConclusionIn(BaseModel):
    """Черновик заключения эксперта."""

    content: str = Field(min_length=1, max_length=20000)


class ExpertReviewIn(BaseModel):
    """Решение staff по поданному заключению."""

    approved: bool
    comment: str | None = Field(default=None, max_length=4000)


class ExpertConclusionOut(BaseModel):
    """Заключение в составе назначения.

    content виден только владельцу назначения (GET /experts/assignments/mine)
    и staff (ответ review); другим пользователям заключения не отдаются.
    """

    id: int
    version: int
    status: str
    content: str | None = None
    submitted_at: str | None = None
    reviewed_by: int | None = None
    reviewed_at: str | None = None
    review_comment: str | None = None
    updated_at: str | None = None


class ExpertAssignmentOut(BaseModel):
    """Назначение эксперта (видит только сам эксперт и staff)."""

    id: int
    project_id: int
    project_name: str | None = None
    expert_user_id: int
    scope: dict = Field(default_factory=dict)
    status: str
    assigned_by: int | None = None
    coi_declared: bool | None = None
    coi_declared_at: str | None = None
    conclusion: ExpertConclusionOut | None = None
    created_at: str | None = None
    updated_at: str | None = None


class ExpertProjectCardOut(BaseModel):
    """Минимальная карточка проекта для эксперта (без join_token/юридических полей)."""

    id: int
    name: str
    description: str | None = None
    category: str | None = None
    target_level: int
    current_level: int
    status: str
    is_public: bool = False
    created_at: str | None = None


class ExpertProjectDetailOut(BaseModel):
    """Карточка проекта в объёме назначенного эксперту scope.

    Эксперт видит ТОЛЬКО назначенные материалы (scope): этапы из
    stage_ids (с задачами/точками/документами), контрольные точки из
    checkpoint_ids, документы scoped-этапов. Без членов команды, аудита,
    опросников и полного списка документов проекта.
    """

    project: ExpertProjectCardOut
    stages: list[StageOut] = Field(default_factory=list)
    control_points: list[StageCheckpointOut] = Field(default_factory=list)
    documents: list[StageDocumentOut] = Field(default_factory=list)
    scope: dict = Field(default_factory=dict)


# ─── Реестр РИД (тикет 03 operations-modules) ───────────────────────────────

IP_ASSET_TYPES = ("patent", "software", "know-how", "trademark", "design")
IP_ASSET_STATUSES = ("draft", "registered", "protected", "expired", "transferred")


class IpWarningOut(BaseModel):
    """Детерминированное предупреждение (вычисляется при чтении, без LLM)."""

    code: str
    message: str


class IpAuthorIn(BaseModel):
    """Автор РИД: user_id (пользователь платформы) ИЛИ name (внешний автор).

    Оба поля одновременно — 422 (валидация в эндпоинте: user_id — проверяемая
    сущность, name — внешний автор без аккаунта).
    """

    user_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    contribution: str | None = Field(default=None, max_length=2000)


class IpAuthorOut(BaseModel):
    """Автор с маскировкой ПДн: user_id/ФИО видны только staff.

    Остальные роли получают display_name вида «Автор N».
    """

    id: int
    ip_asset_id: int
    user_id: int | None = None  # заполняется только для staff
    display_name: str
    contribution: str | None = None


class IpAssetIn(BaseModel):
    """Создание карточки РИД (только staff)."""

    title: str = Field(min_length=1, max_length=255)
    type: Literal["patent", "software", "know-how", "trademark", "design"]
    project_id: int | None = None
    owner_organization_id: int | None = None
    status: Literal["draft", "registered", "protected", "expired", "transferred"] = "draft"
    registration_number: str | None = Field(default=None, max_length=128)
    application_date: date | None = None
    registration_date: date | None = None
    expiry_date: date | None = None
    restrictions: str | None = Field(default=None, max_length=4000)


class IpAssetUpdateIn(BaseModel):
    """Частичное обновление карточки РИД (только staff)."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    type: Literal["patent", "software", "know-how", "trademark", "design"] | None = None
    project_id: int | None = None
    owner_organization_id: int | None = None
    status: Literal["draft", "registered", "protected", "expired", "transferred"] | None = None
    registration_number: str | None = Field(default=None, max_length=128)
    application_date: date | None = None
    registration_date: date | None = None
    expiry_date: date | None = None
    restrictions: str | None = Field(default=None, max_length=4000)


class IpDocumentOut(BaseModel):
    """Файл-документ РИД (без storage_key — скачивание только по download)."""

    id: int
    ip_asset_id: int
    title: str
    mime: str | None = None
    sha256: str | None = None
    scan_status: str = "pending"
    uploaded_by: int | None = None
    created_at: str | None = None


class IpAssetOut(BaseModel):
    """Карточка РИД с детерминированными предупреждениями.

    authors/documents заполняются в detail-выдаче; в списке — пустые.
    """

    id: int
    title: str
    type: str
    project_id: int | None = None
    owner_organization_id: int | None = None
    status: str
    registration_number: str | None = None
    application_date: str | None = None
    registration_date: str | None = None
    expiry_date: str | None = None
    restrictions: str | None = None
    created_by: int | None = None
    created_at: str | None = None
    updated_at: str | None = None
    warnings: list[IpWarningOut] = Field(default_factory=list)
    authors: list[IpAuthorOut] = Field(default_factory=list)
    documents: list[IpDocumentOut] = Field(default_factory=list)


# ─── Каталог мер поддержки (тикет 04 operations-modules) ─────────────────────

SUPPORT_PROGRAM_STATUSES = ("draft", "published", "confirmed")


class SupportProgramChecklistItemOut(BaseModel):
    """Позиция checklist программы (0..N по position)."""

    position: int
    item: str


class SupportProgramProgressOut(BaseModel):
    """Локальный прогресс пользователя (completed — массив позиций).

    Прогресс хранится только локально и на внешний портал не отправляется.
    """

    program_id: int
    completed: list[int] = Field(default_factory=list)
    updated_at: str | None = None


class SupportProgramProgressIn(BaseModel):
    """Сохранение прогресса: completed — массив позиций checklist (0..N)."""

    completed: list[int] = Field(default_factory=list, max_length=500)


class SupportProgramIn(BaseModel):
    """Создание программы меры поддержки (только служебная роль).

    checklist — список позиций (строки); при сохранении заменяет набор
    позиций программы (position = индекс). Числовые условия (УГТ-диапазон)
    задаются вручную из проверяемых источников, НЕ генерируются моделью.
    """

    title: str = Field(min_length=1, max_length=255)
    source_url: str | None = Field(default=None, max_length=2048)
    source_name: str | None = Field(default=None, max_length=255)
    actuality_date: date | None = None
    responsible_org_id: int | None = None
    target_ugt_min: int | None = Field(default=None, ge=0, le=9)
    target_ugt_max: int | None = Field(default=None, ge=0, le=9)
    categories: list[str] = Field(default_factory=list, max_length=50)
    eligibility: str | None = Field(default=None, max_length=8000)
    checklist: list[str] = Field(default_factory=list, max_length=200)

    @model_validator(mode="after")
    def _check_ugt_range(self) -> SupportProgramIn:
        if (
            self.target_ugt_min is not None
            and self.target_ugt_max is not None
            and self.target_ugt_min > self.target_ugt_max
        ):
            raise ValueError("target_ugt_min не может быть больше target_ugt_max")
        return self


class SupportProgramUpdateIn(BaseModel):
    """Частичное обновление программы (только служебная роль).

    None = не менять поле; categories/checklist с явным значением (в т.ч.
    пустым списком) заменяют текущий набор целиком.
    """

    title: str | None = Field(default=None, min_length=1, max_length=255)
    source_url: str | None = Field(default=None, max_length=2048)
    source_name: str | None = Field(default=None, max_length=255)
    actuality_date: date | None = None
    responsible_org_id: int | None = None
    target_ugt_min: int | None = Field(default=None, ge=0, le=9)
    target_ugt_max: int | None = Field(default=None, ge=0, le=9)
    categories: list[str] | None = Field(default=None, max_length=50)
    eligibility: str | None = Field(default=None, max_length=8000)
    checklist: list[str] | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def _check_ugt_range(self) -> SupportProgramUpdateIn:
        if (
            self.target_ugt_min is not None
            and self.target_ugt_max is not None
            and self.target_ugt_min > self.target_ugt_max
        ):
            raise ValueError("target_ugt_min не может быть больше target_ugt_max")
        return self


class SupportProgramOut(BaseModel):
    """Программа меры поддержки (публичная/служебная выдача).

    is_stale/recommendation — детерминированные производные актуальности
    (actuality_date < today → is_stale=True, recommendation=False; без LLM).
    В detail-выдаче добавляются checklist и прогресс текущего пользователя.
    """

    id: int
    title: str
    source_url: str | None = None
    source_name: str | None = None
    actuality_date: str | None = None
    responsible_org_id: int | None = None
    target_ugt_min: int | None = None
    target_ugt_max: int | None = None
    categories: list[str] = Field(default_factory=list)
    eligibility: str | None = None
    status: str
    published_at: str | None = None
    is_stale: bool = False
    recommendation: bool = True
    stale_message: str | None = None
    checklist: list[SupportProgramChecklistItemOut] = Field(default_factory=list)
    progress: SupportProgramProgressOut | None = None


# ─── Операционная аналитика Центра (тикет 05 operations-modules) ────────────


class AnalyticsMetricOut(BaseModel):
    """Показатель аналитики: значение + метаданные.

    value — число (счётчик) или распределение {группа: количество} для
    by_*-показателей. definition/source/computed_at — обязательные метаданные
    каждого показателя (тикет: определение, источник, дата расчёта).
    """

    value: int | dict[str, int]
    definition: str
    source: str
    computed_at: str


class AnalyticsFiltersOut(BaseModel):
    """Применённые фильтры сводки (эхо запроса)."""

    period_from: str | None = None
    period_to: str | None = None
    status: str | None = None


class AnalyticsSummaryOut(BaseModel):
    """Сводка операционной аналитики: метаданные + показатели с метаданными."""

    computed_at: str
    filters: AnalyticsFiltersOut
    metrics: dict[str, AnalyticsMetricOut]


class SignedUrlOut(BaseModel):
    """Короткоживущая подписанная ссылка на скачивание файла (тикет 02)."""

    file_id: int
    url: str
    expires_at: str


class KillSwitchIn(BaseModel):
    """Переключение kill switch (тикет 03): только целевое состояние."""

    enabled: bool


class KillSwitchOut(BaseModel):
    """Текущее состояние одного контура (тикет 03)."""

    name: str
    enabled: bool
