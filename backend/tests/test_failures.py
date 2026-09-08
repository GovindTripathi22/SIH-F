"""
UrbanPulse Phase 22 — Systematic Failure Mode Unit & Integration Tests.
Verifies system resilience against bad inputs, missing sensors, malformed GPS, duplicate events,
illegal maintenance transitions, and post-repair re-observation failure detection.
"""

import pytest
import httpx
import uuid
from app.main import app
from app.services.gps_service import GPSService
from app.config import settings

AUTH_HEADERS = {"X-Edge-Device-Key": settings.EDGE_DEVICE_API_KEY}


@pytest.mark.asyncio
async def test_missing_or_out_of_bounds_gps():
    """Verify out-of-range coordinates and Null Island (0,0) are rejected"""
    assert GPSService.is_valid_coordinate(95.0, 77.0) is False
    assert GPSService.is_valid_coordinate(12.0, 195.0) is False
    assert GPSService.is_valid_coordinate(12.93, 77.61) is True

    # Test Null Island detection (0, 0)
    is_valid, msg = GPSService.validate_reading(0.00001, 0.00001)
    assert is_valid is False
    assert "Null Island" in msg

    # Test rejection via API schema validator
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/events", headers=AUTH_HEADERS, json={
            "event_id": f"evt-null-island-{uuid.uuid4().hex[:6]}",
            "latitude": 0.00001,
            "longitude": 0.00001,
            "timestamp": "2026-09-08T12:00:00Z",
            "bus_id": "bus-01",
            "route_id": "route-1",
            "camera_id": "cam-1",
            "event_type": "pothole",
            "confidence": 0.9,
            "validation_score": 0.9
        })
        assert res.status_code == 422


@pytest.mark.asyncio
async def test_malformed_event_payload():
    """Verify backend returns 422 Unprocessable Entity on schema violations"""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/events", headers=AUTH_HEADERS, json={
            "event_id": "bad",
            # Missing latitude, longitude, bus_id, etc.
        })
        assert res.status_code == 422


@pytest.mark.asyncio
async def test_invalid_event_type():
    """Verify invalid event types fail schema validation"""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/events", headers=AUTH_HEADERS, json={
            "event_id": "evt-invalid-type",
            "latitude": 12.93,
            "longitude": 77.61,
            "timestamp": "2026-09-08T12:00:00Z",
            "bus_id": "bus-01",
            "route_id": "route-1",
            "camera_id": "cam-1",
            "event_type": "alien_spacecraft_landing",
            "confidence": 0.9,
            "validation_score": 0.9
        })
        assert res.status_code == 422


@pytest.mark.asyncio
async def test_duplicate_event_handling():
    """Verify duplicate event ID does not crash the database and handles gracefully"""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        unique_id = f"evt-dup-fail-{uuid.uuid4().hex[:8]}"
        payload = {
            "event_id": unique_id,
            "latitude": 12.934,
            "longitude": 77.610,
            "timestamp": "2026-09-08T12:00:00Z",
            "bus_id": "bus-01",
            "route_id": "route-1",
            "camera_id": "cam-1",
            "event_type": "pothole",
            "confidence": 0.8,
            "validation_score": 0.85
        }
        res1 = await client.post("/api/v1/events", headers=AUTH_HEADERS, json=payload)
        assert res1.status_code == 201

        # Second attempt with identical unique ID
        res2 = await client.post("/api/v1/events", headers=AUTH_HEADERS, json=payload)
        assert res2.status_code in [400, 500]


@pytest.mark.asyncio
async def test_unauthorized_issue_status_update():
    """Verify that updating a nonexistent issue returns 404"""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post("/api/v1/auth/login", json={
            "username": "engineer@bbmp.gov.in",
            "password": "PWD@BBMP2026"
        })
        token = login_res.json()["access_token"]
        res = await client.patch(
            "/api/v1/issues/nonexistent-9999/status",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "RESOLVED", "changed_by": "TestUser"}
        )
        assert res.status_code in [400, 404]


