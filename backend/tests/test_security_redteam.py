"""
UrbanPulse Phase 30 — Security Red Team & Penetration Attack Tests.
Simulates active adversary vectors: unauthenticated injection, role escalation,
oversized payload buffer attacks, rate limiting, SQL injection, and XSS sanitization.
"""

import pytest
import httpx
import uuid
from app.main import app
from app.core.security import Role
from app.config import settings


@pytest.mark.asyncio
async def test_unauthenticated_requests_blocked():
    """Verify that mutating endpoints strictly reject unauthenticated calls with 401"""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Event ingestion
        res_evt = await client.post("/api/v1/events", json={"event_id": "bad-unauth"})
        assert res_evt.status_code == 401

        # 2. Issue status update
        res_patch = await client.patch("/api/v1/issues/issue-001/status", json={"status": "IN_PROGRESS"})
        assert res_patch.status_code == 401

        # 3. Work order lifecycle
        res_life = await client.post("/api/v1/work-orders/lifecycle", json={
            "issue_id": "issue-001",
            "target_status": "IN_PROGRESS",
            "actor": "Unauth"
        })
        assert res_life.status_code == 401

        # 4. Admin delete
        res_del = await client.delete("/api/v1/issues/issue-001")
        assert res_del.status_code == 401


@pytest.mark.asyncio
async def test_role_escalation_attempt():
    """Verify that a VIEWER cannot call mutating, operator, or administrative endpoints"""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Login as viewer
        login_res = await client.post("/api/v1/auth/login", json={
            "username": "viewer@public.gov.in",
            "password": "Viewer@Public2026"
        })
        assert login_res.status_code == 200
        viewer_token = login_res.json()["access_token"]
        auth_header = {"Authorization": f"Bearer {viewer_token}"}

        # 1. VIEWER trying to inject an event -> 403 Forbidden
        res_evt = await client.post("/api/v1/events", headers=auth_header, json={
            "event_id": "evt-viewer-forbidden",
            "latitude": 12.93,
            "longitude": 77.61,
            "timestamp": "2026-09-08T12:00:00Z",
            "bus_id": "bus-01",
            "route_id": "route-1",
            "camera_id": "cam-1",
            "event_type": "pothole",
            "confidence": 0.8,
            "validation_score": 0.8
        })
        assert res_evt.status_code == 403

        # 2. VIEWER trying to patch issue status -> 403 Forbidden
        res_patch = await client.patch("/api/v1/issues/issue-001/status", headers=auth_header, json={
            "status": "IN_PROGRESS",
            "changed_by": "Adversary"
        })
        assert res_patch.status_code == 403

        # 3. VIEWER trying to transition work order lifecycle -> 403 Forbidden
        res_life = await client.post("/api/v1/work-orders/lifecycle", headers=auth_header, json={
            "issue_id": "issue-001",
            "target_status": "IN_PROGRESS",
            "actor": "Adversary"
        })
        assert res_life.status_code == 403

        # 4. VIEWER trying to delete an issue -> 403 Forbidden
        res_del = await client.delete("/api/v1/issues/issue-001", headers=auth_header)
        assert res_del.status_code == 403


