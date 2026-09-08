"""
Configuration management using environment variables.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    APP_NAME: str = "UrbanPulse Backend"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/urbanpulse"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    # Redis (for caching/session)
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    # Authentication
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Priority Engine
    PRIORITY_CONFIDENCE_WEIGHT: float = 0.20
    PRIORITY_OBSERVATION_WEIGHT: float = 0.25
    PRIORITY_BUS_DIVERSITY_WEIGHT: float = 0.20
    PRIORITY_RECURRENCE_WEIGHT: float = 0.15
    PRIORITY_SEVERITY_WEIGHT: float = 0.10
    PRIORITY_AGE_WEIGHT: float = 0.10
    
    # Spatial thresholds
    SPATIAL_CLUSTER_RADIUS_METERS: float = 15.0
    TEMPORAL_CLUSTER_WINDOW_MINUTES: int = 30
    MIN_OBSERVATIONS_FOR_VERIFICATION: int = 2
    
    # API Rate limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60  # seconds
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