@pytest.mark.asyncio
async def test_illegal_lifecycle_transition():
    """Verify that illegal lifecycle jumps (e.g. PENDING directly to RESOLUTION_VERIFIED) are rejected"""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post("/api/v1/auth/login", json={
            "username": "engineer@bbmp.gov.in",
            "password": "PWD@BBMP2026"
        })
        token = login_res.json()["access_token"]
        eng_auth = {"Authorization": f"Bearer {token}"}

        # Issue-001 is PENDING; attempting to jump directly to RESOLUTION_VERIFIED without IN_PROGRESS/REPAIRED
        res_illegal = await client.post("/api/v1/work-orders/lifecycle", headers=eng_auth, json={
            "issue_id": "issue-001",
            "target_status": "RESOLUTION_VERIFIED",
            "actor": "Corrupt Contractor",
            "notes": "Attempted illegal closure"
        })
        assert res_illegal.status_code in [400, 500]


@pytest.mark.asyncio
async def test_repair_failure_reobservation_detection():
    """
    Phase 15 Closed-Loop Defect:
    If an issue was previously marked REPAIRED and subsequent bus observations detect it again,
    the system must reopen the issue as REPAIR_FAILED / REOPENED instead of creating a duplicate.
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create and repair a defect at isolated coordinate
        test_lat = 12.915000
        test_lon = 77.650000
        evt1_id = f"evt-repairtest-1-{uuid.uuid4().hex[:6]}"

        res1 = await client.post("/api/v1/events", headers=AUTH_HEADERS, json={
            "event_id": evt1_id,
            "latitude": test_lat,
            "longitude": test_lon,
            "timestamp": "2026-09-08T12:00:00Z",
            "bus_id": "BUS-REP-01",
            "route_id": "route-test",
            "camera_id": "cam-1",
            "event_type": "pothole",
            "confidence": 0.88,
            "validation_score": 0.90
        })
        assert res1.status_code == 201

        # Retrieve created issue
        res_near = await client.get(f"/api/v1/issues/nearby?latitude={test_lat}&longitude={test_lon}&radius_meters=20")
        target_issue = res_near.json()[0]
        issue_id = target_issue["issue_id"]

        # Authenticate as engineer
        login_res = await client.post("/api/v1/auth/login", json={
            "username": "engineer@bbmp.gov.in",
            "password": "PWD@BBMP2026"
        })
        eng_auth = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

        # Transition: PENDING -> IN_PROGRESS -> REPAIRED
        await client.post("/api/v1/work-orders/lifecycle", headers=eng_auth, json={
            "issue_id": issue_id,
            "target_status": "IN_PROGRESS",
            "actor": "Contractor A"
        })
        res_rep = await client.post("/api/v1/work-orders/lifecycle", headers=eng_auth, json={
            "issue_id": issue_id,
            "target_status": "REPAIRED",
            "actor": "Contractor A"
        })
        assert res_rep.json()["status"] == "REPAIRED"

        # 2. Subsequent Bus Pass detects the defect again at the exact same location (REPAIR FAILED!)
        evt2_id = f"evt-repairtest-2-{uuid.uuid4().hex[:6]}"
        res2 = await client.post("/api/v1/events", headers=AUTH_HEADERS, json={
            "event_id": evt2_id,
            "latitude": test_lat,
            "longitude": test_lon,
            "timestamp": "2026-09-08T12:30:00Z",
            "bus_id": "BUS-REP-02",
            "route_id": "route-test",
            "camera_id": "cam-2",
            "event_type": "pothole",
            "confidence": 0.92,
            "validation_score": 0.94
        })
        assert res2.status_code == 201

        # 3. Check issue state: must be REOPENED with verification_state REPAIR_FAILED
        check_res = await client.get(f"/api/v1/issues/{issue_id}")
        reopened_issue = check_res.json()
        assert reopened_issue["status"] == "REOPENED"
        assert reopened_issue["verification_state"] == "REPAIR_FAILED"
        assert reopened_issue["priority"] == "CRITICAL"
        assert "REPAIR FAILED" in reopened_issue["priority_reasons"]
