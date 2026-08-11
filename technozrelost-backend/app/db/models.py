from __future__ import annotations

from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
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
    UniqueConstraint,
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

    # ─── Email lifecycle (тикет 01 identity-organizations) ───────────────────
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    email_verification_token_hash: Mapped[str | None] = mapped_column(Text)
    email_verification_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    password_reset_token_hash: Mapped[str | None] = mapped_column(Text)
    password_reset_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    login_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="unverified", server_default="unverified"
    )

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


class EmailOutbox(Base):
    """Outbox тестовой доставки email (тикет 01).

    В APP_ENV=test хранит открытый токен (для тестов); в остальных профилях
    открытый токен не пишется — только SHA-256 хеш (token_hash).
    """

    __tablename__ = "email_outbox"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    recipient: Mapped[str] = mapped_column(String(254), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    template: Mapped[str] = mapped_column(String(32), nullable=False)
    token: Mapped[str | None] = mapped_column(Text)
    token_hash: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MfaCredential(Base):
    """Учётные данные MFA (TOTP) для служебных ролей (тикет 02).

    Секрет хранится ТОЛЬКО зашифрованным (Fernet, ключ MFA_SECRET_ENCRYPTION_KEY);
    открытый секрет не логируется и не возвращается после confirm.
    """

    __tablename__ = "mfa_credentials"

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="CASCADE"), primary_key=True
    )
    secret_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class MfaRecoveryCode(Base):
    """Одноразовый recovery-код MFA (тикет 02).

    В БД — только SHA-256 хеш кода (code_hash); открытые коды выдаются один раз
    после успешного confirm/re-issue и не хранятся.
    """

    __tablename__ = "mfa_recovery_codes"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False
    )
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MfaChallenge(Base):
    """Одноразовый challenge-токен MFA-входа (тикет 02).

    Выдаётся login-ом при включённой MFA вместо access/refresh; TTL 5 минут;
    attempts >= 5 → блокировка (brute force); used_at — одноразовость.
    """

    __tablename__ = "mfa_challenges"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ConsentVersion(Base):
    """Версия юридического документа (тикет 04 identity-organizations).

    is_draft=TRUE — черновик-плейсхолдер до утверждения юристом; текст помечен
    «ЧЕРНОВИК». Уникальность — (slug, version); B-Tree-констрейнт даёт и выборку
    истории, и текущую (максимальную) версию.
    """

    __tablename__ = "consent_versions"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(Text)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_draft: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("slug", "version", name="uq_consent_versions_slug_version"),
    )


class ConsentAcceptance(Base):
    """Неизменяемый след принятия версии согласия (тикет 04)."""

    __tablename__ = "consent_acceptances"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False
    )
    consent_version_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("public.consent_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    accepted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id", "consent_version_id", name="uq_consent_acceptances_user_version"
        ),
    )


class DeletionRequest(Base):
    """Управляемый запрос удаления/обезличивания аккаунта (тикет 04).

    Один запрос на пользователя (UNIQUE user_id); state — pending/processing/
    completed/rejected. Обезличивание выполняет админ (append-only аудит,
    проекты и документы сохраняются с обезличенным автором).
    """

    __tablename__ = "deletion_requests"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    state: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    requested_by: Mapped[str] = mapped_column(Text, nullable=False, default="self")


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
    stage_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.project_stages.id", ondelete="CASCADE"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    point_type: Mapped[str] = mapped_column(String(32), nullable=False, default="gate")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    due_date: Mapped[date | None] = mapped_column(Date)
    weight: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
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
    stage_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.project_stages.id", ondelete="CASCADE"), nullable=True
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
    # Редакционный workflow (тикет 01 ai-rag): draft -> published -> retired.
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="doc")
    is_ai_reviewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    published_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class RagRetiredLog(Base):
    """Append-only журнал отозванных материалов (тикет 01 ai-rag).

    Retired-материал исчезает из retrieval, но история отзыва сохраняется.
    """

    __tablename__ = "rag_retired_log"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    document_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.rag_documents.id", ondelete="CASCADE"), nullable=False
    )
    retired_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    retired_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    reason: Mapped[str | None] = mapped_column(Text)


