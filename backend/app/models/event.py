"""
Database models for events.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.database import Base
from app.models.spatial import SpatialPoint


class RawEvent(Base):
    """Raw detection events from the CV engine"""
    __tablename__ = "raw_events"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), unique=True, index=True, nullable=False)
    
    # Location
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location = Column(SpatialPoint(), nullable=True)
    
    # Timestamps
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Source information
    bus_id = Column(String(50), nullable=False, index=True)
    route_id = Column(String(50), nullable=False, index=True)
    camera_id = Column(String(50), nullable=False)
    
    # Detection details
    event_type = Column(String(100), nullable=False, index=True)
    confidence = Column(Float, nullable=False)
    validation_score = Column(Float, nullable=False)
    
    # GPS quality
    gps_accuracy_meters = Column(Float)
    
    # Processing status
    processed = Column(Boolean, default=False, index=True)
    
    # Additional metadata
    frame_reference = Column(Text)
    metadata_json = Column(Text)  # JSON string for flexible metadata


class EventObservation(Base):
    """Links raw events to verified issues"""
    __tablename__ = "event_observations"
    
    id = Column(Integer, primary_key=True, index=True)
    raw_event_id = Column(Integer, index=True, nullable=False)
    issue_id = Column(String(50), index=True, nullable=False)
    
    # Observation details
    observation_confidence = Column(Float, nullable=False)
    gps_adjusted = Column(Boolean, default=False)
    adjusted_latitude = Column(Float)
    adjusted_longitude = Column(Float)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
