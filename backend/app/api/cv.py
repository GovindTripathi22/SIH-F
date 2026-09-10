"""
Computer Vision and Edge AI Inference API Routes.
"""

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import numpy as np
import cv2
import uuid
import asyncio
from datetime import datetime, timezone
import logging

from app.database import get_db
from app.services.cv_service import RoadDefectYOLOEngine
from app.schemas.event import EventCreate, EventType
from app.schemas.issue import IssueResponse
from app.services.event_service import EventService
from app.api.websocket import manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/cv/model-info")
async def get_model_info():
    """Return genuine YOLO model parameters, weights size, and supported defect classes"""
    engine = RoadDefectYOLOEngine.get_instance()
    return engine.get_model_metadata()


@router.post("/cv/detect")
async def detect_frame(
    file: UploadFile = File(...),
    confidence_threshold: float = Form(0.35),
    apply_privacy: bool = Form(True)
):
    """
    Run real YOLOv8 deep-learning inference on an uploaded frame.
    Offloaded to threadpool with asyncio.to_thread to prevent blocking the async event loop.
    Measures inference latency, FPS, camera health, and applies privacy blurring.
    """
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not decode uploaded image format"
        )

    engine = RoadDefectYOLOEngine.get_instance()
    result = await asyncio.to_thread(
        engine.detect_frame,
        frame_bgr=frame,
        apply_privacy=apply_privacy,
        conf_threshold=confidence_threshold
    )

    return result


@router.post("/cv/detect-and-ingest")
async def detect_and_ingest(
    file: UploadFile = File(...),
    bus_id: str = Form("bus-01"),
    route_id: str = Form("route-1"),
    camera_id: str = Form("cam-01-fwd"),
    latitude: float = Form(12.9345),
    longitude: float = Form(77.6105),
    confidence_threshold: float = Form(0.35),
    db: AsyncSession = Depends(get_db)
):
    """
    Complete Edge-to-PostGIS Pipeline with Real-Time Push:
    1. Reads frame
    2. Camera health check (Laplacian blur / lighting)
    3. Blurs faces & plates (Privacy-by-Design)
    4. Runs real YOLOv8 deep-learning defect detector in threadpool
    5. Geotags event with GPS & timestamp
    6. Stores RawEvent in database
    7. Runs multi-pass spatial verification and updates/creates VerifiedIssue
    8. Broadcasts verified issue update to all connected WebSocket clients in real time!
    """
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not decode image"
        )

    engine = RoadDefectYOLOEngine.get_instance()
    cv_result = await asyncio.to_thread(
        engine.detect_frame,
        frame_bgr=frame,
        apply_privacy=True,
        conf_threshold=confidence_threshold
    )

    detections = cv_result.get("detections", [])
    primary_event_type = EventType.POTHOLE
    highest_conf = 0.50

    if detections:
        top_det = max(detections, key=lambda d: d["confidence"])
        highest_conf = top_det["confidence"]
        class_str = top_det["class"]
        for et in EventType:
            if et.value == class_str:
                primary_event_type = et
                break

    # Construct event
    event_id = f"evt-{uuid.uuid4().hex[:8]}"
    event_create = EventCreate(
        event_id=event_id,
        latitude=latitude,
        longitude=longitude,
        timestamp=datetime.now(timezone.utc),
        bus_id=bus_id,
        route_id=route_id,
        camera_id=camera_id,
        event_type=primary_event_type,
        confidence=highest_conf,
        validation_score=cv_result.get("validation_score", 0.90),
        gps_accuracy_meters=2.8,
        frame_reference=f"frame_{event_id}.jpg"
    )

    event_service = EventService(db)
    raw_event, verified_issue, is_new = await event_service.create_event_with_issue(event_create)

    # Broadcast real-time issue update over WebSocket
    if verified_issue:
        try:
            issue_dict = IssueResponse.model_validate(verified_issue).model_dump(mode="json")
            await manager.broadcast({
                "type": "issue_update",
                "issue": issue_dict,
                "is_new": is_new,
                "event_id": raw_event.event_id,
                "bus_id": bus_id,
                "timestamp": raw_event.timestamp.isoformat() if raw_event.timestamp else None
            })
        except Exception as exc:
            logger.warning(f"Failed to broadcast WebSocket live feed update: {exc}")

    return {
        "status": "INGESTED_AND_VERIFIED",
        "event_id": raw_event.event_id,
        "event_type": raw_event.event_type,
        "confidence": raw_event.confidence,
        "verified_issue_id": verified_issue.issue_id if verified_issue else None,
        "detections": detections,
        "cv_performance": {
            "latency_ms": cv_result["inference_latency_ms"],
            "fps": cv_result["fps"],
            "camera_health": cv_result["camera_health"]["status"],
            "redactions": cv_result["privacy"]
        },
        "evidence_preview": cv_result["evidence_frame_base64"]
    }
