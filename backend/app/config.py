"""
Configuration management using environment variables.
"""

from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    APP_NAME: str = "UrbanPulse Backend"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    HOST: str = "0.0.0.0"
    PORT: int = int(os.getenv("PORT", "8001"))
    
    # Database: default to async SQLite for local execution, supports PostgreSQL/PostGIS
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./urbanpulse.db")
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    # Redis (optional for caching/session)
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
    ]
    
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Authentication & Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "urbanpulse-dev-insecure-secret-change-in-prod-883311")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Priority Engine Weights
    PRIORITY_CONFIDENCE_WEIGHT: float = 0.20
    PRIORITY_OBSERVATION_WEIGHT: float = 0.25
    PRIORITY_BUS_DIVERSITY_WEIGHT: float = 0.20
    PRIORITY_RECURRENCE_WEIGHT: float = 0.15
    PRIORITY_SEVERITY_WEIGHT: float = 0.10
    PRIORITY_AGE_WEIGHT: float = 0.10
    
    # Spatial & Consensus Thresholds
    SPATIAL_CLUSTER_RADIUS_METERS: float = 20.0
    TEMPORAL_CLUSTER_WINDOW_MINUTES: int = 60
    MIN_OBSERVATIONS_FOR_VERIFICATION: int = 2
    
    # Privacy & Camera
    BLUR_FACES_AND_PLATES: bool = True
    MIN_CAMERA_LAPLACIAN_VAR: float = 60.0  # Below this is considered blurry
    
    # API Rate limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60  # seconds
    ENABLE_RATE_LIMITING: bool = True
    EDGE_DEVICE_API_KEY: str = os.getenv("EDGE_DEVICE_API_KEY", "urbanpulse-dev-edge-key-2026")

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "allow"
    }

    def validate_production_secrets(self):
        """Ensure no weak/default credentials or keys are permitted in production."""
        is_prod = self.ENVIRONMENT.lower() in ("production", "prod") or (not self.DEBUG and os.getenv("ENVIRONMENT") == "production")
        if is_prod:
            insecure_secret_needles = ["urbanpulse-sih26124", "insecure", "change-in-prod", "dev-insecure", "secret-key"]
            if any(needle in self.SECRET_KEY.lower() for needle in insecure_secret_needles) or len(self.SECRET_KEY) < 32:
                raise ValueError("FATAL SECURITY VULNERABILITY: Insecure or default SECRET_KEY in production! Set a unique, cryptographically strong SECRET_KEY via environment variable.")
            if "dev-edge-key" in self.EDGE_DEVICE_API_KEY.lower() or "telemetry-key-2026" in self.EDGE_DEVICE_API_KEY.lower():
                raise ValueError("FATAL SECURITY VULNERABILITY: Insecure or default EDGE_DEVICE_API_KEY in production! Set a unique key via environment variable.")


settings = Settings()
settings.validate_production_secrets()