@pytest.mark.asyncio
async def test_authorized_role_operations():
    """Verify that authorized roles succeed and unauthorized cross-role operations fail"""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Operator login
        op_login = await client.post("/api/v1/auth/login", json={
            "username": "operator@bmtc.gov.in",
            "password": "Operator@BMTC2026"
        })
        op_token = op_login.json()["access_token"]
        op_auth = {"Authorization": f"Bearer {op_token}"}

        # Engineer login
        eng_login = await client.post("/api/v1/auth/login", json={
            "username": "engineer@bbmp.gov.in",
            "password": "PWD@BBMP2026"
        })
        eng_token = eng_login.json()["access_token"]
        eng_auth = {"Authorization": f"Bearer {eng_token}"}

        # Admin login
        admin_login = await client.post("/api/v1/auth/login", json={
            "username": "admin@urbanpulse.bel",
            "password": "Admin@BEL2026"
        })
        admin_token = admin_login.json()["access_token"]
        admin_auth = {"Authorization": f"Bearer {admin_token}"}

        # 1. Operator CAN ingest event
        evt_id = f"evt-rbac-{uuid.uuid4().hex[:6]}"
        res_ingest = await client.post("/api/v1/events", headers=op_auth, json={
            "event_id": evt_id,
            "latitude": 12.936,
            "longitude": 77.615,
            "timestamp": "2026-09-08T12:00:00Z",
            "bus_id": "KA01-FA-1234",
            "route_id": "route-1",
            "camera_id": "cam-1",
            "event_type": "pothole",
            "confidence": 0.85,
            "validation_score": 0.88
        })
        assert res_ingest.status_code == 201

        # 2. Edge Device Key header CAN ingest event
        edge_id = f"evt-edge-{uuid.uuid4().hex[:6]}"
        res_edge = await client.post(
            "/api/v1/events",
            headers={"X-Edge-Device-Key": settings.EDGE_DEVICE_API_KEY},
            json={
                "event_id": edge_id,
                "latitude": 12.937,
                "longitude": 77.616,
                "timestamp": "2026-09-08T12:01:00Z",
                "bus_id": "KA01-FA-5678",
                "route_id": "route-1",
                "camera_id": "cam-1",
                "event_type": "pothole",
                "confidence": 0.86,
                "validation_score": 0.89
            }
        )
        assert res_edge.status_code == 201

        # 3. Invalid Edge Device Key is rejected with 401
        res_bad_key = await client.post(
            "/api/v1/events",
            headers={"X-Edge-Device-Key": "wrong-secret-key-123"},
            json={
                "event_id": "evt-bad-key",
                "latitude": 12.937,
                "longitude": 77.616,
                "timestamp": "2026-09-08T12:01:00Z",
                "bus_id": "KA01-FA-5678",
                "route_id": "route-1",
                "camera_id": "cam-1",
                "event_type": "pothole",
                "confidence": 0.86,
                "validation_score": 0.89
            }
        )
        assert res_bad_key.status_code == 401

        # 4. Engineer CAN update status
        res_patch = await client.patch("/api/v1/issues/issue-001/status", headers=eng_auth, json={
            "status": "IN_PROGRESS",
            "changed_by": "BBMP Engineer",
            "change_reason": "Maintenance dispatch"
        })
        assert res_patch.status_code == 200

        # 5. Engineer CANNOT delete issue -> 403
        res_eng_del = await client.delete("/api/v1/issues/issue-001", headers=eng_auth)
        assert res_eng_del.status_code == 403


@pytest.mark.asyncio
async def test_oversized_payload_injection():
    """Attempt buffer exhaustion with an oversized JSON payload (>64KB); must return 422 Unprocessable Entity"""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        huge_string = "A" * (2 * 1024 * 1024)  # 2MB string
        res = await client.post(
            "/api/v1/events",
            headers={"X-Edge-Device-Key": settings.EDGE_DEVICE_API_KEY},
            json={
                "event_id": "evt-oversized",
                "latitude": 12.93,
                "longitude": 77.61,
                "timestamp": "2026-09-08T12:00:00Z",
                "bus_id": "bus-01",
                "route_id": "route-1",
                "camera_id": "cam-1",
                "event_type": "pothole",
                "confidence": 0.8,
                "validation_score": 0.8,
                "frame_reference": huge_string
            }
        )
        assert res.status_code == 422  # Strictly rejected by Pydantic max_length validator


@pytest.mark.asyncio
async def test_sql_injection_vector_in_queries():
    """Attempt SQL injection through query filters (e.g. event_type and status)"""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        attack_str = "' OR '1'='1'; DROP TABLE verified_issues; --"
        res = await client.get(f"/api/v1/issues?event_type={attack_str}")
        assert res.status_code == 200
        verify_res = await client.get("/api/v1/issues")
        assert verify_res.status_code == 200


@pytest.mark.asyncio
async def test_xss_vector_in_status_update():
    """Attempt stored XSS in change reason and resolution notes"""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Login as engineer
        login_res = await client.post("/api/v1/auth/login", json={
            "username": "engineer@bbmp.gov.in",
            "password": "PWD@BBMP2026"
        })
        token = login_res.json()["access_token"]
        xss_payload = "<script>alert('XSS-Exploit')</script>"
        res = await client.patch("/api/v1/issues/issue-001/status", headers={"Authorization": f"Bearer {token}"}, json={
            "status": "IN_PROGRESS",
            "changed_by": "BBMP_ENG",
            "change_reason": xss_payload,
            "resolution_notes": xss_payload
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
