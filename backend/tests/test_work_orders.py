"""
Work Order Generation & Maintenance Lifecycle Tests.
"""

import pytest
import httpx
from app.main import app

@pytest.mark.asyncio
async def test_work_order_pdf_generation():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Issue-001 is seeded initially
        res = await client.get("/api/v1/work-orders/issue-001/pdf")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert len(res.content) > 1000 # Valid binary PDF
        assert res.content.startswith(b"%PDF") # PDF magic bytes

@pytest.mark.asyncio
async def test_work_order_invalid_issue():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/work-orders/nonexistent-issue-999/pdf")
        assert res.status_code == 404

@pytest.mark.asyncio
async def test_closed_loop_lifecycle_transition():
    import uuid
    from app.config import settings
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create a fresh isolated candidate issue
        rnd_offset = (uuid.uuid4().int % 5000) / 10000.0
        test_lat = 12.870000 + rnd_offset
        test_lon = 77.620000 + rnd_offset
        evt_id = f"evt-lifecycle-{uuid.uuid4().hex[:6]}"

        res_evt = await client.post(
            "/api/v1/events",
            headers={"X-Edge-Device-Key": settings.EDGE_DEVICE_API_KEY},
            json={
                "event_id": evt_id,
                "latitude": test_lat,
                "longitude": test_lon,
                "timestamp": "2026-09-08T12:00:00Z",
                "bus_id": "BUS-KA01-99",
                "route_id": "route-test",
                "camera_id": "cam-1",
                "event_type": "pothole",
                "confidence": 0.85,
                "validation_score": 0.88
            }
        )
        assert res_evt.status_code == 201

        # Retrieve created candidate issue
        res_near = await client.get(f"/api/v1/issues/nearby?latitude={test_lat}&longitude={test_lon}&radius_meters=30")
        assert res_near.status_code == 200
        target_issue = res_near.json()[0]
        test_issue_id = target_issue["issue_id"]

        # Authenticate as BBMP PWD Engineer
        login_res = await client.post("/api/v1/auth/login", json={
            "username": "engineer@bbmp.gov.in",
            "password": "PWD@BBMP2026"
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        eng_auth = {"Authorization": f"Bearer {token}"}

        # Advance status: PENDING -> IN_PROGRESS -> REPAIRED -> RESOLUTION_VERIFIED
        res_disp = await client.post("/api/v1/work-orders/lifecycle", headers=eng_auth, json={
            "issue_id": test_issue_id,
            "target_status": "IN_PROGRESS",
            "actor": "BBMP Ward 150 Asphalt Unit",
            "notes": "Cold mix asphalt team dispatched"
        })
        assert res_disp.status_code == 200
        assert res_disp.json()["status"] == "IN_PROGRESS"

        res_rep = await client.post("/api/v1/work-orders/lifecycle", headers=eng_auth, json={
            "issue_id": test_issue_id,
            "target_status": "REPAIRED",
            "actor": "BBMP Site Supervisor",
            "notes": "Pothole filled and compacted"
        })
        assert res_rep.status_code == 200
        assert res_rep.json()["status"] == "REPAIRED"

        res_ver = await client.post("/api/v1/work-orders/lifecycle", headers=eng_auth, json={
            "issue_id": test_issue_id,
            "target_status": "RESOLUTION_VERIFIED",
            "actor": "Automated Bus Sensor (Bus-03 subsequent pass)",
            "notes": "Surface roughness index normalized, zero defect confirmed"
        })
        assert res_ver.status_code == 200
        assert res_ver.json()["status"] == "RESOLUTION_VERIFIED"

        # Check final issue verification_state
        res_get = await client.get(f"/api/v1/issues/{test_issue_id}")
        assert res_get.status_code == 200
        assert res_get.json()["verification_state"] == "RESOLUTION_VERIFIED"
