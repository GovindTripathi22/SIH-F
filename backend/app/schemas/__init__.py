"""
Pydantic schemas package.
"""

from app.schemas.common import (
    PaginationParams,
    PaginatedResponse,
    ErrorResponse,
    SuccessResponse,
    HealthResponse
)
from app.schemas.event import (
    EventType,
    EventCreate,
    EventResponse,
    EventListResponse,
    EventFilter
)
from app.schemas.issue import (
    SeverityClass,
    PriorityLevel,
    IssueStatus,
    IssueResponse,
    IssueDetailResponse,
    IssueListResponse,
    IssueFilter,
    IssueStatusUpdate,
    NearbyIssuesRequest
)
from app.schemas.bus import (
    BusStatus,
    CameraStatus,
    BusResponse,
    BusListResponse,
    RouteResponse,
    RouteListResponse,
    FleetSummary
)

__all__ = [
    # Common
    'PaginationParams',
    'PaginatedResponse',
    'ErrorResponse',
    'SuccessResponse',
    'HealthResponse',
    
    # Events
    'EventType',
    'EventCreate',
    'EventResponse',
    'EventListResponse',
    'EventFilter',
    
    # Issues
    'SeverityClass',
    'PriorityLevel',
    'IssueStatus',
    'IssueResponse',
    'IssueDetailResponse',
    'IssueListResponse',
    'IssueFilter',
    'IssueStatusUpdate',
    'NearbyIssuesRequest',
    
    # Buses
    'BusStatus',
    'CameraStatus',
    'BusResponse',
    'BusListResponse',
    'RouteResponse',
    'RouteListResponse',
    'FleetSummary'
]
