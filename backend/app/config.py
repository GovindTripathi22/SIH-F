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
    
    # Authentication & Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "urbanpulse-sih26124-production-secret-key-998822")
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
    EDGE_DEVICE_API_KEY: str = os.getenv("EDGE_DEVICE_API_KEY", "urbanpulse-edge-bus-telemetry-key-2026")

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "allow"
    }


settings = Settings()
