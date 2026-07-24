from __future__ import annotations

from types import SimpleNamespace

from app.api.v1.projects import project_list_stmt


def test_admin_project_list_has_no_owner_filter() -> None:
    statement = project_list_stmt(SimpleNamespace(id=8, is_superuser=True))

    assert "WHERE" not in str(statement)


def test_regular_user_project_list_is_scoped_to_owned_or_joined_projects() -> None:
    statement = project_list_stmt(SimpleNamespace(id=42, is_superuser=False))
    sql = str(statement)

    assert "projects.created_by" in sql
    assert "project_members.user_id" in sql
    assert "ORDER BY" in sql
