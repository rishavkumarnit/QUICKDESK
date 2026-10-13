from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    frontend_origin: str = "http://localhost:5173"
    database_url: str = ""
    jwt_secret: str = ""
    mongodb_uri: str = ""
    mongodb_database: str = "quickdesk"
    mongodb_collection: str = "knowledge_chunks"
    mongodb_vector_index: str = "knowledge_vector_index"
    llm_provider: str = ""
    llm_model: str = ""
    llm_api_key: str = ""
    embedding_model: str = ""
    embedding_api_key: str = ""

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
