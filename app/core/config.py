from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "dev"
    app_name: str = "technozrelost-backend"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"

    postgres_user: str = "technoz"
    postgres_password: str = "change_me"
    postgres_db: str = "technozrelost"
    postgres_host: str = "127.0.0.1"
    postgres_port: int = 5432
    postgres_replica_host: str | None = None
    postgres_replica_port: int = 5433

    db_schema_public: str = "public"
    db_schema_test: str = "test"
    vector_dimension: int = 1536

    jwt_secret: str = "change_me_super_secret_at_least_32_chars_long_for_hs256"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 60
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def primary_dsn(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def replica_dsn(self) -> str | None:
        if not self.postgres_replica_host:
            return None
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_replica_host}:{self.postgres_replica_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
