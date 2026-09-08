"""
Authentication and Role-Based Access Control (RBAC) Tests.
"""

import pytest
import httpx
from app.main import app
from app.core.security import Role, PRECONFIGURED_USERS

@pytest.mark.asyncio
async def test_auth_demo_accounts():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/auth/demo-accounts")
        assert res.status_code == 200
        accounts = res.json()
        assert len(accounts) == 6
        roles = {a["role"] for a in accounts}
        assert Role.ADMIN in roles
        assert Role.PWD_ENGINEER in roles
        assert Role.FIELD_ENGINEER in roles

@pytest.mark.asyncio
async def test_successful_login():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/auth/login", json={
            "username": "admin@urbanpulse.bel",
            "password": "Admin@BEL2026"
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["role"] == Role.ADMIN
        assert data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_failed_login_invalid_password():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/auth/login", json={
            "username": "admin@urbanpulse.bel",
            "password": "WrongPassword999"
        })
        assert res.status_code == 401

@pytest.mark.asyncio
async def test_protected_profile_endpoint():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated attempt
        unauth_res = await client.get("/api/v1/auth/me")
        assert unauth_res.status_code == 401

        # 2. Login
        login_res = await client.post("/api/v1/auth/login", json={
            "username": "engineer@bbmp.gov.in",
            "password": "PWD@BBMP2026"
        })
        token = login_res.json()["access_token"]

        # 3. Authenticated request
        auth_res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert auth_res.status_code == 200
        assert auth_res.json()["role"] == Role.PWD_ENGINEER
