"""
Database models for buses and routes.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.database import Base
from app.models.spatial import SpatialPoint


class Bus(Base):
    """Bus fleet information"""
    __tablename__ = "buses"
    
    bus_id = Column(String(50), primary_key=True, index=True)
    
    # Bus details
    registration_number = Column(String(50), nullable=False)
    bus_type = Column(String(50), default='diesel')  # electric, diesel, hybrid
    capacity = Column(Integer, default=50)
    
    # Camera information
    camera_id = Column(String(50), nullable=False)
    camera_status = Column(String(20), default='ONLINE')
    
    # Current status
    current_route_id = Column(String(50), index=True)
    current_status = Column(String(20), default='ACTIVE')  # ACTIVE, IDLE, MAINTENANCE
    current_latitude = Column(Float)
    current_longitude = Column(Float)
    current_location = Column(SpatialPoint(), nullable=True)
    
    # Last update
    last_ping = Column(DateTime(timezone=True))
    last_speed_kmh = Column(Float, default=0.0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Statistics
    total_events_detected = Column(Integer, default=0)
    total_distance_km = Column(Float, default=0.0)


class Route(Base):
    """Bus route information"""
    __tablename__ = "routes"
    
    route_id = Column(String(50), primary_key=True, index=True)
    
    # Route details
    route_number = Column(String(50), nullable=False)
    route_name = Column(String(200), nullable=False)
    
    # Route geometry (simplified as start/end points for now)
    start_location = Column(SpatialPoint(), nullable=True)
    end_location = Column(SpatialPoint(), nullable=True)
    start_latitude = Column(Float)
    start_longitude = Column(Float)
    end_latitude = Column(Float)
    end_longitude = Column(Float)
    
    # Route metadata
    distance_km = Column(Float)
    estimated_duration_minutes = Column(Integer)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class BusTelemetry(Base):
    """Historical telemetry data for buses"""
    __tablename__ = "bus_telemetry"
    
    id = Column(Integer, primary_key=True, index=True)
    bus_id = Column(String(50), index=True, nullable=False)
    route_id = Column(String(50), index=True, nullable=False)
    
    # Location
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location = Column(SpatialPoint(), nullable=True)
    
    # Telemetry
    speed_kmh = Column(Float)
    heading = Column(Float)  # degrees
    
    # Timestamp
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
