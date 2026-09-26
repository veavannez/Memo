from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/memo"

    # Security
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # GitHub App
    GITHUB_APP_ID: str = ""
    GITHUB_APP_PRIVATE_KEY_PATH: str = "./github-app.private-key.pem"
    GITHUB_APP_PRIVATE_KEY: str = ""  # Inline PEM, newlines as \n
    GITHUB_APP_CLIENT_ID: str = ""
    GITHUB_APP_CLIENT_SECRET: str = ""
    GITHUB_APP_WEBHOOK_SECRET: str = "dev-webhook-secret"
    GITHUB_APP_SLUG: str = "memo-app"

    # URLs
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    @property
    def github_private_key(self) -> Optional[str]:
        """Return the GitHub App private key, loading from file if needed."""
        if self.GITHUB_APP_PRIVATE_KEY:
            return self.GITHUB_APP_PRIVATE_KEY.replace("\\n", "\n")
        if self.GITHUB_APP_PRIVATE_KEY_PATH and os.path.exists(self.GITHUB_APP_PRIVATE_KEY_PATH):
            with open(self.GITHUB_APP_PRIVATE_KEY_PATH, "r") as f:
                return f.read()
        return None


settings = Settings()
