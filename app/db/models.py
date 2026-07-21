from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Identity,
    Integer,
    MetaData,
    Select,
    SmallInteger,
    String,
    Table,
    Text,
    func,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

metadata = MetaData(schema="public")

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