class RagAbuseState(Base):
    """Серверное состояние topic gate консультанта (тикет 03 ai-rag).

    Одна запись на IP (unique ip): счётчик ПОСЛЕДОВАТЕЛЬНЫХ off-topic
    и блокировка. НЕ client state: ключ — IP, поэтому смена session_id
    не снимает блокировку и не обнуляет счётчик.
    """

    __tablename__ = "rag_abuse_state"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    ip: Mapped[str] = mapped_column(String(45), nullable=False, unique=True)
    session_id: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    off_topic_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    blocked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class RagRateLimitState(Base):
    """Серверные rate limits публичного /rag/chat по IP (тикет 04 ai-rag).

    Одна запись на IP (unique ip): текущее окно частоты (freq_window_start /
    freq_count) и текущий UTC-день суточного лимита (daily_date / daily_count).
    session_id — ТОЛЬКО для диагностики, ключ лимитов — IP: смена session_id
    не обнуляет ни частотный, ни суточный лимит. ПДн не хранятся (только IP,
    счётчики окон и время обновления; TTL-чистка старых строк).
    """

    __tablename__ = "rag_rate_limit_state"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    ip: Mapped[str] = mapped_column(String(45), nullable=False, unique=True)
    session_id: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    freq_window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    freq_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    daily_date: Mapped[date] = mapped_column(Date, nullable=False)
    daily_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class RagCostState(Base):
    """Дневной бюджет публичного /rag/chat (тикет 04 ai-rag).

    Одна строка на UTC-день (unique day): request_count (запросы, дошедшие до
    консультанта) и оценка токенов (input_tokens/output_tokens, эвристика
    len//4). Пороги — settings rag_daily_budget_requests / rag_daily_budget_tokens.
    """

    __tablename__ = "rag_cost_state"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    day: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    request_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
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
    competencies: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
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

