"""Application Configuration Module (Control Layer Support).

Loads environment variables for database persistence, JWT signing, and CORS
origins in compliance with PassDown SRS §3.3.4 and NFR-04.
"""

import os


class Settings:
    """Centralized configuration settings loaded from environment variables.

    Attributes:
        PROJECT_NAME (str): Display title of the REST API service.
        API_V1_PREFIX (str): Base route prefix mandated by SRS §3.3.2.
        DATABASE_URL (str): SQLAlchemy connection string (PostgreSQL or SQLite).
        JWT_SECRET (str): Secret key used to sign and verify JWT tokens.
        JWT_ALGORITHM (str): Cryptographic signing algorithm for JWTs.
        JWT_EXPIRE_MINUTES (int): Token expiration window in minutes.
        CORS_ORIGINS (tuple[str, ...]): Permitted frontend origins for CORS middleware.
    """

    PROJECT_NAME: str = "PassDown API"
    API_V1_PREFIX: str = "/api/v1"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./passdown_dev.db")
    JWT_SECRET: str = os.getenv(
        "JWT_SECRET", "dev-only-secret-change-in-production-env"
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
    CORS_ORIGINS: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    )


settings = Settings()
