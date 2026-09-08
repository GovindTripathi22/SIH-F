"""
Pydantic schemas for verified issues.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class SeverityClass(str, Enum):
    """Severity classification"""
    SAFETY_HAZARD = "SAFETY_HAZARD"
    SEVERE = "SEVERE"
    MODERATE = "MODERATE"
    MINOR = "MINOR"
    COSMETIC = "COSMETIC"


class PriorityLevel(str, Enum):
    """Priority level"""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    MONITOR = "MONITOR"


class IssueStatus(str, Enum):
    """Issue status"""
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    DUPLICATE = "DUPLICATE"


class IssueResponse(BaseModel):
    """Schema for issue response"""
    issue_id: str
    centroid_latitude: Optional[float]
    centroid_longitude: Optional[float]
    event_type: str
    severity: str
    priority: str
    status: str
    observation_count: int
    distinct_bus_count: int
    confidence: float
    verification_score: float
    priority_score: float
    first_observed: datetime
    last_observed: datetime
    created_at: datetime
    updated_at: Optional[datetime]
    cluster_radius_meters: Optional[float]
    priority_reasons: Optional[str]
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]
    resolution_notes: Optional[str]
    
    class Config:
        from_attributes = True


class IssueDetailResponse(IssueResponse):
    """Detailed issue response with observations"""
    observations: List[dict] = []
    status_history: List[dict] = []


class IssueListResponse(BaseModel):
    """Schema for issue list response"""
    issues: List[IssueResponse]
    total: int
    page: int
    page_size: int


class IssueFilter(BaseModel):
    """Schema for filtering issues"""
    event_type: Optional[str] = None
    severity: Optional[SeverityClass] = None
    priority: Optional[PriorityLevel] = None
    status: Optional[IssueStatus] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    min_confidence: Optional[float] = Field(None, ge=0, le=1)
    min_verification_score: Optional[float] = Field(None, ge=0, le=1)


class IssueStatusUpdate(BaseModel):
    """Schema for updating issue status"""
    status: IssueStatus
    changed_by: str = Field(..., description="User who made the change")
    change_reason: Optional[str] = Field(None, description="Reason for status change")
    resolution_notes: Optional[str] = Field(None, description="Resolution notes (when resolving)")


class NearbyIssuesRequest(BaseModel):
    """Schema for nearby issues request"""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_meters: float = Field(default=500, ge=0, le=10000)
    limit: int = Field(default=20, ge=1, le=100)
    event_type: Optional[str] = None