class NotificationOutbox(Base):
    """Transactional outbox: realtime-события и задачи менеджеров (тикет 12)."""

    __tablename__ = "notification_outbox"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    notification_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.notifications.id", ondelete="CASCADE")
    )
    target_scope: Mapped[str] = mapped_column(String(16), nullable=False, default="project")
    manager_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
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
    Карточка по ИНН (тикет 03 identity-organizations): inn уникален и
    нормализован (только цифры); state — lifecycle draft/pending/verified/rejected;
    review_comment — внутренний комментарий менеджера (не публичный);
    reviewed_by/reviewed_at — кто и когда вынес решение.
    """

    __tablename__ = "user_organizations"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(255))
    # ─── Карточка по ИНН (тикет 03) ────────────────────────────────────────
    inn: Mapped[str | None] = mapped_column(String(12), unique=True)
    ogrn: Mapped[str | None] = mapped_column(String(32))
    kpp: Mapped[str | None] = mapped_column(String(9))
    org_type: Mapped[str | None] = mapped_column(String(64))
    region: Mapped[str | None] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(Text)
    contacts: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    state: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    review_comment: Mapped[str | None] = mapped_column(Text)
    verification_decision: Mapped[str | None] = mapped_column(Text)
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


class TechRequest(Base):
    """Черновик технологического запроса заказчика (тикеты 01–02 requests-matching).

    Создаётся только верифицированным представителем организации
    (user_organizations.state='verified' + роль gk_customer). Черновик видят
    создатель и Центр; submit фиксирует запрос (draft -> submitted).
    Тикет 02: visibility (public/platform/private) + moderation_status
    (pending/approved/rejected) — публикация только после решения менеджера.
    """

    __tablename__ = "tech_requests"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    created_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=False
    )
    organization_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.user_organizations.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    requirements: Mapped[str] = mapped_column(Text, nullable=False)
    demand: Mapped[str | None] = mapped_column(Text)
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    budget: Mapped[float | None] = mapped_column(Numeric(15, 2))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    visibility: Mapped[str] = mapped_column(
        String(16), nullable=False, default="platform"
    )
    moderation_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending"
    )
    moderated_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.users.id")
    )
    moderated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    moderation_reason: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class TechRequestDocument(Base):
    """Вложение технологического запроса, версионируется по title (тикет 01)."""

    __tablename__ = "tech_request_documents"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    request_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.tech_requests.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str | None] = mapped_column(Text)
    file_name: Mapped[str | None] = mapped_column(String(255))
    file_size: Mapped[int | None] = mapped_column(BigInteger)
    mime_type: Mapped[str | None] = mapped_column(String(128))
    sha256: Mapped[str | None] = mapped_column(String(64))
    scan_status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    uploaded_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TechRequestModerationLog(Base):
    """Append-only журнал решений модерации запроса (тикет 02 requests-matching).

    Каждое решение менеджера (approve/reject) и смена режима видимости
    (visibility_changed) пишутся отдельной записью; записи не изменяются.
    """

    __tablename__ = "tech_request_moderation_log"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    request_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.tech_requests.id", ondelete="CASCADE"), nullable=False
    )
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    moderator_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TechRequestCandidateDecision(Base):
    """Решение менеджера/заказчика по кандидату matcher (тикет 03 requests-matching).

    Одно решение на пару (request_id, candidate_id) — UNIQUE. Исходные данные
    кандидата и запроса не изменяются; повторное решение → 409 на уровне API.
    """

    __tablename__ = "tech_request_candidate_decisions"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    request_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.tech_requests.id", ondelete="CASCADE"), nullable=False
    )
    candidate_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=False
    )
    decision: Mapped[str] = mapped_column(String(16), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TechRequestOffer(Base):
    """Обезличенное предложение кандидату (тикет 04 requests-matching).

    Создаёт сотрудник Центра: БЕЗ контактов заказчика и закрытых полей
    (budget/demand); одно предложение на пару (request_id, candidate_id) —
    UNIQUE. Статусы: pending → accepted (согласие, запрос раскрытия) /
    declined (отказ). responded_at фиксирует момент ответа кандидата.
    """

    __tablename__ = "tech_request_offers"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    request_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.tech_requests.id", ondelete="CASCADE"), nullable=False
    )
    candidate_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending"
    )
    message: Mapped[str | None] = mapped_column(Text)
    offered_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TechRequestDisclosure(Base):
    """Ручное разрешение раскрытия контактов/полей кандидату (тикет 04).

    Создаётся согласием кандидата (offer accept) в статусе pending; решение
    staff/создателя запроса: approved → раскрытие, denied → причина (reason).
    decided_by/decided_at фиксируют решение; повторное решение → 409.
    """

    __tablename__ = "tech_request_disclosures"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    offer_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.tech_request_offers.id", ondelete="CASCADE"), nullable=False
    )
    requested_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending"
    )
    decided_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TechRequestProject(Base):
    """Связь технологический запрос → проект (тикет 04 requests-matching).

    Хранит ЯВНО выбранные наследуемые поля (selected_fields: JSONB-объект
    {проектное_поле: источник_поля_запроса}, например {"name": "title"}).
    При создании нового проекта наследуются ТОЛЬКО выбранные поля; при
    привязке существующего — только связь + список выбранных полей.
    """

    __tablename__ = "tech_request_projects"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    request_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.tech_requests.id", ondelete="CASCADE"), nullable=False
    )
    offer_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.tech_request_offers.id"), nullable=False
    )
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.projects.id"), nullable=False
    )
    created_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=False
    )
    selected_fields: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict
    )
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


class ProjectStage(Base):
    """Этап сопровождения проекта (тикет 01 operations-modules).

    Экземпляр этапа N→N+1 для конкретного проекта: ответственный, сроки,
    план/факт результаты. Просрочки и прогресс рассчитываются детерминированно
    сервисом stage_progress (по датам/весам, без LLM) — производный статус
    не хранится в БД.
    """

    __tablename__ = "project_stages"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.projects.id", ondelete="CASCADE"), nullable=False
    )
    from_level: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    to_level: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="planned")
    responsible_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=True
    )
    planned_start_date: Mapped[date | None] = mapped_column(Date)
    planned_end_date: Mapped[date | None] = mapped_column(Date)
    actual_start_date: Mapped[date | None] = mapped_column(Date)
    actual_end_date: Mapped[date | None] = mapped_column(Date)
    plan_result: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    fact_result: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class StageTask(Base):
    """Задача этапа сопровождения (тикет 01 operations-modules).

    Статус: todo → in_progress → done (done фиксирует completed_at).
    Просрочка определяется детерминированно по due_date (без LLM).
    """

    __tablename__ = "stage_tasks"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    stage_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.project_stages.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="todo")
    assignee_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=True
    )
    due_date: Mapped[date | None] = mapped_column(Date)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class ExpertAssignment(Base):
    """Назначение эксперта на scope материалов проекта (тикет 02 operations-modules).

    Пул экспертов = пользователи с верифицированным профилем
    (user_profiles.state='verified'); роль ugt_expert не создаётся.
    Lifecycle: assigned → accepted | declined → (coi_declared) → submitted
    → reviewed. Эксперт видит ТОЛЬКО назначенный scope (stage_ids /
    checkpoint_ids); COI обязателен до доступа к полным материалам/подачи
    заключения.
    """

    __tablename__ = "expert_assignments"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.projects.id", ondelete="CASCADE"), nullable=False
    )
    expert_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False
    )
    scope: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="assigned")
    assigned_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=False
    )
    coi_declared: Mapped[bool | None] = mapped_column(Boolean)
    coi_declared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    conclusion_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.expert_conclusions.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class ExpertConclusion(Base):
    """Версионное заключение эксперта (тикет 02 operations-modules).

    Одна строка на назначение (assignment_id UNIQUE); version инкрементируется
    при каждом сохранении черновика. Статусы: draft → submitted → approved
    (review с approved=false возвращает заключение в draft на доработку).
    """

    __tablename__ = "expert_conclusions"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    assignment_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("public.expert_assignments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("public.users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class IpAsset(Base):
    """Карточка РИД (тикет 03 operations-modules).

    Правообладатель — user_organizations (legacy-контур org, provisional);
    предупреждения («истёк», «правообладатель не указан») НЕ хранятся —
    вычисляются детерминированно сервисом ip_registry при чтении (без LLM).
    project_id/owner_organization_id nullable: карточка переживает удаление
    проекта/организации (ON DELETE SET NULL в миграции 0033).
    """

    __tablename__ = "ip_assets"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    # patent | software | know-how | trademark | design
    project_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.projects.id", ondelete="SET NULL"), nullable=True
    )
    owner_organization_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("public.user_organizations.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    # draft | registered | protected | expired | transferred
    registration_number: Mapped[str | None] = mapped_column(String(128))
    application_date: Mapped[date | None] = mapped_column(Date)
    registration_date: Mapped[date | None] = mapped_column(Date)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    restrictions: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class IpAuthor(Base):
    """Автор РИД (тикет 03 operations-modules).

    user_id — автор-пользователь платформы; name — внешний автор
    (user_id IS NULL). ПДн (ФИО) маскируются по ролям при выдаче:
    staff видит ФИО, остальные — «Автор N».
    """

    __tablename__ = "ip_authors"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    ip_asset_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.ip_assets.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str | None] = mapped_column(String(255))
    contribution: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class IpDocument(Base):
    """Файл-документ РИД (тикет 03 operations-modules).

    Файл хранится в file_storage (storage_key), антивирусная проверка —
    scan_status (pending/clean/infected/error). Доступ: участник проекта /
    владелец организации-правообладателя / staff; чужие → 404.
    """

    __tablename__ = "ip_documents"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    ip_asset_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.ip_assets.id", ondelete="CASCADE"), nullable=False
    )
    document_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("public.project_documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str | None] = mapped_column(Text)
    mime: Mapped[str | None] = mapped_column(String(128))
    sha256: Mapped[str | None] = mapped_column(String(64))
    scan_status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    uploaded_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SupportProgram(Base):
    """Мера поддержки (тикет 04 operations-modules).

    Каталожная сущность с источником (source_url/source_name), датой
    актуальности (actuality_date), ответственным (user_organizations —
    legacy-контур org, provisional), УГТ-диапазоном и категориями.
    Жизненный цикл: draft → published → confirmed; публикация требует
    actuality_date. «Устарело»/рекомендация НЕ хранятся — вычисляются
    детерминированно сервисом support_catalog при чтении (без LLM).
    """

    __tablename__ = "support_programs"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text)
    source_name: Mapped[str | None] = mapped_column(String(255))
    actuality_date: Mapped[date | None] = mapped_column(Date)
    responsible_org_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("public.user_organizations.id", ondelete="SET NULL"),
        nullable=True,
    )
    target_ugt_min: Mapped[int | None] = mapped_column(SmallInteger)
    target_ugt_max: Mapped[int | None] = mapped_column(SmallInteger)
    categories: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    eligibility: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    # draft | published | confirmed
    published_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="SET NULL"), nullable=True
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class SupportProgramChecklist(Base):
    """Позиция checklist готовности программы (тикет 04 operations-modules).

    position — порядок 0..N; UNIQUE(program_id, position). Позиции создаются
    при создании/редактировании программы (замена списком).
    """

    __tablename__ = "support_program_checklists"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    program_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.support_programs.id", ondelete="CASCADE"), nullable=False
    )
    item: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)


class SupportProgramChecklistProgress(Base):
    """Локальный прогресс пользователя по checklist программы (тикет 04).

    completed — JSONB-массив позиций (0..N). Хранится ТОЛЬКО локально,
    на внешний портал не отправляется (в коде нет внешних вызовов).
    UNIQUE(program_id, user_id) — одна строка на пару.
    """

    __tablename__ = "support_program_checklist_progress"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    program_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.support_programs.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False
    )
    completed: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )
