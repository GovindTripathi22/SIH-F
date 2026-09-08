"""
UrbanPulse Central Backend - FastAPI Application

Main entry point for the urban intelligence platform backend.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from contextlib import asynccontextmanager
from sqlalchemy import select, func

from app.config import settings
from app.database import init_db, close_db, async_session
from app.api import events, issues, fleet, analytics, auth, cv, work_orders
from app.middleware.audit import AuditMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.services.cv_service import RoadDefectYOLOEngine

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting UrbanPulse backend...")
    await init_db()
    logger.info("Database initialized with seed data")
    
    # Warm up YOLO model
    try:
        RoadDefectYOLOEngine.get_instance()
        logger.info("YOLOv8 Engine preloaded")
    except Exception as e:
        logger.warning(f"YOLOv8 preload skipped or deferred: {e}")

    yield
    
    # Shutdown
    logger.info("Shutting down UrbanPulse backend...")
    await close_db()
    logger.info("Database connections closed")


# Create FastAPI application
app = FastAPI(
    title="UrbanPulse API",
    description="AI-Powered Mobile Urban Intelligence Platform for Public Transport Fleets (BEL × SIH26124)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Audit middleware
app.add_middleware(AuditMiddleware)
app.add_middleware(RateLimitMiddleware)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unhandled exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred",
            "detail": str(exc) if settings.DEBUG else None
        }
    )


# Enhanced Observability Health Check Endpoint (Phase 19)
@app.get("/health", tags=["System"])
async def health_check():
    """System health check endpoint returning status of all subsystems"""
    db_status = "UNKNOWN"
    issue_count = 0
    bus_count = 0
    try:
        async with async_session() as session:
            from app.models.issue import VerifiedIssue
            from app.models.bus import Bus
            res_issues = await session.execute(select(func.count(VerifiedIssue.issue_id)))
            issue_count = res_issues.scalar() or 0
            res_buses = await session.execute(select(func.count(Bus.bus_id)))
            bus_count = res_buses.scalar() or 0
            db_status = "ONLINE"
    except Exception as e:
        db_status = f"DEGRADED: {str(e)}"

    cv_engine = RoadDefectYOLOEngine.get_instance()
    cv_info = cv_engine.get_model_metadata()

    return {
        "status": "healthy",
        "service": "UrbanPulse Backend",
        "version": "1.0.0",
        "subsystems": {
            "backend": "ONLINE",
            "database": db_status,
            "database_stats": {
                "verified_issues": issue_count,
                "fleet_buses": bus_count
            },
            "cv_engine": "READY" if cv_info.get("is_loaded") else "DEGRADED",
            "cv_details": cv_info,
            "privacy_engine": "ACTIVE",
            "work_order_engine": "ACTIVE",
            "multi_pass_consensus": "ACTIVE",
            "edge_resilience": "PERSISTENT_SQLITE_QUEUE"
        }
    }


# Include API routers
app.include_router(auth.router, prefix="/api/v1", tags=["Authentication & RBAC"])
app.include_router(events.router, prefix="/api/v1", tags=["Events"])
app.include_router(issues.router, prefix="/api/v1", tags=["Issues"])
app.include_router(fleet.router, prefix="/api/v1", tags=["Fleet"])
app.include_router(analytics.router, prefix="/api/v1", tags=["Analytics"])
app.include_router(cv.router, prefix="/api/v1", tags=["Edge CV Engine"])
app.include_router(work_orders.router, prefix="/api/v1", tags=["Work Orders & Closed Loop"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
