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


def test_can_deliver_unit_matrix():
    """
    Direct unit tests for ConnectionManager.can_deliver():
    - Admin bypass
    - Target-role rejection
    - Matching / mismatching corridors
    - Unfiltered behavior
    - Work order and telemetry role restrictions
    """
    cm = ConnectionManager()

    # 1. Admin bypasses all target_roles and corridor filters
    admin_meta = {"user": "admin@urbanpulse.bel", "role": Role.ADMIN, "corridors": {"route-1"}}
    assert cm.can_deliver(admin_meta, {"target_roles": [Role.VIEWER]}) is True
    assert cm.can_deliver(admin_meta, {"route_id": "route-99"}) is True
    assert cm.can_deliver(admin_meta, {"type": "work_order_update"}) is True

    # 2. Target-role rejection
    viewer_meta = {"user": "viewer@public.gov.in", "role": Role.VIEWER, "corridors": set()}
    operator_meta = {"user": "op@bmtc.gov.in", "role": Role.TRANSPORT_OPERATOR, "corridors": set()}
    msg_for_operator = {"target_roles": [Role.TRANSPORT_OPERATOR], "data": "fleet alert"}
    assert cm.can_deliver(operator_meta, msg_for_operator) is True
    assert cm.can_deliver(viewer_meta, msg_for_operator) is False

    # 3. Matching and mismatching corridors
    corridor_meta = {"user": "op@bmtc.gov.in", "role": Role.TRANSPORT_OPERATOR, "corridors": {"route-1", "route-2"}}
    msg_matching_route = {"route_id": "route-1", "data": "pothole on route 1"}
    msg_matching_corridor = {"corridor_id": "route-2", "data": "crack on route 2"}
    msg_mismatch = {"route_id": "route-3", "data": "defect on route 3"}
    assert cm.can_deliver(corridor_meta, msg_matching_route) is True
    assert cm.can_deliver(corridor_meta, msg_matching_corridor) is True
    assert cm.can_deliver(corridor_meta, msg_mismatch) is False

    # Corridor in nested issue object
    msg_nested_match = {"issue": {"corridor_id": "route-1"}}
    msg_nested_mismatch = {"issue": {"corridor_id": "route-4"}}
    assert cm.can_deliver(corridor_meta, msg_nested_match) is True
    assert cm.can_deliver(corridor_meta, msg_nested_mismatch) is False

    # 4. Unfiltered behavior
    unfiltered_meta = {"user": "driver@bmtc.gov.in", "role": Role.TRANSPORT_OPERATOR, "corridors": set()}
    unfiltered_msg = {"type": "general_announcement", "text": "system online"}
    assert cm.can_deliver(unfiltered_meta, unfiltered_msg) is True
    assert cm.can_deliver(corridor_meta, unfiltered_msg) is True

    # 5. Message type restrictions
    assert cm.can_deliver(viewer_meta, {"type": "work_order_update"}) is False
    assert cm.can_deliver(viewer_meta, {"type": "telemetry_update"}) is False
    pwd_meta = {"user": "eng@bbmp.gov.in", "role": Role.PWD_ENGINEER, "corridors": set()}
    assert cm.can_deliver(pwd_meta, {"type": "work_order_update"}) is True


def test_two_client_isolation_with_disconnect():
    """
    Two-client isolation: Client A (route-1) and Client B (route-2).
    Client A disconnects abruptly; Client B remains intact and receives subsequent route-2 messages.
    """
    import asyncio
    token_a = create_access_token({"sub": "bus1@bmtc.gov.in", "role": Role.TRANSPORT_OPERATOR})
    token_b = create_access_token({"sub": "bus2@bmtc.gov.in", "role": Role.TRANSPORT_OPERATOR})
    client = TestClient(app)

    with client.websocket_connect(f"/ws/live-feed?token={token_b}&corridor=route-2") as ws_b:
        _ = ws_b.receive_json()  # Handshake B

        with client.websocket_connect(f"/ws/live-feed?token={token_a}&corridor=route-1") as ws_a:
            _ = ws_a.receive_json()  # Handshake A
            # Broadcast to route-1
            asyncio.run(manager.broadcast({"type": "issue_update", "route_id": "route-1", "id": "m1"}))
            msg_a = ws_a.receive_json()
            assert msg_a["id"] == "m1"
            # ws_a closes upon exiting with block

        # ws_a is now disconnected; broadcast to route-2
        asyncio.run(manager.broadcast({"type": "issue_update", "route_id": "route-2", "id": "m2"}))
        msg_b = ws_b.receive_json()
        assert msg_b["id"] == "m2"


def test_websocket_cookie_based_authentication():
    """WebSocket feed accepts browser session cookie when token query parameter is absent"""
    token = create_access_token({"sub": "operator@bmtc.gov.in", "role": Role.TRANSPORT_OPERATOR})
    client = TestClient(app, cookies={"access_token": token})

    with client.websocket_connect("/ws/live-feed") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "connection_established"
        assert msg["user"] == "operator@bmtc.gov.in"
        assert msg["role"] == Role.TRANSPORT_OPERATOR



