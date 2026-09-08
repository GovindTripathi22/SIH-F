"""
Event service for business logic and multi-pass pipeline integration.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import logging

from app.models.event import RawEvent
from app.schemas.event import EventCreate
from app.services.spatial_clustering import MultiPassVerificationEngine
from app.services.gps_service import GPSService

logger = logging.getLogger(__name__)


class EventService:
    """Service for event ingestion and automated multi-pass verification"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.clustering_engine = MultiPassVerificationEngine(db)
    
    async def create_event(self, event_data: EventCreate) -> RawEvent:
        """
        Create a new raw event and execute multi-pass verification to update or create
        a consolidated verified issue.
        """
        # Validate GPS coordinates
        is_valid_gps, gps_msg = GPSService.validate_reading(
            event_data.latitude,
            event_data.longitude,
            event_data.gps_accuracy_meters
        )
        if not is_valid_gps:
            logger.warning(f"GPS quality warning for event {event_data.event_id}: {gps_msg}")

        # Construct spatial point string representation
        location_point = f"POINT({event_data.longitude} {event_data.latitude})"

        # Ensure timestamp has timezone
        event_time = event_data.timestamp
        if event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=timezone.utc)

        # Create raw event
        event = RawEvent(
            event_id=event_data.event_id,
            latitude=event_data.latitude,
            longitude=event_data.longitude,
            location=location_point,
            timestamp=event_time,
            bus_id=event_data.bus_id,
            route_id=event_data.route_id,
            camera_id=event_data.camera_id,
            event_type=event_data.event_type.value if hasattr(event_data.event_type, 'value') else str(event_data.event_type),
            confidence=event_data.confidence,
            validation_score=event_data.validation_score,
            gps_accuracy_meters=event_data.gps_accuracy_meters,
            frame_reference=event_data.frame_reference,
            processed=False
        )
        
        self.db.add(event)
        await self.db.flush()
        await self.db.refresh(event)
        
        # Execute multi-pass verification clustering
        issue, is_new = await self.clustering_engine.ingest_event_into_cluster(event)
        event.processed = True
        await self.db.flush()

        logger.info(
            f"Processed event {event.event_id}: mapped to issue {issue.issue_id} "
            f"(new={is_new}, total_obs={issue.observation_count}, distinct_buses={issue.distinct_bus_count})"
        )
        
        return event
    
    async def get_event_by_id(self, event_id: str) -> RawEvent:
        """Get event by ID"""
        query = select(RawEvent).where(RawEvent.event_id == event_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def mark_as_processed(self, event_id: str):
        """Mark event as processed"""
        event = await self.get_event_by_id(event_id)
        if event:
            event.processed = True
            await self.db.flush()
