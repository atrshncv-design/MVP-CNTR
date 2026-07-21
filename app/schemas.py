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
