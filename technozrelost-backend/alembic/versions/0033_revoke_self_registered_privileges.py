"""revoke self-registered privileged roles (R04i, task 03)

Revision ID: 0033
Revises: 0032
Create Date: 2026-09-08

До allowlist саморегистрации (SELF_REGISTER_ALLOWED_SLUGS) роли auditor /
regulating_organization / investor выдавались через POST /auth/register.
Отзыв — данными: обычные пользователи лишаются этих назначений (fallback
gk_customer), суперпользователи и персонал ЦНТР не трогаются, каждое снятие
фиксируется в audit_trail (user.role.revoked). Идемпотентно.
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "migrations" / "sql"


def _sql(name: str) -> str:
    return (SQL_DIR / name).read_text(encoding="utf-8")


def upgrade() -> None:
    op.execute(_sql("0033_revoke_self_registered_privileges.sql"))
    op.execute(
        "INSERT INTO public.db_migration_log (filename) "
        "VALUES ('0033_revoke_self_registered_privileges.sql')"
    )


def downgrade() -> None:
    # Data-fix необратим: отозванные самовыданные привилегии не восстанавливаем
    # (повторная выдача — только администратором через PATCH /users/{id}).
    # Откатываем только запись журнала, чтобы downgrade/upgrade цикл не падал.
    op.execute(
        "DELETE FROM public.db_migration_log "
        "WHERE filename = '0033_revoke_self_registered_privileges.sql'"
    )
