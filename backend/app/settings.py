from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from typing import List

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/app -> backend

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        extra="ignore",
    )

    DATABASE_URL: str
    CORS_ORIGINS: str = "http://localhost:3000"
    DEFAULT_USER_ID: str = "00000000-0000-0000-0000-000000000001"
    JWT_SECRET: str  # from env
    JWT_ALG: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = 15
    REFRESH_TOKEN_DAYS: int = 30
    COOKIE_SECURE: bool = False  # True in prod (https)

    def cors_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

settings = Settings()
