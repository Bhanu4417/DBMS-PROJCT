"""Application configuration loaded from environment variables / .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "CampusOS College Management API"
    app_version: str = "1.0.0"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/college"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    sql_echo: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
