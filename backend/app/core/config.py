from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional
import os
import dotenv
dotenv.load_dotenv()

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/synopsis_portal"

    # JWT
    SECRET_KEY: str = "synopsis-super-secret-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # File Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_BYTES: int = 10 * 1024 * 1024  # 10MB

    # App
    APP_NAME: str = "Synopsis Review Portal"
    DEBUG: bool = True
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    #SMTP Email Settings
    SMTP_ENABLED: bool = True
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USE_TLS: bool = True
    SMTP_USERNAME: Optional[str] = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD")
    EMAIL_FROM_NAME: str = os.getenv("EMAIL_FROM_NAME") or APP_NAME
    EMAIL_FROM_ADDRESS: str = os.getenv("EMAIL_FROM_ADDRESS") or os.getenv("SMTP_USERNAME") or ""
    FRONTEND_URL: str = os.getenv("FRONTEND_URL") or "http://localhost:5173"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
