"""Application settings loaded from ``backend/.env``."""

from pathlib import Path
from urllib.parse import urlsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    frontend_origin: str = "http://localhost:5173"
    database_url: str = ""
    jwt_secret: str = ""
    llm_provider: str = ""
    llm_model: str = ""
    llm_api_key: str = ""
    embedding_model: str = ""
    embedding_api_key: str = ""
    rag_min_score: float = 0.35
    seed_password: str = ""

    @field_validator("frontend_origin")
    @classmethod
    def normalize_frontend_origin(cls, value: str) -> str:
        # Browsers omit the trailing slash from the Origin header, while Vite
        # prints its local URL with one. Store the comparable origin form.
        return value.strip().rstrip("/")

    @property
    def allowed_origins(self) -> list[str]:
        origins = [self.frontend_origin]
        url = urlsplit(self.frontend_origin)
        if self.app_env == 'development' and url.hostname in ('localhost', '127.0.0.1'):
            alternate = '127.0.0.1' if url.hostname == 'localhost' else 'localhost'
            origins.append(f'{url.scheme}://{alternate}' + (f':{url.port}' if url.port else ''))
        return origins

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        # Accept provider-issued PostgreSQL URLs without changing credentials,
        # TLS settings, or other connection parameters.
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix):]
        return value


settings = Settings()
