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

    # Authentication & Security (Strictly loaded from environment or .env)
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
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
    RATE_LIMIT_REQUESTS: int = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
    RATE_LIMIT_EDGE_REQUESTS: int = int(os.getenv("RATE_LIMIT_EDGE_REQUESTS", "300"))
    RATE_LIMIT_WINDOW: int = int(os.getenv("RATE_LIMIT_WINDOW", "60"))  # seconds
    ENABLE_RATE_LIMITING: bool = True
    EDGE_DEVICE_API_KEY: str = os.getenv("EDGE_DEVICE_API_KEY", "")

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "allow"
    }

    def validate_production_secrets(self):
        """Ensure no missing or weak credentials are permitted in production, and generate ephemeral keys in development."""
        import secrets
        import logging
        cfg_logger = logging.getLogger(__name__)
        is_prod = self.ENVIRONMENT.lower() in ("production", "prod") or (not self.DEBUG and os.getenv("ENVIRONMENT") == "production")

        if not self.SECRET_KEY:
            if is_prod:
                raise ValueError("FATAL SECURITY: SECRET_KEY environment variable is required and cannot be empty in production.")
            self.SECRET_KEY = secrets.token_urlsafe(32)
            cfg_logger.warning("No SECRET_KEY set in environment; generated ephemeral cryptographic key for dev session.")

        if not self.EDGE_DEVICE_API_KEY:
            if is_prod:
                raise ValueError("FATAL SECURITY: EDGE_DEVICE_API_KEY environment variable is required in production.")
            self.EDGE_DEVICE_API_KEY = "up_edge_" + secrets.token_hex(16)
            cfg_logger.warning("No EDGE_DEVICE_API_KEY set; generated ephemeral key for dev session.")

        if is_prod:
            insecure_secret_needles = ["urbanpulse-sih26124", "insecure", "change-in-prod", "dev-insecure", "secret-key", "12345"]
            if any(needle in self.SECRET_KEY.lower() for needle in insecure_secret_needles) or len(self.SECRET_KEY) < 32:
                raise ValueError("FATAL SECURITY VULNERABILITY: Insecure or default SECRET_KEY in production! Set a unique, cryptographically strong SECRET_KEY via environment variable.")
            if any(needle in self.EDGE_DEVICE_API_KEY.lower() for needle in ["dev-edge", "telemetry-key", "default"]):
                raise ValueError("FATAL SECURITY VULNERABILITY: Insecure or default EDGE_DEVICE_API_KEY in production! Set a unique key via environment variable.")

            # Validate that embedded demo passwords are not used in production
            demo_passwords = ["Admin@BEL2026", "Operator@BMTC2026", "Traffic@BTP2026", "PWD@BBMP2026", "Field@BBMP2026", "Viewer@Public2026"]
            for env_var in ["URBANPULSE_ADMIN_PASSWORD", "URBANPULSE_OPERATOR_PASSWORD", "URBANPULSE_TRAFFIC_PASSWORD", "URBANPULSE_PWD_PASSWORD", "URBANPULSE_FIELD_PASSWORD", "URBANPULSE_VIEWER_PASSWORD"]:
                val = os.getenv(env_var, "")
                if val and any(secrets.compare_digest(val, dp) for dp in demo_passwords):
                    raise ValueError(f"FATAL SECURITY VULNERABILITY: Embedded demo password detected in production variable {env_var}! Set a unique, strong password.")


settings = Settings()
settings.validate_production_secrets()

