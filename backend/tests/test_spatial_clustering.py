"""
Spatial Clustering and Multi-Pass Consensus Verification Tests.
"""

import pytest
import httpx
import uuid
from app.main import app

@pytest.mark.asyncio
async def test_multipass_two_bus_verification_escalation():
    """
    Core SIH Hero Verification:
    Bus A detects pothole at location L -> Issue is CANDIDATE (obs=1, buses=1)
    Bus B detects same pothole within 12m -> Issue escalates to VERIFIED (obs=2, buses=2, confidence increased)
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Isolated unique test coordinates per run to guarantee clean state
        rnd_offset = (uuid.uuid4().int % 5000) / 10000.0
        test_lat = 12.800000 + rnd_offset
        test_lon = 77.500000 + rnd_offset

        # Step 1: Bus A detection
        event_a_id = f"evt-test-busA-{uuid.uuid4().hex[:6]}"
        payload_a = {
            "event_id": event_a_id,
            "latitude": test_lat,
            "longitude": test_lon,
            "timestamp": "2026-09-08T12:30:00Z",
            "bus_id": "BUS-KA01-01",
            "route_id": "route-500D",
            "camera_id": "cam-01",
            "event_type": "pothole",
            "confidence": 0.85,
            "validation_score": 0.88,
            "gps_accuracy_meters": 2.1
        }
        from app.config import settings
        headers = {"X-Edge-Device-Key": settings.EDGE_DEVICE_API_KEY}
        res_a = await client.post("/api/v1/events", headers=headers, json=payload_a)
        assert res_a.status_code == 201

        # Query nearby to find created issue
        near_res = await client.get(f"/api/v1/issues/nearby?latitude={test_lat}&longitude={test_lon}&radius_meters=30")
        assert near_res.status_code == 200
        issues = near_res.json()
        assert len(issues) >= 1
        issue = issues[0]
        initial_obs = issue["observation_count"]
        initial_conf = issue["confidence"]
        assert issue["verification_state"] == "CANDIDATE"

        # Step 2: Bus B detects same defect 8 meters away
        event_b_id = f"evt-test-busB-{uuid.uuid4().hex[:6]}"
        payload_b = {
            "event_id": event_b_id,
            "latitude": test_lat + 0.00007, # ~7.8m offset
            "longitude": test_lon,
            "timestamp": "2026-09-08T12:35:00Z",
            "bus_id": "BUS-KA01-02", # Distinct bus!
            "route_id": "route-201C",
            "camera_id": "cam-02",
            "event_type": "pothole",
            "confidence": 0.90,
            "validation_score": 0.94,
            "gps_accuracy_meters": 2.5
        }
        res_b = await client.post("/api/v1/events", headers=headers, json=payload_b)
        assert res_b.status_code == 201

        # Step 3: Verify the issue clustered and upgraded
        res_check = await client.get(f"/api/v1/issues/{issue['issue_id']}")
        assert res_check.status_code == 200
        updated = res_check.json()

        assert updated["observation_count"] == initial_obs + 1
        assert updated["distinct_bus_count"] >= 2
        assert updated["confidence"] >= initial_conf # Combined Bayesian confidence
        assert updated["verification_score"] >= 0.70 # Multi-pass threshold
        assert updated["verification_state"] == "VERIFIED"
