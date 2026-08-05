from __future__ import annotations

from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Identity,
    Integer,
    MetaData,
    Numeric,
    Select,
    SmallInteger,
    String,
    Table,
    Text,
    func,
    select,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

metadata = MetaData(schema="public")

# Алфавит без неоднозначных символов (0/O, 1/I) — токены для людей.
TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_join_token() -> str:
    """Случайный join-токен вида TZ-XXXXXX (неугадываемый, secrets-источник)."""
    import secrets

    suffix = "".join(secrets.choice(TOKEN_ALPHABET) for _ in range(6))
    return f"TZ-{suffix}"

role_permissions_tbl = Table(
    "role_permissions",
    metadata,
    Column("role_id", Integer, ForeignKey("public.roles.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("public.permissions.id"), primary_key=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
)

user_roles_tbl = Table(
    "user_roles",
    metadata,
    Column("user_id", BigInteger, ForeignKey("public.users.id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("public.roles.id"), primary_key=True),
    Column("is_primary", Boolean, nullable=False, default=True),
    Column("assigned_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
)


class Base(DeclarativeBase):
    metadata = metadata


# noqa — флаг выше


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    role_no: Mapped[int] = mapped_column(SmallInteger, unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    permissions: Mapped[list[Permission]] = relationship(
        secondary=role_permissions_tbl, back_populates="roles", lazy="selectin"
    )
    users: Mapped[list[User]] = relationship(
        secondary=user_roles_tbl, back_populates="roles", lazy="selectin"
    )


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(Integer, Identity(always=True), primary_key=True)
    slug: Mapped[str] = mapped_column(String(96), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    roles: Mapped[list[Role]] = relationship(
        secondary=role_permissions_tbl, back_populates="permissions", lazy="selectin"
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    organization: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    roles: Mapped[list[Role]] = relationship(
        secondary=user_roles_tbl, back_populates="users", lazy="selectin"
    )


def stmt_user_by_email(email: str) -> Select[tuple[User]]:
    return select(User).where(User.email == email)


def stmt_role_by_slug(slug: str) -> Select[tuple[Role]]:
    return select(Role).where(Role.slug == slug)


class RefreshToken(Base):
    """Отзываемые refresh-токены (ротация при каждом обновлении)."""

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100))
    target_level: Mapped[int] = mapped_column(Integer, nullable=False, default=9)
    current_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    preliminary_level: Mapped[int | None] = mapped_column(SmallInteger)
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    budget: Mapped[float | None] = mapped_column(Numeric(15, 2))
    join_token: Mapped[str] = mapped_column(
        String(16), nullable=False, unique=True, default=lambda: generate_join_token()
    )
    legal_owner: Mapped[str | None] = mapped_column(Text)
    rights_holder: Mapped[str | None] = mapped_column(Text)
    contract_number: Mapped[str | None] = mapped_column(String(128))
    contract_basis: Mapped[str | None] = mapped_column(Text)
    legal_updated_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.users.id")
    )
    legal_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    show_preliminary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class QuestionnaireResult(Base):
    __tablename__ = "questionnaire_results"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.projects.id", ondelete="CASCADE"), nullable=False
    )
    level_id: Mapped[int] = mapped_column(Integer, nullable=False)
    checked_items: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    percentage: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class AssessmentTemplate(Base):
    __tablename__ = "assessment_templates"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    version: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AssessmentCheckpoint(Base):
    __tablename__ = "assessment_checkpoints"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    template_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.assessment_templates.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(16), nullable=False)
    order_no: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    ugt_level: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    dimensions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    critical: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    evidence: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)


class ProjectAssessment(Base):
    __tablename__ = "project_assessments"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("public.projects.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    template_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.assessment_templates.id"), nullable=False
    )
    template_version: Mapped[str] = mapped_column(String(64), nullable=False)
    preliminary_ugt: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    completion_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    evidence_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    confidence_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    latest_checkpoint: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    not_applicable_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    dimension_scores: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    level_scores: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    blockers: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class AssessmentAnswer(Base):
    __tablename__ = "assessment_answers"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    assessment_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.project_assessments.id", ondelete="CASCADE"), nullable=False
    )
    checkpoint_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.assessment_checkpoints.id"), nullable=False
    )
    checkpoint_code: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    applicable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    comment: Mapped[str | None] = mapped_column(Text)
    evidence: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    score_pct: Mapped[float | None] = mapped_column(Float)
    evidence_pct: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ProjectMember(Base):
    __tablename__ = "project_members"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.projects.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False
    )
    role_in_project: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    invited_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=True
    )
    is_priority: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_project_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ProjectInvite(Base):
    """Приглашение в проект (тикет 04): single — одноразовое, bulk — массовое.

    Одноразовые приглашения криптографически случайны, ограничены сроком и
    набором допустимых ролей. Массовые имеют лимит использований и могут быть
    отозваны администратором проекта.
    """

    __tablename__ = "project_invites"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.projects.id", ondelete="CASCADE"), nullable=False
    )
    created_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=False
    )
    token: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    invite_type: Mapped[str] = mapped_column(String(16), nullable=False, default="single")
    allowed_roles: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    max_uses: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    used_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ControlPoint(Base):
    __tablename__ = "control_points"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.projects.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    point_type: Mapped[str] = mapped_column(String(32), nullable=False, default="gate")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    decision: Mapped[str | None] = mapped_column(String(255))
    decided_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ProjectDocument(Base):
    __tablename__ = "project_documents"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.projects.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(64), nullable=False)
    file_url: Mapped[str | None] = mapped_column(Text)
    storage_key: Mapped[str | None] = mapped_column(Text)
    file_name: Mapped[str | None] = mapped_column(String(255))
    file_size: Mapped[int | None] = mapped_column(BigInteger)
    mime_type: Mapped[str | None] = mapped_column(String(128))
    sha256: Mapped[str | None] = mapped_column(String(64))
    scan_status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    scan_result: Mapped[str | None] = mapped_column(Text)
    stage_requirement_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.stage_requirements.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    uploaded_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class AuditTrailEntry(Base):
    __tablename__ = "audit_trail"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    project_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.projects.id", ondelete="CASCADE"), nullable=True
    )
    user_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class RagDocument(Base):
    __tablename__ = "rag_documents"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(64), nullable=False)
    ugt_level: Mapped[int | None] = mapped_column(SmallInteger)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536))
    source_uri: Mapped[str | None] = mapped_column(String(1024))
    template_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    short_name: Mapped[str | None] = mapped_column(Text)
    ogrn: Mapped[str | None] = mapped_column(String(32))
    org_type: Mapped[str | None] = mapped_column(String(64))
    region: Mapped[str | None] = mapped_column(String(128))
    competencies: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    projects_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class StageRequirement(Base):
    __tablename__ = "stage_requirements"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    from_level: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    to_level: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    template_version: Mapped[str] = mapped_column(String(16), nullable=False, default="v1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class RequestComment(Base):
    """Комментарий к конкретной заявке на повышение УГТ (тикет 09, US 53)."""

    __tablename__ = "request_comments"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    promotion_request_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("public.promotion_requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PromotionRequestDocument(Base):
    """Неизменяемый снимок версий документов заявки (тикет 07)."""

    __tablename__ = "promotion_request_documents"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    promotion_request_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.promotion_requests.id", ondelete="CASCADE"), nullable=False
    )
    project_document_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.project_documents.id", ondelete="CASCADE"), nullable=False
    )
    document_version: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PromotionRequest(Base):
    __tablename__ = "promotion_requests"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.projects.id", ondelete="CASCADE"), nullable=False
    )
    from_level: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    to_level: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="docs_uploaded")
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    manager_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    attempt_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    evaluation_result: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class VerificationDocument(Base):
    __tablename__ = "verification_documents"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.projects.id", ondelete="CASCADE"), nullable=False
    )
    uploader_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text)
    file_ref: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Technology(Base):
    __tablename__ = "technologies"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100))
    keywords: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    current_level: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    target_level: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=9)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    registration_number: Mapped[str | None] = mapped_column(String(64), unique=True)
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.organizations.id"), nullable=True
    )
    source_uri: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class UserProfile(Base):
    """Личный профессиональный профиль (тикет 03 Friday RC).

    Независим от проектных ролей: основная роль аккаунта определяет
    профильный реестр, но не проектные полномочия. Публикуется только в
    состоянии verified.
    """

    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    headline: Mapped[str | None] = mapped_column(String(255))
    bio: Mapped[str | None] = mapped_column(Text)
    region: Mapped[str | None] = mapped_column(String(128))
    skills: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    state: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    review_comment: Mapped[str | None] = mapped_column(Text)
    reviewed_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class UserOrganization(Base):
    """Организация, созданная пользователем платформы (тикет 03 Friday RC).

    Отделена от справочной таблицы organizations (реестр НИОКТР — read-only).
    Публикуется в реестре организаций только в состоянии verified.
    """

    __tablename__ = "user_organizations"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(255))
    ogrn: Mapped[str | None] = mapped_column(String(32))
    org_type: Mapped[str | None] = mapped_column(String(64))
    region: Mapped[str | None] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    review_comment: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=False
    )
    reviewed_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class OrganizationMember(Base):
    """Членство пользователя в пользовательской организации (тикет 03).

    Пользователь может состоять в нескольких организациях; is_primary
    отмечает основную для профильного реестра.
    """

    __tablename__ = "organization_members"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.user_organizations.id", ondelete="CASCADE"), nullable=False
    )
    role_in_org: Mapped[str] = mapped_column(String(32), nullable=False, default="member")
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class NioktrCard(Base):
    __tablename__ = "nioktr_cards"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    registration_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    annotation: Mapped[str | None] = mapped_column(Text)
    keywords: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    nioktr_types: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    state_program: Mapped[str | None] = mapped_column(Text)
    federal_program: Mapped[str | None] = mapped_column(Text)
    created_date: Mapped[str | None] = mapped_column(String(32))
    start_date: Mapped[str | None] = mapped_column(String(32))
    end_date: Mapped[str | None] = mapped_column(String(32))
    is_ai_area: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_ai_usage: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    executor_name: Mapped[str | None] = mapped_column(Text)
    executor_short_name: Mapped[str | None] = mapped_column(Text)
    executor_ogrn: Mapped[str | None] = mapped_column(Text)
    executor_territory: Mapped[str | None] = mapped_column(Text)
    customer_name: Mapped[str | None] = mapped_column(Text)
    budgets: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("public.organizations.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    source: Mapped[str] = mapped_column(
        Text, nullable=False, default="МИНОБРНАУКИ России", server_default="МИНОБРНАУКИ России"
    )
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

