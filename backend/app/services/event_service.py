"""
Event service for business logic.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint
from datetime import datetime
import uuid
import logging

from app.models.event import RawEvent
from app.schemas.event import EventCreate

logger = logging.getLogger(__name__)


class EventService:
    """Service for event-related business logic"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_event(self, event_data: EventCreate) -> RawEvent:
        """Create a new event with PostGIS geography point"""
        
        # Create PostGIS point
        location = ST_SetSRID(ST_MakePoint(event_data.longitude, event_data.latitude), 4326)
        
        # Create event
        event = RawEvent(
            event_id=event_data.event_id,
            latitude=event_data.latitude,
            longitude=event_data.longitude,
            location=location,
            timestamp=event_data.timestamp,
            bus_id=event_data.bus_id,
            route_id=event_data.route_id,
            camera_id=event_data.camera_id,
            event_type=event_data.event_type.value,
            confidence=event_data.confidence,
            validation_score=event_data.validation_score,
            gps_accuracy_meters=event_data.gps_accuracy_meters,
            frame_reference=event_data.frame_reference,
            processed=False
        )
        
        self.db.add(event)
        await self.db.flush()
        await self.db.refresh(event)
        
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
