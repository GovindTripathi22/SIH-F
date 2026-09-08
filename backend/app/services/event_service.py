"""
Event service for business logic and multi-pass pipeline integration.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import logging
import json

from app.models.event import RawEvent
from app.models.bus import Route
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
        a consolidated verified issue. Snaps GPS coordinate to corridor centerline when route exists.
        """
        # Validate GPS coordinates
        is_valid_gps, gps_msg = GPSService.validate_reading(
            event_data.latitude,
            event_data.longitude,
            event_data.gps_accuracy_meters
        )
        if not is_valid_gps:
            logger.warning(f"GPS quality warning for event {event_data.event_id}: {gps_msg}")

        # Check route corridor snapping if route is registered
        final_lat = event_data.latitude
        final_lon = event_data.longitude
        meta_dict = {}

        if getattr(event_data, 'metadata_json', None):
            try:
                meta_dict = json.loads(event_data.metadata_json)
            except Exception:
                meta_dict = {}

        if event_data.route_id:
            route_res = await self.db.execute(select(Route).where(Route.route_id == event_data.route_id))
            route = route_res.scalar_one_or_none()
            if route and route.start_latitude and route.end_latitude:
                s_lat, s_lon, cross_track = GPSService.snap_to_route_segment(
                    event_data.latitude,
                    event_data.longitude,
                    route.start_latitude,
                    route.start_longitude,
                    route.end_latitude,
                    route.end_longitude
                )
                if cross_track <= 40.0:
                    final_lat = round(s_lat, 6)
                    final_lon = round(s_lon, 6)
                    meta_dict["gps_snapped"] = True
                    meta_dict["cross_track_distance_m"] = round(cross_track, 2)
                    meta_dict["raw_coords"] = {"lat": event_data.latitude, "lon": event_data.longitude}

        # Construct spatial point string representation
        location_point = f"POINT({final_lon} {final_lat})"

        # Ensure timestamp has timezone
        event_time = event_data.timestamp
        if event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=timezone.utc)

        # Create raw event
        event = RawEvent(
            event_id=event_data.event_id,
            latitude=final_lat,
            longitude=final_lon,
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
            metadata_json=json.dumps(meta_dict) if meta_dict else None,
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
