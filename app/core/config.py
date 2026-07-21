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
