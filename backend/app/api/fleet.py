"""
Fleet API routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime, timedelta
import logging

from app.database import get_db
from app.models.bus import Bus, Route
from app.models.event import RawEvent
from app.schemas.bus import BusResponse, BusListResponse, RouteResponse, RouteListResponse, FleetSummary

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/fleet", response_model=FleetSummary)
async def get_fleet_summary(
    db: AsyncSession = Depends(get_db)
):
    """
    Get fleet summary statistics.
    """
    try:
        # Total buses
        total_query = select(func.count(Bus.bus_id))
        total_result = await db.execute(total_query)
        total_buses = total_result.scalar()
        
        # Buses by status
        status_query = select(
            Bus.current_status,
            func.count(Bus.bus_id).label('count')
        ).group_by(Bus.current_status)
        status_result = await db.execute(status_query)
        status_counts = {row[0]: row[1] for row in status_result.all()}
        
        # Events today
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        events_today_query = select(func.count(RawEvent.id)).where(
            RawEvent.timestamp >= today
        )
        events_today_result = await db.execute(events_today_query)
        events_today = events_today_result.scalar()
        
        # Total routes
        routes_query = select(func.count(Route.route_id))
        routes_result = await db.execute(routes_query)
        total_routes = routes_result.scalar()
        
        # Active routes
        active_routes_query = select(func.count(Route.route_id)).where(
            Route.is_active == True
        )
        active_routes_result = await db.execute(active_routes_query)
        active_routes = active_routes_result.scalar()
        
        # Calculate averages
        active_buses = status_counts.get('ACTIVE', 0)
        avg_events_per_bus = events_today / active_buses if active_buses > 0 else 0
        
        return FleetSummary(
            total_buses=total_buses,
            active_buses=status_counts.get('ACTIVE', 0),
            idle_buses=status_counts.get('IDLE', 0),
            maintenance_buses=status_counts.get('MAINTENANCE', 0),
            offline_buses=status_counts.get('OFFLINE', 0),
            total_events_today=events_today,
            avg_events_per_bus=avg_events_per_bus,
            total_routes=total_routes,
            active_routes=active_routes
        )
    except Exception as e:
        logger.error(f"Error fetching fleet summary: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch fleet summary"
        )


@router.get("/buses", response_model=BusListResponse)
async def get_buses(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    route_id: Optional[str] = Query(None, description="Filter by route"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of all buses with optional filters.
    """
    try:
        query = select(Bus)
        
        if status_filter:
            query = query.where(Bus.current_status == status_filter)
        if route_id:
            query = query.where(Bus.current_route_id == route_id)
        
        query = query.order_by(Bus.bus_id)
        
        result = await db.execute(query)
        buses = result.scalars().all()
        
        return BusListResponse(
            buses=buses,
            total=len(buses)
        )
    except Exception as e:
        logger.error(f"Error fetching buses: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch buses"
        )


@router.get("/buses/{bus_id}", response_model=BusResponse)
async def get_bus(
    bus_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get details of a specific bus.
    """
    try:
        query = select(Bus).where(Bus.bus_id == bus_id)
        result = await db.execute(query)
        bus = result.scalar_one_or_none()
        
        if not bus:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bus {bus_id} not found"
            )
        
        return bus
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching bus {bus_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch bus"
        )


@router.get("/routes", response_model=RouteListResponse)
async def get_routes(
    active_only: bool = Query(default=False, description="Only active routes"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of all routes.
    """
    try:
        query = select(Route)
        
        if active_only:
            query = query.where(Route.is_active == True)
        
        query = query.order_by(Route.route_number)
        
        result = await db.execute(query)
        routes = result.scalars().all()
        
        return RouteListResponse(
            routes=routes,
            total=len(routes)
        )
    except Exception as e:
        logger.error(f"Error fetching routes: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch routes"
        )


@router.get("/routes/{route_id}", response_model=RouteResponse)
async def get_route(
    route_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get details of a specific route.
    """
    try:
        query = select(Route).where(Route.route_id == route_id)
        result = await db.execute(query)
        route = result.scalar_one_or_none()
        
        if not route:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Route {route_id} not found"
            )
        
        return route
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching route {route_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch route"
        )
