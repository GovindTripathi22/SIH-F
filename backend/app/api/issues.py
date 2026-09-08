"""
Issues API routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from typing import Optional
from datetime import datetime
import logging

from app.database import get_db
from app.models.issue import VerifiedIssue, IssueStatusHistory
from app.models.event import EventObservation
from app.schemas.issue import (
    IssueResponse, 
    IssueDetailResponse, 
    IssueListResponse,
    IssueStatusUpdate,
    NearbyIssuesRequest
)
from app.schemas.common import PaginatedResponse
from app.services.issue_service import IssueService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/issues", response_model=PaginatedResponse[IssueResponse])
async def get_issues(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    start_time: Optional[datetime] = Query(None, description="Start time filter"),
    end_time: Optional[datetime] = Query(None, description="End time filter"),
    min_confidence: Optional[float] = Query(None, ge=0, le=1, description="Minimum confidence"),
    min_verification_score: Optional[float] = Query(None, ge=0, le=1, description="Minimum verification score"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get paginated list of verified issues with optional filters.
    """
    try:
        # Build query
        query = select(VerifiedIssue)
        
        # Apply filters
        if event_type:
            query = query.where(VerifiedIssue.event_type == event_type)
        if severity:
            query = query.where(VerifiedIssue.severity == severity)
        if priority:
            query = query.where(VerifiedIssue.priority == priority)
        if status_filter:
            query = query.where(VerifiedIssue.status == status_filter)
        if start_time:
            query = query.where(VerifiedIssue.first_observed >= start_time)
        if end_time:
            query = query.where(VerifiedIssue.first_observed <= end_time)
        if min_confidence is not None:
            query = query.where(VerifiedIssue.confidence >= min_confidence)
        if min_verification_score is not None:
            query = query.where(VerifiedIssue.verification_score >= min_verification_score)
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.order_by(desc(VerifiedIssue.priority_score)).offset(offset).limit(page_size)
        
        # Execute query
        result = await db.execute(query)
        issues = result.scalars().all()
        
        return PaginatedResponse.create(
            items=issues,
            total=total,
            page=page,
            page_size=page_size
        )
    except Exception as e:
        logger.error(f"Error fetching issues: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch issues"
        )


@router.get("/issues/{issue_id}", response_model=IssueDetailResponse)
async def get_issue(
    issue_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed information about a specific issue including observations and status history.
    """
    try:
        # Get issue
        query = select(VerifiedIssue).where(VerifiedIssue.issue_id == issue_id)
        result = await db.execute(query)
        issue = result.scalar_one_or_none()
        
        if not issue:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Issue {issue_id} not found"
            )
        
        # Get observations
        obs_query = select(EventObservation).where(EventObservation.issue_id == issue_id)
        obs_result = await db.execute(obs_query)
        observations = obs_result.scalars().all()
        
        # Get status history
        hist_query = select(IssueStatusHistory).where(
            IssueStatusHistory.issue_id == issue_id
        ).order_by(desc(IssueStatusHistory.changed_at))
        hist_result = await db.execute(hist_query)
        status_history = hist_result.scalars().all()
        
        # Build response
        response_data = {
            **issue.__dict__,
            "observations": [
                {
                    "id": obs.id,
                    "raw_event_id": obs.raw_event_id,
                    "observation_confidence": obs.observation_confidence,
                    "gps_adjusted": obs.gps_adjusted,
                    "created_at": obs.created_at
                }
                for obs in observations
            ],
            "status_history": [
                {
                    "id": hist.id,
                    "old_status": hist.old_status,
                    "new_status": hist.new_status,
                    "changed_by": hist.changed_by,
                    "change_reason": hist.change_reason,
                    "changed_at": hist.changed_at
                }
                for hist in status_history
            ]
        }
        
        return response_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching issue {issue_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch issue"
        )


@router.get("/issues/nearby", response_model=list[IssueResponse])
async def get_nearby_issues(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude"),
    radius_meters: float = Query(default=500, ge=0, le=10000, description="Radius in meters"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum results"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get issues near a specific location using PostGIS spatial queries.
    """
    try:
        # Build spatial query using PostGIS
        query = select(VerifiedIssue).where(
            func.ST_DWithin(
                VerifiedIssue.location,
                func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326).cast('geography'),
                radius_meters
            )
        )
        
        if event_type:
            query = query.where(VerifiedIssue.event_type == event_type)
        
        # Order by distance
        query = query.order_by(
            func.ST_Distance(
                VerifiedIssue.location,
                func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326).cast('geography')
            )
        ).limit(limit)
        
        result = await db.execute(query)
        issues = result.scalars().all()
        
        return issues
    except Exception as e:
        logger.error(f"Error fetching nearby issues: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch nearby issues"
        )


@router.patch("/issues/{issue_id}/status")
async def update_issue_status(
    issue_id: str,
    status_update: IssueStatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update the status of an issue.
    
    Creates a status history entry and updates the issue.
    """
    try:
        issue_service = IssueService(db)
        updated_issue = await issue_service.update_status(
            issue_id=issue_id,
            new_status=status_update.status.value,
            changed_by=status_update.changed_by,
            change_reason=status_update.change_reason,
            resolution_notes=status_update.resolution_notes
        )
        
        logger.info(f"Issue {issue_id} status updated to {status_update.status.value}")
        
        return {
            "success": True,
            "message": f"Issue status updated to {status_update.status.value}",
            "issue_id": issue_id,
            "new_status": status_update.status.value
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating issue status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update issue status"
        )


@router.get("/issues/stats/summary")
async def get_issue_stats(
    db: AsyncSession = Depends(get_db)
):
    """
    Get issue statistics summary.
    """
    try:
        # Total issues
        total_query = select(func.count(VerifiedIssue.issue_id))
        total_result = await db.execute(total_query)
        total = total_result.scalar()
        
        # Issues by status
        status_query = select(
            VerifiedIssue.status,
            func.count(VerifiedIssue.issue_id).label('count')
        ).group_by(VerifiedIssue.status)
        status_result = await db.execute(status_query)
        by_status = {row[0]: row[1] for row in status_result.all()}
        
        # Issues by priority
        priority_query = select(
            VerifiedIssue.priority,
            func.count(VerifiedIssue.issue_id).label('count')
        ).group_by(VerifiedIssue.priority)
        priority_result = await db.execute(priority_query)
        by_priority = {row[0]: row[1] for row in priority_result.all()}
        
        # Issues by severity
        severity_query = select(
            VerifiedIssue.severity,
            func.count(VerifiedIssue.issue_id).label('count')
        ).group_by(VerifiedIssue.severity)
        severity_result = await db.execute(severity_query)
        by_severity = {row[0]: row[1] for row in severity_result.all()}
        
        # Average verification score
        avg_score_query = select(func.avg(VerifiedIssue.verification_score))
        avg_score_result = await db.execute(avg_score_query)
        avg_verification_score = avg_score_result.scalar()
        
        return {
            "total_issues": total,
            "issues_by_status": by_status,
            "issues_by_priority": by_priority,
            "issues_by_severity": by_severity,
            "average_verification_score": float(avg_verification_score) if avg_verification_score else 0.0
        }
    except Exception as e:
        logger.error(f"Error fetching issue stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch issue statistics"
        )
