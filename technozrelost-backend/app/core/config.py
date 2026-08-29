from __future__ import annotations

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET = "change_me_super_secret_at_least_32_chars_long_for_hs256"


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

    # Полные DSN (тикет 18): приоритетнее разбиения на части POSTGRES_*.
    # DATABASE_URL — Primary (запись), DATABASE_REPLICA_URL — Replica (чтение).
    database_url: str | None = None
    database_replica_url: str | None = None

    db_schema_public: str = "public"
    db_schema_test: str = "test"
    # Пул соединений согласован с max_connections PostgreSQL (P-01/R14):
    # 2 реплики приложения × пул + резерв < 100. Дешевле pgbouncer и достаточно
    # для пилота; при росте нагрузки сначала pgbouncer, а не эти цифры.
    db_pool_size: int = 10
    db_max_overflow: int = 20
    # Число реплик приложения в прод-стеке (deploy.replicas в docker-compose.prod.yml).
    db_app_replicas: int = 2
    # Лимит соединений PostgreSQL (max_connections в infra-конфиге Primary).
    db_max_connections: int = 100
    # Резерв сверх пулов: миграции alembic, планировщик новостей, ручной psql.
    db_connections_reserve: int = 10
    vector_dimension: int = 1536

    redis_url: str | None = None

    jwt_secret: str = DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 60
    refresh_token_ttl_days: int = 14
    cors_origins: str = "http://localhost:3000"

    # N-17: мёртвая конфигурация gigachat_credentials (legacy GigaChat) —
    # оставлена для совместимости, не используется; будет удалена после M2.
    gigachat_credentials: str | None = None

    # LLM (OpenAI-совместимый API; ключ кладёт пользователь в .env)
    llm_api_base: str = "https://api.openai.com/v1"
    llm_api_key: str | None = None
    llm_model: str = "gpt-4o-mini"
    # LLM-гейтвей (N-05): по умолчанию выключен — ПДн не покидает контур.
    # Включается только явной установкой LLM_GATEWAY_ENABLED=true в окружении.
    # Allowlist полей для LLM: title+annotation/sector/ugt/region/competencies
    # (без PII), контур tuno/kaba — санитизация nh3 на оба входа в тикете 02.
    llm_gateway_enabled: bool = False

    # H-01 (TICKET-01): легаси-allowlist file_ref без проверки MinIO (тестовые "ref-1"/"ref-2").
    legacy_file_ref_allowlist: set[str] = {"ref-1", "ref-2"}

    # Файловое хранилище (тикет 06): MinIO + ClamAV
    minio_endpoint: str = "127.0.0.1:9000"
    minio_access_key: str = "technoz"
    minio_secret_key: str = "change_me"
    minio_bucket: str = "technozrelost"
    minio_secure: bool = False
    clamav_host: str = "127.0.0.1"
    clamav_port: int = 3310
    clamav_enabled: bool = True
    # L-03 / INF-18: максимальный возраст CVD-баз ClamAV (секунды, 7 дней).
    # Единый источник для file_storage.py и infra/alerter (env CVD_MAX_AGE_SECONDS).
    cvd_max_age_seconds: int = 7 * 24 * 3600
    max_file_size_mb: int = 25
    # Глобальный лимит тела запроса (R05.5): чуть выше max_file_size_mb,
    # чтобы легитимные multipart-загрузки проходили, а мусор — отклонялся.
    max_request_body_mb: int = 32

    @model_validator(mode="after")
    def _production_secrets_guard(self) -> Settings:
        """Прод-guard (R05.2): в production дефолтный/пустой JWT-секрет запрещён."""
        if self.app_env == "production" and (
            not self.jwt_secret or self.jwt_secret == DEFAULT_JWT_SECRET
        ):
            raise ValueError(
                "jwt_secret: в production требуется настоящий секрет "
                "(задайте JWT_SECRET в окружении, дефолтное значение запрещено)"
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def primary_dsn(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def replica_dsn(self) -> str | None:
        if self.database_replica_url:
            return self.database_replica_url
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
