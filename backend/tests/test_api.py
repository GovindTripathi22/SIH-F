"""
API and Basic Endpoint Verification Tests.
"""

import pytest
import httpx
from app.main import app

@pytest.mark.asyncio
async def test_health_check():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert data["subsystems"]["backend"] == "ONLINE"
        assert data["subsystems"]["database"] == "ONLINE"
        assert data["subsystems"]["cv_engine"] == "READY"

@pytest.mark.asyncio
async def test_get_issues():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/issues?page=1&page_size=10")
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert len(data["items"]) >= 1

@pytest.mark.asyncio
async def test_get_buses():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/buses")
        assert res.status_code == 200
        data = res.json()
        buses = data.get("buses", data if isinstance(data, list) else [])
        assert len(buses) >= 1
        assert "bus_id" in buses[0]

@pytest.mark.asyncio
async def test_cv_model_info():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/cv/model-info")
        assert res.status_code == 200
        info = res.json()
        assert "YOLOv8" in info["model_name"]
        assert info["weights_size_mb"] > 0
        assert "pothole" in info["supported_classes"]

@pytest.mark.asyncio
async def test_analytics_endpoints():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Overview endpoint
        res_ov = await client.get("/api/v1/analytics/overview")
        assert res_ov.status_code == 200
        ov_data = res_ov.json()
        assert "total_issues" in ov_data
        assert "multi_pass_events" in ov_data
        assert "type_data" in ov_data
        assert "status_data" in ov_data
        assert "hourly_data" in ov_data

        # Traffic analytics endpoint
        res_tr = await client.get("/api/v1/analytics/traffic?hours=24")
        assert res_tr.status_code == 200
        tr_data = res_tr.json()
        assert "total_events" in tr_data
        assert "hourly_breakdown" in tr_data

        # Road health analytics endpoint
        res_rh = await client.get("/api/v1/analytics/road-health?days=7")
        assert res_rh.status_code == 200
        rh_data = res_rh.json()
        assert "total_issues" in rh_data
        assert "issues_by_type" in rh_data

        # Fleet performance analytics endpoint
        res_fp = await client.get("/api/v1/analytics/fleet-performance?days=7")
        assert res_fp.status_code == 200
        fp_data = res_fp.json()
        assert "active_buses" in fp_data

