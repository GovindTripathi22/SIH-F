"""
Database models for verified infrastructure issues.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base
from app.models.spatial import SpatialPoint


class VerifiedIssue(Base):
    """Verified infrastructure issues after multi-pass verification"""
    __tablename__ = "verified_issues"
    
    # Primary key
    issue_id = Column(String(50), primary_key=True, index=True)
    
    # Location
    location = Column(SpatialPoint(), nullable=True, index=True)
    centroid_latitude = Column(Float, nullable=False, index=True)
    centroid_longitude = Column(Float, nullable=False, index=True)
    
    # Event details
    event_type = Column(String(100), nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)
    priority = Column(String(20), nullable=False, index=True)
    status = Column(String(20), nullable=False, default='PENDING', index=True)
    verification_state = Column(String(30), nullable=False, default='CANDIDATE', index=True)
    
    # Evidence metrics
    observation_count = Column(Integer, nullable=False, default=1)
    distinct_bus_count = Column(Integer, nullable=False, default=1)
    confidence = Column(Float, nullable=False)
    verification_score = Column(Float, nullable=False)
    priority_score = Column(Float, nullable=False)
    
    # Temporal information
    first_observed = Column(DateTime(timezone=True), nullable=False)
    last_observed = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Spatial clustering
    cluster_radius_meters = Column(Float, default=15.0)
    
    # Priority explanation
    priority_reasons = Column(Text)  # JSON string of reasons
    
    # Resolution information
    resolved_at = Column(DateTime(timezone=True))
    resolved_by = Column(String(100))
    resolution_notes = Column(Text)
    
    # Additional metadata
    metadata_json = Column(Text)  # JSON string for flexible metadata


class IssueStatusHistory(Base):
    """Track status changes for issues"""
    __tablename__ = "issue_status_history"
    
    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(String(50), index=True, nullable=False)
    
    # Status change
    old_status = Column(String(20))
    new_status = Column(String(20), nullable=False)
    
    # Who made the change
    changed_by = Column(String(100), nullable=False)
    change_reason = Column(Text)
    
    # Timestamp
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
