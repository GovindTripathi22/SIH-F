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


@pytest.mark.asyncio
async def test_opposite_carriageway_heading_separation():
    """
    Test DEF-03: Opposing carriageways on a divided road (e.g. Northbound vs Southbound)
    must NOT be falsely merged even if GPS coordinates are within 15 meters.
    """
    import json
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        rnd_offset = (uuid.uuid4().int % 5000) / 10000.0
        test_lat = 12.850000 + rnd_offset
        test_lon = 77.550000 + rnd_offset

        from app.config import settings
        headers = {"X-Edge-Device-Key": settings.EDGE_DEVICE_API_KEY}

        # Event 1: Northbound bus heading 15 degrees
        evt_north_id = f"evt-north-{uuid.uuid4().hex[:6]}"
        payload_north = {
            "event_id": evt_north_id,
            "latitude": test_lat,
            "longitude": test_lon,
            "timestamp": "2026-09-08T14:00:00Z",
            "bus_id": "BUS-NORTH-01",
            "route_id": "route-corr-N",
            "camera_id": "cam-N",
            "event_type": "pothole",
            "confidence": 0.86,
            "validation_score": 0.90,
            "gps_accuracy_meters": 2.0,
            "metadata_json": json.dumps({"heading": 15.0, "corridor": "Ring Road Northbound"})
        }
        res_north = await client.post("/api/v1/events", headers=headers, json=payload_north)
        assert res_north.status_code == 201

        # Query issue created for Northbound
        near_north = await client.get(f"/api/v1/issues/nearby?latitude={test_lat}&longitude={test_lon}&radius_meters=15")
        assert near_north.status_code == 200
        north_issues = near_north.json()
        assert len(north_issues) >= 1
        north_issue_id = north_issues[0]["issue_id"]

        # Event 2: Southbound bus heading 195 degrees (opposing carriageway, 180 deg delta), only 10m away
        evt_south_id = f"evt-south-{uuid.uuid4().hex[:6]}"
        payload_south = {
            "event_id": evt_south_id,
            "latitude": test_lat + 0.00009, # ~10m away
            "longitude": test_lon,
            "timestamp": "2026-09-08T14:05:00Z",
            "bus_id": "BUS-SOUTH-02",
            "route_id": "route-corr-S",
            "camera_id": "cam-S",
            "event_type": "pothole",
            "confidence": 0.88,
            "validation_score": 0.92,
            "gps_accuracy_meters": 2.0,
            "metadata_json": json.dumps({"heading": 195.0, "corridor": "Ring Road Southbound"})
        }
        res_south = await client.post("/api/v1/events", headers=headers, json=payload_south)
        assert res_south.status_code == 201

        # Check Northbound issue: its observation count should still be 1 (NOT merged!)
        res_check_north = await client.get(f"/api/v1/issues/{north_issue_id}")
        assert res_check_north.status_code == 200
        check_north = res_check_north.json()
        assert check_north["observation_count"] == 1, "Opposite carriageway observation must not merge into Northbound issue!"


@pytest.mark.asyncio
async def test_gps_corridor_snapping_pipeline():
    """
    Test DEF-09: Real-time route corridor snapping during event ingestion.
    When a bus on route-1 reports a noisy coordinate within 25m of the route line,
    the event is snapped to the route corridor and records the cross-track distance.
    """
    import uuid
    import json
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        from app.config import settings
        headers = {"X-Edge-Device-Key": settings.EDGE_DEVICE_API_KEY}

        # Route-1 line: (12.9352, 77.6245) -> (12.9719, 77.6412)
        # Midpoint approx (12.95355, 77.63285)
        # We inject a noisy coordinate shifted by ~15m
        noisy_lat = 12.95355 + 0.00010
        noisy_lon = 77.63285 - 0.00008
        evt_id = f"evt-snap-{uuid.uuid4().hex[:6]}"

        payload = {
            "event_id": evt_id,
            "latitude": noisy_lat,
            "longitude": noisy_lon,
            "timestamp": "2026-09-08T16:00:00Z",
            "bus_id": "BUS-KA01-01",
            "route_id": "route-1",
            "camera_id": "cam-01",
            "event_type": "pothole",
            "confidence": 0.89,
            "validation_score": 0.91,
            "gps_accuracy_meters": 4.5
        }
        res = await client.post("/api/v1/events", headers=headers, json=payload)
        assert res.status_code == 201
        created = res.json()

        # Verify snapping occurred and metadata contains cross track metrics
        assert created["metadata_json"] is not None
        meta = json.loads(created["metadata_json"])
        assert meta.get("gps_snapped") is True
        assert "cross_track_distance_m" in meta
        assert meta["cross_track_distance_m"] > 0


