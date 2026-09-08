"""
Analytics API routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case
from typing import Optional
from datetime import datetime, timedelta
import logging

from app.database import get_db
from app.models.event import RawEvent
from app.models.issue import VerifiedIssue
from app.models.bus import Bus

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/analytics/traffic")
async def get_traffic_analytics(
    hours: int = Query(default=24, ge=1, le=168, description="Hours to analyze"),
    route_id: Optional[str] = Query(None, description="Filter by route"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get traffic analytics based on event detection patterns.
    
    Uses event frequency as a proxy for traffic volume and congestion.
    """
    try:
        start_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Events per hour
        hourly_query = select(
            func.date_trunc('hour', RawEvent.timestamp).label('hour'),
            func.count(RawEvent.id).label('event_count'),
            func.count(func.distinct(RawEvent.bus_id)).label('bus_count')
        ).where(
            RawEvent.timestamp >= start_time
        )
        
        if route_id:
            hourly_query = hourly_query.where(RawEvent.route_id == route_id)
        
        hourly_query = hourly_query.group_by('hour').order_by('hour')
        
        hourly_result = await db.execute(hourly_query)
        hourly_data = [
            {
                "hour": row[0].isoformat(),
                "event_count": row[1],
                "bus_count": row[2],
                "events_per_bus": row[1] / row[2] if row[2] > 0 else 0
            }
            for row in hourly_result.all()
        ]
        
        # Events by route
        route_query = select(
            RawEvent.route_id,
            func.count(RawEvent.id).label('event_count'),
            func.count(func.distinct(RawEvent.bus_id)).label('bus_count')
        ).where(
            RawEvent.timestamp >= start_time
        ).group_by(RawEvent.route_id).order_by(func.count(RawEvent.id).desc())
        
        route_result = await db.execute(route_query)
        route_data = [
            {
                "route_id": row[0],
                "event_count": row[1],
                "bus_count": row[2]
            }
            for row in route_result.all()
        ]
        
        # Summary
        total_events = sum(h['event_count'] for h in hourly_data)
        avg_events_per_hour = total_events / len(hourly_data) if hourly_data else 0
        
        return {
            "period_hours": hours,
            "total_events": total_events,
            "average_events_per_hour": avg_events_per_hour,
            "hourly_breakdown": hourly_data,
            "route_breakdown": route_data
        }
    except Exception as e:
        logger.error(f"Error fetching traffic analytics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch traffic analytics"
        )


@router.get("/analytics/road-health")
async def get_road_health_analytics(
    days: int = Query(default=7, ge=1, le=90, description="Days to analyze"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get road health analytics based on verified issues.
    """
    try:
        start_time = datetime.utcnow() - timedelta(days=days)
        
        # Issues by event type
        type_query = select(
            VerifiedIssue.event_type,
            func.count(VerifiedIssue.issue_id).label('count'),
            func.avg(VerifiedIssue.priority_score).label('avg_priority'),
            func.avg(VerifiedIssue.verification_score).label('avg_verification')
        ).where(
            VerifiedIssue.first_observed >= start_time
        ).group_by(VerifiedIssue.event_type)
        
        type_result = await db.execute(type_query)
        by_type = [
            {
                "event_type": row[0],
                "count": row[1],
                "avg_priority_score": float(row[2]) if row[2] else 0,
                "avg_verification_score": float(row[3]) if row[3] else 0
            }
            for row in type_result.all()
        ]
        
        # Issues by priority
        priority_query = select(
            VerifiedIssue.priority,
            func.count(VerifiedIssue.issue_id).label('count')
        ).where(
            VerifiedIssue.first_observed >= start_time
        ).group_by(VerifiedIssue.priority)
        
        priority_result = await db.execute(priority_query)
        by_priority = {row[0]: row[1] for row in priority_result.all()}
        
        # Resolution rate
        resolved_query = select(func.count(VerifiedIssue.issue_id)).where(
            and_(
                VerifiedIssue.first_observed >= start_time,
                VerifiedIssue.status == 'RESOLVED'
            )
        )
        resolved_result = await db.execute(resolved_query)
        resolved_count = resolved_result.scalar()
        
        total_query = select(func.count(VerifiedIssue.issue_id)).where(
            VerifiedIssue.first_observed >= start_time
        )
        total_result = await db.execute(total_query)
        total_count = total_result.scalar()
        
        resolution_rate = resolved_count / total_count if total_count > 0 else 0
        
        # Average time to resolution
        resolution_time_query = select(
            func.avg(
                func.extract('epoch', VerifiedIssue.resolved_at) - 
                func.extract('epoch', VerifiedIssue.first_observed)
            )
        ).where(
            and_(
                VerifiedIssue.first_observed >= start_time,
                VerifiedIssue.status == 'RESOLVED',
                VerifiedIssue.resolved_at.isnot(None)
            )
        )
        
        resolution_time_result = await db.execute(resolution_time_query)
        avg_resolution_seconds = resolution_time_result.scalar()
        avg_resolution_hours = avg_resolution_seconds / 3600 if avg_resolution_seconds else 0
        
        return {
            "period_days": days,
            "total_issues": total_count,
            "resolved_issues": resolved_count,
            "resolution_rate": resolution_rate,
            "avg_resolution_time_hours": avg_resolution_hours,
            "issues_by_type": by_type,
            "issues_by_priority": by_priority
        }
    except Exception as e:
        logger.error(f"Error fetching road health analytics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch road health analytics"
        )


@router.get("/analytics/fleet-performance")
async def get_fleet_performance(
    days: int = Query(default=7, ge=1, le=90, description="Days to analyze"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get fleet performance analytics.
    """
    try:
        start_time = datetime.utcnow() - timedelta(days=days)
        
        # Events per bus
        bus_query = select(
            RawEvent.bus_id,
            func.count(RawEvent.id).label('event_count'),
            func.avg(RawEvent.confidence).label('avg_confidence'),
            func.count(func.distinct(RawEvent.route_id)).label('routes_covered')
        ).where(
            RawEvent.timestamp >= start_time
        ).group_by(RawEvent.bus_id).order_by(func.count(RawEvent.id).desc())
        
        bus_result = await db.execute(bus_query)
        bus_performance = [
            {
                "bus_id": row[0],
                "event_count": row[1],
                "avg_confidence": float(row[2]) if row[2] else 0,
                "routes_covered": row[3]
            }
            for row in bus_result.all()
        ]
        
        # Summary
        total_events = sum(b['event_count'] for b in bus_performance)
        avg_events_per_bus = total_events / len(bus_performance) if bus_performance else 0
        
        return {
            "period_days": days,
            "total_events": total_events,
            "active_buses": len(bus_performance),
            "average_events_per_bus": avg_events_per_bus,
            "bus_performance": bus_performance
        }
    except Exception as e:
        logger.error(f"Error fetching fleet performance: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch fleet performance analytics"
        )
