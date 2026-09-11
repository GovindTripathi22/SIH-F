"""
Database connection and session management for PostgreSQL/PostGIS and SQLite.
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import select, func, text
from datetime import datetime, timezone
from typing import Optional
import json
import logging
import os
import sqlite3

from app.config import settings

logger = logging.getLogger(__name__)

# Engine configuration depending on dialect
engine_kwargs = {"echo": settings.DEBUG}
if "sqlite" not in settings.DATABASE_URL:
    engine_kwargs["pool_size"] = settings.DATABASE_POOL_SIZE
    engine_kwargs["max_overflow"] = settings.DATABASE_MAX_OVERFLOW
else:
    # 30-second busy timeout prevents 'database is locked' errors under high-frequency writes
    engine_kwargs["connect_args"] = {"timeout": 30.0}

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_kwargs
)

# Create async session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


class Base(DeclarativeBase):
    """Base class for all database models"""
    pass


def get_amravati_buses(now: datetime):
    """Factory for standard Amravati fleet telemetry seed data"""
    from app.models.bus import Bus
    return [
        Bus(
            bus_id="bus-mh27-01",
            registration_number="MH-27-X-4011",
            bus_type="MSRTC City MidiBus",
            capacity=34,
            camera_id="cam-amr-01-fwd",
            camera_status="ONLINE",
            current_route_id="Route 1A (Badnera-Rajkamal)",
            current_status="ACTIVE",
            current_latitude=20.9250,
            current_longitude=77.7560,
            last_speed_kmh=32.0,
            last_ping=now,
            total_events_detected=16,
            total_distance_km=142.5
        ),
        Bus(
            bus_id="bus-mh27-02",
            registration_number="MH-27-X-4012",
            bus_type="Tata Starbus Urban",
            capacity=40,
            camera_id="cam-amr-02-fwd",
            camera_status="ONLINE",
            current_route_id="Route 3 (Irwin-SGBAU)",
            current_status="ACTIVE",
            current_latitude=20.9520,
            current_longitude=77.7680,
            last_speed_kmh=26.5,
            last_ping=now,
            total_events_detected=21,
            total_distance_km=165.0
        ),
        Bus(
            bus_id="bus-mh27-03",
            registration_number="MH-27-X-4013",
            bus_type="Ashok Leyland Mitr",
            capacity=30,
            camera_id="cam-amr-03-fwd",
            camera_status="ONLINE",
            current_route_id="Route 5 (CottonMarket-Walgaon)",
            current_status="ACTIVE",
            current_latitude=20.9410,
            current_longitude=77.7490,
            last_speed_kmh=35.0,
            last_ping=now,
            total_events_detected=11,
            total_distance_km=118.0
        ),
    ]


def get_amravati_issues(now: datetime):
    """Factory for standard Amravati verified civic issues seed data"""
    from app.models.issue import VerifiedIssue
    return [
        VerifiedIssue(
            issue_id="amr-issue-001",
            centroid_latitude=20.9258,
            centroid_longitude=77.7582,
            event_type="pothole",
            severity="SAFETY_HAZARD",
            priority="CRITICAL",
            status="PENDING",
            verification_state="VERIFIED",
            observation_count=5,
            distinct_bus_count=3,
            confidence=0.95,
            verification_score=0.93,
            priority_score=92.5,
            first_observed=now,
            last_observed=now,
            cluster_radius_meters=11.8,
            priority_reasons=json.dumps([
                "Deep impact pothole (~45cm diameter, 9cm depth) on Badnera Road NH-53 approach",
                "Near Rajapeth Flyover landing - heavy truck and bus corridor",
                "Corroborated by 3 distinct MSRTC transit buses (BUS-MH27-01, BUS-MH27-04)",
                "Severe two-wheeler skid hazard reported to AMC & PWD Amravati"
            ])
        ),
        VerifiedIssue(
            issue_id="amr-issue-002",
            centroid_latitude=20.9465,
            centroid_longitude=77.7650,
            event_type="road_crack",
            severity="SEVERE",
            priority="HIGH",
            status="IN_PROGRESS",
            verification_state="ACTIONED",
            observation_count=3,
            distinct_bus_count=2,
            confidence=0.87,
            verification_score=0.85,
            priority_score=81.0,
            first_observed=now,
            last_observed=now,
            cluster_radius_meters=14.2,
            priority_reasons=json.dumps([
                "Extensive longitudinal fatigue cracking on Morshi State Highway corridor",
                "Near Panchavati Square to Tapovan junction",
                "Corroborated by BUS-MH27-02 and BUS-MH27-03"
            ])
        ),
        VerifiedIssue(
            issue_id="amr-issue-003",
            centroid_latitude=20.9320,
            centroid_longitude=77.7510,
            event_type="waterlogging",
            severity="SAFETY_HAZARD",
            priority="CRITICAL",
            status="PENDING",
            verification_state="VERIFIED",
            observation_count=4,
            distinct_bus_count=2,
            confidence=0.94,
            verification_score=0.92,
            priority_score=95.0,
            first_observed=now,
            last_observed=now,
            cluster_radius_meters=16.0,
            priority_reasons=json.dumps([
                "Severe storm drain overflow (>25cm water depth) under Irwin Hospital railway subway",
                "Subway impassable for two-wheelers and auto-rickshaws",
                "Critical transit link between Old City and Amravati Railway Station"
            ])
        ),
        VerifiedIssue(
            issue_id="amr-issue-004",
            centroid_latitude=20.9680,
            centroid_longitude=77.7725,
            event_type="pothole",
            severity="MODERATE",
            priority="HIGH",
            status="PENDING",
            verification_state="VERIFIED",
            observation_count=3,
            distinct_bus_count=2,
            confidence=0.89,
            verification_score=0.87,
            priority_score=79.0,
            first_observed=now,
            last_observed=now,
            cluster_radius_meters=12.0,
            priority_reasons=json.dumps([
                "Asphalt disintegration and clustered potholes on SGBAU University Gate approach",
                "High density student two-wheeler traffic on Tapovan Road"
            ])
        ),
    ]


async def seed_initial_data():
    """
    Idempotently seed initial buses, routes, and verified issues into database.
    Retains Amravati factory seed source, executes only after migrations are applied,
    and does not overwrite existing records.
    """
    from app.models.bus import Bus, Route
    from app.models.issue import VerifiedIssue
    from app.models.event import RawEvent, EventObservation

    logger.info("Synchronizing initial fleet and infrastructure seed data into database...")
    now = datetime.now(timezone.utc)

    # Seed Routes
    routes = [
        Route(
            route_id="route-1",
            route_number="201-C",
            route_name="Koramangala → Indiranagar",
            start_latitude=12.9352,
            start_longitude=77.6245,
            end_latitude=12.9719,
            end_longitude=77.6412,
            distance_km=8.5,
            estimated_duration_minutes=25,
            is_active=True
        ),
        Route(
            route_id="route-2",
            route_number="500-D",
            route_name="Majestic → Whitefield",
            start_latitude=12.9716,
            start_longitude=77.5946,
            end_latitude=12.9698,
            end_longitude=77.7499,
            distance_km=22.0,
            estimated_duration_minutes=55,
            is_active=True
        ),
        Route(
            route_id="route-3",
            route_number="335-A",
            route_name="Yelahanka → Electronic City",
            start_latitude=13.1007,
            start_longitude=77.5963,
            end_latitude=12.8456,
            end_longitude=77.6603,
            distance_km=45.0,
            estimated_duration_minutes=90,
            is_active=True
        ),
    ]

    # Seed Buses
    now = datetime.now(timezone.utc)
    buses = [
        Bus(
            bus_id="bus-01",
            registration_number="KA-01-F-4521",
            bus_type="Electric Volvo 9400",
            capacity=45,
            camera_id="cam-01-fwd",
            camera_status="ONLINE",
            current_route_id="route-1",
            current_status="ACTIVE",
            current_latitude=12.9385,
            current_longitude=77.6280,
            last_speed_kmh=32.4,
            last_ping=now,
            total_events_detected=14,
            total_distance_km=142.5
        ),
        Bus(
            bus_id="bus-02",
            registration_number="KA-01-F-4522",
            bus_type="Electric Volvo 9400",
            capacity=45,
            camera_id="cam-02-fwd",
            camera_status="ONLINE",
            current_route_id="route-1",
            current_status="ACTIVE",
            current_latitude=12.9510,
            current_longitude=77.6320,
            last_speed_kmh=28.1,
            last_ping=now,
            total_events_detected=19,
            total_distance_km=165.2
        ),
        Bus(
            bus_id="bus-03",
            registration_number="KA-57-E-1102",
            bus_type="Tata Starbus Ultra",
            capacity=36,
            camera_id="cam-03-fwd",
            camera_status="ONLINE",
            current_route_id="route-2",
            current_status="ACTIVE",
            current_latitude=12.9720,
            current_longitude=77.6100,
            last_speed_kmh=41.0,
            last_ping=now,
            total_events_detected=8,
            total_distance_km=210.0
        ),
        Bus(
            bus_id="bus-04",
            registration_number="KA-57-E-1103",
            bus_type="Tata Starbus Ultra",
            capacity=36,
            camera_id="cam-04-fwd",
            camera_status="ONLINE",
            current_route_id="route-2",
            current_status="ACTIVE",
            current_latitude=12.9705,
            current_longitude=77.6800,
            last_speed_kmh=35.5,
            last_ping=now,
            total_events_detected=11,
            total_distance_km=188.4
        ),
        Bus(
            bus_id="bus-05",
            registration_number="KA-04-G-8821",
            bus_type="Ashok Leyland JanBus",
            capacity=50,
            camera_id="cam-05-fwd",
            camera_status="ONLINE",
            current_route_id="route-3",
            current_status="ACTIVE",
            current_latitude=13.0100,
            current_longitude=77.5980,
            last_speed_kmh=38.0,
            last_ping=now,
            total_events_detected=22,
            total_distance_km=305.1
        ),
        # Amravati (Maharashtra - MH-27) Fleet
        *get_amravati_buses(now)
    ]

    # Seed Verified Issues with full multi-pass evidence
    issues = [
        VerifiedIssue(
            issue_id="issue-001",
            centroid_latitude=12.9342,
            centroid_longitude=77.6101,
            event_type="pothole",
            severity="SAFETY_HAZARD",
            priority="CRITICAL",
            status="PENDING",
            verification_state="VERIFIED",
            observation_count=6,
            distinct_bus_count=3,
            confidence=0.96,
            verification_score=0.94,
            priority_score=94.5,
            first_observed=now,
            last_observed=now,
            cluster_radius_meters=12.4,
            priority_reasons=json.dumps([
                "Severe deep pothole on high-density 100ft Road",
                "Multiple independent fleet confirmations (Bus-01, Bus-02, Bus-04)",
                "High confidence CV detection: 96%",
                "Near heavy pedestrian junction (Silk Board corridor)"
            ])
        ),
        VerifiedIssue(
            issue_id="issue-002",
            centroid_latitude=12.9752,
            centroid_longitude=77.6067,
            event_type="road_crack",
            severity="SEVERE",
            priority="HIGH",
            status="IN_PROGRESS",
            verification_state="ACTIONED",
            observation_count=4,
            distinct_bus_count=2,
            confidence=0.88,
            verification_score=0.85,
            priority_score=82.0,
            first_observed=now,
            last_observed=now,
            cluster_radius_meters=15.0,
            priority_reasons=json.dumps([
                "Extensive longitudinal cracking on MG Road bridge approach",
                "Dual-bus persistence confirmed",
                "High traffic volume route"
            ])
        ),
        VerifiedIssue(
            issue_id="issue-003",
            centroid_latitude=12.9784,
            centroid_longitude=77.6408,
            event_type="waterlogging",
            severity="SAFETY_HAZARD",
            priority="CRITICAL",
            status="PENDING",
            verification_state="VERIFIED",
            observation_count=5,
            distinct_bus_count=3,
            confidence=0.92,
            verification_score=0.91,
            priority_score=91.0,
            first_observed=now,
            last_observed=now,
            cluster_radius_meters=18.5,
            priority_reasons=json.dumps([
                "Severe sub-surface drainage overflow near Indiranagar 12th Main",
                "Flooding spans entire left lane",
                "3 independent fleet units confirmed within 30 min"
            ])
        ),
        VerifiedIssue(
            issue_id="issue-004",
            centroid_latitude=12.9298,
            centroid_longitude=77.6844,
            event_type="pothole",
            severity="MODERATE",
            priority="MEDIUM",
            status="RESOLVED",
            verification_state="RESOLUTION_VERIFIED",
            observation_count=3,
            distinct_bus_count=2,
            confidence=0.84,
            verification_score=0.82,
            priority_score=68.0,
            first_observed=now,
            last_observed=now,
            cluster_radius_meters=10.2,
            resolved_at=now,
            resolved_by="PWD_BBMP_TEAM_4",
            resolution_notes="Cold-mix asphalt patching completed and verified by subsequent bus passes.",
            priority_reasons=json.dumps([
                "Medium pothole on Bellandur service road",
                "Cold asphalt repair executed by BBMP Ward 150"
            ])
        ),
        # Amravati (Maharashtra) Verified Issues
        *get_amravati_issues(now)
    ]

    async with async_session() as session:
        # Check and add routes idempotently
        existing_route_ids = set((await session.execute(select(Route.route_id))).scalars().all())
        new_routes = [r for r in routes if r.route_id not in existing_route_ids]
        if new_routes:
            session.add_all(new_routes)

        # Check and add buses idempotently
        existing_bus_ids = set((await session.execute(select(Bus.bus_id))).scalars().all())
        new_buses = [b for b in buses if b.bus_id not in existing_bus_ids]
        if new_buses:
            session.add_all(new_buses)

        # Check and add issues idempotently
        existing_issue_ids = set((await session.execute(select(VerifiedIssue.issue_id))).scalars().all())
        new_issues = [i for i in issues if i.issue_id not in existing_issue_ids]
        if new_issues:
            session.add_all(new_issues)

        await session.commit()
        logger.info(f"Idempotent seed complete: added {len(new_routes)} routes, {len(new_buses)} buses, {len(new_issues)} issues.")


def apply_migrations(db_url: Optional[str] = None):
    """
    Run Alembic schema migrations as the sole authoritative schema migration mechanism.
    Upgrades the database to the current head revision.
    """
    from alembic.config import Config
    from alembic import command
    alembic_cfg_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic.ini")
    alembic_cfg = Config(alembic_cfg_path)
    target_url = db_url or settings.DATABASE_URL
    alembic_cfg.set_main_option("sqlalchemy.url", target_url)

    # Dialect-aware check: if SQLite file or Postgres, check if tables exist without alembic_version
    if "sqlite" in target_url:
        db_path = target_url.split("///")[-1]
        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version';")
                has_alembic = cursor.fetchone() is not None
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='verified_issues';")
                has_tables = cursor.fetchone() is not None
                conn.close()
                if has_tables and not has_alembic:
                    # Legacy database created before Alembic: stamp with head
                    command.stamp(alembic_cfg, "head")
            except Exception as e:
                logger.warning(f"SQLite pre-migration check warning: {e}")

    command.upgrade(alembic_cfg, "head")
    logger.info("Alembic schema migration successfully applied (head).")


async def init_db():
    """Initialize database - apply Alembic migrations explicitly, then run idempotent seed data."""
    async with engine.begin() as conn:
        if "sqlite" in settings.DATABASE_URL:
            try:
                await conn.execute(text("PRAGMA journal_mode=WAL;"))
                await conn.execute(text("PRAGMA synchronous=NORMAL;"))
            except Exception as e:
                logger.warning(f"Could not enable SQLite WAL mode: {e}")

    # Alembic is the only schema migration mechanism (replaces create_all & inline ALTER)
    apply_migrations()
    await seed_initial_data()


async def close_db():
    """Close database connections"""
    await engine.dispose()


async def get_db():
    """Dependency to get database session"""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
