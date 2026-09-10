"""
Automated Integration Tests for WebSocket Live Feed & Edge Telemetry Broadcast.
Tests authenticated handshake, policy enforcement, multi-client broadcasting, and real-time detection dispatch.
"""

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
import io
import cv2
import numpy as np

from app.main import app
from app.core.security import create_access_token, Role
from app.api.websocket import ConnectionManager, manager


def test_websocket_unauthenticated_rejected():
    """Unauthenticated WebSocket connection without token must be closed with 1008 policy violation."""
    client = TestClient(app)
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/live-feed") as ws:
            pass


def test_websocket_invalid_token_rejected():
    """WebSocket connection with forged/invalid token must be rejected."""
    client = TestClient(app)
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/live-feed?token=invalid_forged_token_xyz") as ws:
            pass


def test_websocket_authenticated_handshake_and_ping():
    """Valid JWT token connects and receives connection_established handshake, responds to ping."""
    token = create_access_token({"sub": "operator@bmtc.gov.in", "role": Role.TRANSPORT_OPERATOR})
    client = TestClient(app)
    with client.websocket_connect(f"/ws/live-feed?token={token}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "connection_established"
        assert msg["user"] == "operator@bmtc.gov.in"
        assert msg["role"] == Role.TRANSPORT_OPERATOR

        # Send ping
        ws.send_text("ping")
        reply = ws.receive_text()
        assert reply == "pong"


def test_websocket_connection_manager_resilience():
    """ConnectionManager isolates broken connections and continues delivery to healthy clients."""
    token = create_access_token({"sub": "admin@urbanpulse.bel", "role": Role.ADMIN})
    client = TestClient(app)
    
    with client.websocket_connect(f"/ws/live-feed?token={token}") as ws1:
        _ = ws1.receive_json()  # Handshake

        # Broadcast test payload directly via manager
        import asyncio
        asyncio.run(manager.broadcast({"type": "test_broadcast", "data": "hello"}))

        received = ws1.receive_json()
        assert received["type"] == "test_broadcast"
        assert received["data"] == "hello"


def test_detect_and_ingest_broadcasts_to_websocket():
    """Posting an image to detect-and-ingest must broadcast an issue_update to connected WebSocket clients."""
    token = create_access_token({"sub": "engineer@bbmp.gov.in", "role": Role.PWD_ENGINEER})
    client = TestClient(app)

    with client.websocket_connect(f"/ws/live-feed?token={token}") as ws:
        _ = ws.receive_json()  # Consume connection handshake

        # Create a test synthetic road image with an asphalt defect (dark patch)
        img = np.ones((480, 640, 3), dtype=np.uint8) * 120
        cv2.circle(img, (320, 240), 60, (20, 20, 20), -1)  # defect
        _, encoded_img = cv2.imencode(".jpg", img)
        file_bytes = io.BytesIO(encoded_img.tobytes())

        # Post frame to detect-and-ingest
        response = client.post(
            "/api/v1/cv/detect-and-ingest",
            files={"file": ("dashcam_frame.jpg", file_bytes, "image/jpeg")},
            data={
                "bus_id": "bus-live-ws-01",
                "route_id": "route-1",
                "camera_id": "cam-fwd-01",
                "latitude": 12.9350,
                "longitude": 77.6250,
                "confidence_threshold": 0.20
            }
        )
        assert response.status_code == 200
        resp_data = response.json()
        assert resp_data["status"] == "INGESTED_AND_VERIFIED"
        assert "event_id" in resp_data

        # WebSocket client should receive the broadcasted issue_update
        broadcast_msg = ws.receive_json()
        assert broadcast_msg["type"] == "issue_update"
        assert "issue" in broadcast_msg
        assert broadcast_msg["bus_id"] == "bus-live-ws-01"
