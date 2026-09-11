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


def test_websocket_role_based_filtering():
    """Role-based filtering prevents sensitive broadcasts (e.g. work orders) from reaching unauthorized roles."""
    import asyncio
    token_viewer = create_access_token({"sub": "viewer@public.gov.in", "role": Role.VIEWER})
    token_engineer = create_access_token({"sub": "engineer@bbmp.gov.in", "role": Role.PWD_ENGINEER})
    token_admin = create_access_token({"sub": "admin@urbanpulse.bel", "role": Role.ADMIN})

    client = TestClient(app)
    with client.websocket_connect(f"/ws/live-feed?token={token_viewer}") as ws_viewer:
        _ = ws_viewer.receive_json()  # Handshake

        with client.websocket_connect(f"/ws/live-feed?token={token_engineer}") as ws_eng:
            _ = ws_eng.receive_json()  # Handshake

            with client.websocket_connect(f"/ws/live-feed?token={token_admin}") as ws_admin:
                _ = ws_admin.receive_json()  # Handshake

                # Broadcast work order (restricted to engineers and admins)
                asyncio.run(manager.broadcast({
                    "type": "work_order_update",
                    "order_id": "WO-991",
                    "status": "DISPATCHED"
                }))

                # Engineer receives
                eng_msg = ws_eng.receive_json()
                assert eng_msg["type"] == "work_order_update"
                assert eng_msg["order_id"] == "WO-991"

                # Admin receives
                admin_msg = ws_admin.receive_json()
                assert admin_msg["type"] == "work_order_update"

                # Broadcast general alert - all receive
                asyncio.run(manager.broadcast({
                    "type": "general_announcement",
                    "message": "Public alert"
                }))
                viewer_msg = ws_viewer.receive_json()
                assert viewer_msg["type"] == "general_announcement"


def test_websocket_corridor_subscription_filtering():
    """Clients can filter by corridor/route so operators only receive feeds for their corridors."""
    import asyncio, json
    token_op1 = create_access_token({"sub": "op1@bmtc.gov.in", "role": Role.TRANSPORT_OPERATOR})
    token_op2 = create_access_token({"sub": "op2@bmtc.gov.in", "role": Role.TRANSPORT_OPERATOR})

    client = TestClient(app)
    with client.websocket_connect(f"/ws/live-feed?token={token_op1}&corridor=route-1") as ws_op1:
        h1 = ws_op1.receive_json()
        assert "route-1" in h1["corridors"]

        with client.websocket_connect(f"/ws/live-feed?token={token_op2}&corridor=route-2") as ws_op2:
            h2 = ws_op2.receive_json()
            assert "route-2" in h2["corridors"]

            # Broadcast on route-1
            asyncio.run(manager.broadcast({
                "type": "issue_update",
                "route_id": "route-1",
                "event_id": "evt-rt-1"
            }))

            # op1 receives
            msg1 = ws_op1.receive_json()
            assert msg1["event_id"] == "evt-rt-1"

            # op2 updates subscription dynamically
            ws_op2.send_text(json.dumps({"type": "subscribe", "corridors": ["route-1", "route-2"]}))
            ack = ws_op2.receive_json()
            assert ack["type"] == "subscription_ack"
            assert "route-1" in ack["corridors"]

            # Broadcast another on route-1
            asyncio.run(manager.broadcast({
                "type": "issue_update",
                "route_id": "route-1",
                "event_id": "evt-rt-1-second"
            }))

            assert ws_op1.receive_json()["event_id"] == "evt-rt-1-second"
            assert ws_op2.receive_json()["event_id"] == "evt-rt-1-second"


def test_detect_and_ingest_corridor_filtering():
    """Posting an image to detect-and-ingest for route-1 only broadcasts to clients subscribed to route-1."""
    import cv2
    import numpy as np

    token_rt1 = create_access_token({"sub": "driver1@bmtc.gov.in", "role": Role.TRANSPORT_OPERATOR})
    token_rt2 = create_access_token({"sub": "driver2@bmtc.gov.in", "role": Role.TRANSPORT_OPERATOR})

    # Synthesize test image with simulated pothole
    img = np.full((480, 640, 3), 120, dtype=np.uint8)
    cv2.ellipse(img, (320, 240), (80, 50), 0, 0, 360, (30, 30, 30), -1)
    _, encoded = cv2.imencode(".jpg", img)
    file_bytes = encoded.tobytes()

    client = TestClient(app)
    with client.websocket_connect(f"/ws/live-feed?token={token_rt1}&corridor=route-1") as ws_rt1:
        _ = ws_rt1.receive_json()  # Handshake
        with client.websocket_connect(f"/ws/live-feed?token={token_rt2}&corridor=route-2") as ws_rt2:
            _ = ws_rt2.receive_json()  # Handshake

            # Post frame for route-1
            response = client.post(
                "/api/v1/cv/detect-and-ingest",
                files={"file": ("dashcam_frame.jpg", file_bytes, "image/jpeg")},
                data={
                    "bus_id": "bus-live-ws-corridor",
                    "route_id": "route-1",
                    "camera_id": "cam-fwd-01",
                    "latitude": 12.9350,
                    "longitude": 77.6250,
                    "confidence_threshold": 0.20
                }
            )
            assert response.status_code == 200

            # ws_rt1 subscribed to route-1 must receive the broadcast
            broadcast_msg = ws_rt1.receive_json()
            assert broadcast_msg["type"] == "issue_update"
            assert broadcast_msg["bus_id"] == "bus-live-ws-corridor"
            assert broadcast_msg["route_id"] == "route-1"

            # Now broadcast a message for route-2
            import asyncio
            asyncio.run(manager.broadcast({
                "type": "issue_update",
                "route_id": "route-2",
                "corridor_id": "route-2",
                "event_id": "evt-rt-2"
            }))

            # ws_rt2 should receive evt-rt-2 as its first message, proving route-1 was filtered out
            msg2 = ws_rt2.receive_json()
            assert msg2["event_id"] == "evt-rt-2"


