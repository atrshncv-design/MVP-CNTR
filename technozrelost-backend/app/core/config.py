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

    # Полные DSN (тикет 18): приоритетнее разбиения на части POSTGRES_*.
    # DATABASE_URL — Primary (запись), DATABASE_REPLICA_URL — Replica (чтение).
    database_url: str | None = None
    database_replica_url: str | None = None

    db_schema_public: str = "public"
    db_schema_test: str = "test"
    vector_dimension: int = 1536

    jwt_secret: str = "change_me_super_secret_at_least_32_chars_long_for_hs256"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 60
    refresh_token_ttl_days: int = 14
    cors_origins: str = "http://localhost:3000"

    # Email (тикет 01): SMTP-адаптер — заглушка; без SMTP-настроек работает
    # тестовая доставка (outbox-таблица). Секреты — только в .env.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_pass: str | None = None
    email_verification_ttl_hours: int = 24
    password_reset_ttl_minutes: int = 30
    resend_verification_minutes: int = 5
    login_max_attempts: int = 5
    login_lock_minutes: int = 15

    # MFA (тикет 02): обязательна для служебных ролей (cntr_admin/cntr_manager).
    # Ключ Fernet для шифрования TOTP-секретов — ТОЛЬКО из env (.env);
    # при отсутствии в не-test окружении приложение не стартует.
    mfa_secret_encryption_key: str | None = None
    mfa_challenge_ttl_minutes: int = 5
    mfa_max_attempts: int = 5
    mfa_verify_rate_limit: int = 10
    mfa_verify_rate_window_seconds: int = 60
    mfa_recovery_codes_count: int = 10

    gigachat_credentials: str | None = None

    # LLM (OpenAI-совместимый API; ключ кладёт пользователь в .env)
    llm_api_base: str = "https://api.openai.com/v1"
    llm_api_key: str | None = None
    llm_model: str = "gpt-4o-mini"

    # Публичный RAG-консультант (тикет 02 ai-rag)
    rag_min_similarity: float = 0.30
    rag_consultant_top_k: int = 5
    rag_context_chunk_chars: int = 500

    # Тематические guardrails консультанта (тикет 03 ai-rag)
    rag_offtopic_limit: int = 3  # N последовательных off-topic → блокировка
    rag_block_minutes: int = 60  # длительность блокировки IP (час)

    # Abuse / rate limits публичного консультанта (тикет 04 ai-rag)
    rag_rate_limit_per_window: int = 10  # запросов за окно частоты (на IP)
    rag_rate_limit_window_minutes: int = 15  # окно частоты (минут)
    rag_daily_request_limit: int = 30  # суточный лимит запросов (на IP)

    # Cost gate (тикет 04 ai-rag): дневной бюджет — глобальный (на всех посетителей)
    rag_daily_budget_requests: int = 1000  # запросов к консультанту в день
    rag_daily_budget_tokens: int = 100_000  # оценка токенов в день (len//4)
    rag_per_request_max_tokens: int = 1500  # целевой потолок ответа (оценка)
    rag_kill_switch: bool = False  # True → /rag/chat отвечает 503 (остальной API жив)

    # Кеш идентичных вопросов (тикет 04 ai-rag): in-memory, TTL секунд
    rag_cache_ttl_seconds: int = 3600

    # Файловое хранилище (тикет 06): MinIO + ClamAV
    minio_endpoint: str = "127.0.0.1:9000"
    minio_access_key: str = "technoz"
    minio_secret_key: str = "change_me"
    minio_bucket: str = "technozrelost"
    minio_secure: bool = False
    clamav_host: str = "127.0.0.1"
    clamav_port: int = 3310
    clamav_enabled: bool = True
    max_file_size_mb: int = 25

    # Подписанные ссылки на файлы (тикет 02 security-infrastructure):
    # секрет для HMAC — плейсхолдер, реальное значение только в .env;
    # TTL в минутах (допустимый диапазон 5–15).
    signed_url_secret: str = "change_me_signed_url_secret_at_least_32_chars"
    signed_url_ttl_minutes: int = 10

    # Kill switches (тикет 03 security-infrastructure): независимые флаги контуров.
    # App_env-независимые: источник истины — env/дефолты; штатное переключение
    # на лету — staff-эндпоинт /admin/kill-switches (in-memory override,
    # сбрасывается при рестарте на значения отсюда).
    registration_enabled: bool = True
    uploads_enabled: bool = True
    external_access_enabled: bool = True
    ai_enabled: bool = True

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
