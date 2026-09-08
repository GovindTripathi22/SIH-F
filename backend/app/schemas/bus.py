"""
Pydantic schemas for buses and routes.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class BusStatus(str, Enum):
    """Bus operational status"""
    ACTIVE = "ACTIVE"
    IDLE = "IDLE"
    MAINTENANCE = "MAINTENANCE"
    OFFLINE = "OFFLINE"


class CameraStatus(str, Enum):
    """Camera operational status"""
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    ERROR = "ERROR"


class BusResponse(BaseModel):
    """Schema for bus response"""
    bus_id: str
    registration_number: str
    bus_type: Optional[str]
    capacity: Optional[int]
    camera_id: str
    camera_status: str
    current_route_id: Optional[str]
    current_status: str
    current_latitude: Optional[float]
    current_longitude: Optional[float]
    last_ping: Optional[datetime]
    last_speed_kmh: Optional[float]
    total_events_detected: int
    total_distance_km: float
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class BusListResponse(BaseModel):
    """Schema for bus list response"""
    buses: List[BusResponse]
    total: int


class RouteResponse(BaseModel):
    """Schema for route response"""
    route_id: str
    route_number: str
    route_name: str
    start_latitude: Optional[float]
    start_longitude: Optional[float]
    end_latitude: Optional[float]
    end_longitude: Optional[float]
    distance_km: Optional[float]
    estimated_duration_minutes: Optional[int]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class RouteListResponse(BaseModel):
    """Schema for route list response"""
    routes: List[RouteResponse]
    total: int


class FleetSummary(BaseModel):
    """Schema for fleet summary"""
    total_buses: int
    active_buses: int
    idle_buses: int
    maintenance_buses: int
    offline_buses: int
    total_events_today: int
    avg_events_per_bus: float
    total_routes: int
    active_routes: int
