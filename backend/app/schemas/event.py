"""
Pydantic schemas for events.
"""

from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum


class EventType(str, Enum):
    """Event types"""
    POTHOLE = "pothole"
    ROAD_CRACK = "road_crack"
    WATERLOGGING = "waterlogging"
    DEBRIS = "debris"
    SIGN_DAMAGE = "sign_damage"
    TRAFFIC_CONGESTION = "traffic_congestion"
    VEHICLE_COUNT = "vehicle_count"
    ZEBRA_CROSSING_DEFICIENCY = "zebra_crossing_deficiency"


class EventCreate(BaseModel):
    """Schema for creating a new event"""
    event_id: str = Field(..., min_length=3, max_length=50, description="Unique event identifier")
    
    # Location
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude coordinate")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude coordinate")
    
    # Timestamp
    timestamp: datetime = Field(..., description="Detection timestamp")
    
    # Source information
    bus_id: str = Field(..., min_length=1, max_length=50, description="Bus identifier")
    route_id: str = Field(..., min_length=1, max_length=50, description="Route identifier")
    camera_id: str = Field(..., min_length=1, max_length=50, description="Camera identifier")
    
    # Detection details
    event_type: EventType = Field(..., description="Type of event detected")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence (0-1)")
    validation_score: float = Field(..., ge=0.0, le=1.0, description="Temporal validation score (0-1)")
    
    # GPS quality
    gps_accuracy_meters: Optional[float] = Field(None, ge=0.0, le=500.0, description="GPS accuracy in meters")
    
    # Additional metadata
    frame_reference: Optional[str] = Field(None, max_length=65536, description="Reference to video frame")
    metadata_json: Optional[str] = Field(None, max_length=10000, description="Optional metadata or heading JSON")
    
    @field_validator('event_id')
    @classmethod
    def validate_event_id(cls, v: str) -> str:
        if not v or len(v.strip()) < 3:
            raise ValueError('event_id must be at least 3 characters')
        return v.strip()

    @model_validator(mode='after')
    def validate_coordinates(self):
        if abs(self.latitude) < 0.0001 and abs(self.longitude) < 0.0001:
            raise ValueError("Suspicious Null Island coordinate (0, 0) is rejected")
        return self


class EventResponse(BaseModel):
    """Schema for event response"""
    id: int
    event_id: str
    latitude: float
    longitude: float
    timestamp: datetime
    bus_id: str
    route_id: str
    camera_id: str
    event_type: str
    confidence: float
    validation_score: float
    gps_accuracy_meters: Optional[float]
    processed: bool
    frame_reference: Optional[str]
    metadata_json: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class EventListResponse(BaseModel):
    """Schema for event list response"""
    events: List[EventResponse]
    total: int
    page: int
    page_size: int


class EventFilter(BaseModel):
    """Schema for filtering events"""
    event_type: Optional[EventType] = None
    bus_id: Optional[str] = None
    route_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    min_confidence: Optional[float] = Field(None, ge=0, le=1)
    processed: Optional[bool] = None
