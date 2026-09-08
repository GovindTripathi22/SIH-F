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
