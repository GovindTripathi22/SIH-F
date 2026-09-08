"""
Events API routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import datetime
import logging

from app.database import get_db
from app.models.event import RawEvent
from app.schemas.event import EventCreate, EventResponse, EventListResponse, EventFilter
from app.schemas.common import PaginatedResponse
from app.services.event_service import EventService

logger = logging.getLogger(__name__)

from app.core.security import get_event_ingestion_auth

router = APIRouter()


@router.post("/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event: EventCreate,
    auth: dict = Depends(get_event_ingestion_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new detection event.
    
    This endpoint receives detection events from the edge processing pipeline.
    Events are validated, stored, and queued for verification.
    """
    try:
        event_service = EventService(db)
        created_event = await event_service.create_event(event)
        
        logger.info(f"Event created: {event.event_id} from bus {event.bus_id}")
        
        return created_event
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating event: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create event"
        )


@router.get("/events", response_model=PaginatedResponse[EventResponse])
async def get_events(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    bus_id: Optional[str] = Query(None, description="Filter by bus ID"),
    route_id: Optional[str] = Query(None, description="Filter by route ID"),
    start_time: Optional[datetime] = Query(None, description="Start time filter"),
    end_time: Optional[datetime] = Query(None, description="End time filter"),
    min_confidence: Optional[float] = Query(None, ge=0, le=1, description="Minimum confidence"),
    processed: Optional[bool] = Query(None, description="Filter by processed status"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get paginated list of events with optional filters.
    
    Supports filtering by event type, bus, route, time range, and confidence.
    """
    try:
        # Build query
        query = select(RawEvent)
        
        # Apply filters
        if event_type:
            query = query.where(RawEvent.event_type == event_type)
        if bus_id:
            query = query.where(RawEvent.bus_id == bus_id)
        if route_id:
            query = query.where(RawEvent.route_id == route_id)
        if start_time:
            query = query.where(RawEvent.timestamp >= start_time)
        if end_time:
            query = query.where(RawEvent.timestamp <= end_time)
        if min_confidence is not None:
            query = query.where(RawEvent.confidence >= min_confidence)
        if processed is not None:
            query = query.where(RawEvent.processed == processed)
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.order_by(RawEvent.timestamp.desc()).offset(offset).limit(page_size)
        
        # Execute query
        result = await db.execute(query)
        events = result.scalars().all()
        
        return PaginatedResponse.create(
            items=events,
            total=total,
            page=page,
            page_size=page_size
        )
    except Exception as e:
        logger.error(f"Error fetching events: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch events"
        )


@router.get("/events/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific event by ID.
    """
    try:
        query = select(RawEvent).where(RawEvent.event_id == event_id)
        result = await db.execute(query)
        event = result.scalar_one_or_none()
        
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event {event_id} not found"
            )
        
        return event
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching event {event_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch event"
        )


@router.get("/events/stats/summary")
async def get_event_stats(
    start_time: Optional[datetime] = Query(None, description="Start time"),
    end_time: Optional[datetime] = Query(None, description="End time"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get event statistics summary.
    """
    try:
        query = select(RawEvent)
        
        if start_time:
            query = query.where(RawEvent.timestamp >= start_time)
        if end_time:
            query = query.where(RawEvent.timestamp <= end_time)
        
        # Total events
        total_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(total_query)
        total = total_result.scalar()
        
        # Events by type
        type_query = select(
            RawEvent.event_type,
            func.count(RawEvent.id).label('count')
        ).group_by(RawEvent.event_type)
        
        if start_time:
            type_query = type_query.where(RawEvent.timestamp >= start_time)
        if end_time:
            type_query = type_query.where(RawEvent.timestamp <= end_time)
        
        type_result = await db.execute(type_query)
        by_type = {row[0]: row[1] for row in type_result.all()}
        
        # Average confidence
        avg_conf_query = select(func.avg(RawEvent.confidence))
        if start_time:
            avg_conf_query = avg_conf_query.where(RawEvent.timestamp >= start_time)
        if end_time:
            avg_conf_query = avg_conf_query.where(RawEvent.timestamp <= end_time)
        
        avg_conf_result = await db.execute(avg_conf_query)
        avg_confidence = avg_conf_result.scalar()
        
        return {
            "total_events": total,
            "events_by_type": by_type,
            "average_confidence": float(avg_confidence) if avg_confidence else 0.0
        }
    except Exception as e:
        logger.error(f"Error fetching event stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch event statistics"
        )
