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


@pytest.mark.asyncio
async def test_cookie_based_authentication_and_session():
    """Verify login sets httpOnly access_token cookie, and /auth/me works via cookie auth without Bearer header"""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post("/api/v1/auth/login", json={
            "username": "engineer@bbmp.gov.in",
            "password": "PWD@BBMP2026"
        })
        assert login_res.status_code == 200
        assert "access_token" in login_res.cookies
        assert "csrf_token" in login_res.cookies

        # Profile request without Authorization header, relying entirely on ambient cookie
        cookie_profile_res = await client.get("/api/v1/auth/me")
        assert cookie_profile_res.status_code == 200
        assert cookie_profile_res.json()["username"] == "engineer@bbmp.gov.in"
        assert cookie_profile_res.json()["role"] == Role.PWD_ENGINEER


@pytest.mark.asyncio
async def test_csrf_protection_for_cookie_authenticated_requests():
    """Verify state-changing browser requests with cookie authentication require matching X-CSRF-Token"""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Login to obtain cookie session
        login_res = await client.post("/api/v1/auth/login", json={
            "username": "admin@urbanpulse.bel",
            "password": "Admin@BEL2026"
        })
        assert login_res.status_code == 200
        csrf_token = login_res.cookies.get("csrf_token")
        assert csrf_token is not None

        # 1. State-changing POST without CSRF header must be blocked with 403
        res_no_csrf = await client.post("/api/v1/work-orders/lifecycle", json={
            "issue_id": "amr-issue-001",
            "target_status": "IN_PROGRESS",
            "actor": "Municipal Engineer"
        })
        assert res_no_csrf.status_code == 403
        assert "CSRF" in res_no_csrf.json()["detail"]

        # 2. State-changing POST with invalid CSRF header must be blocked with 403
        res_bad_csrf = await client.post(
            "/api/v1/work-orders/lifecycle",
            headers={"X-CSRF-Token": "invalid_csrf_token_xyz"},
            json={
                "issue_id": "amr-issue-001",
                "target_status": "IN_PROGRESS",
                "actor": "Municipal Engineer"
            }
        )
        assert res_bad_csrf.status_code == 403

        # 3. State-changing POST with valid CSRF header matching cookie is accepted
        res_good_csrf = await client.post(
            "/api/v1/work-orders/lifecycle",
            headers={"X-CSRF-Token": csrf_token},
            json={
                "issue_id": "amr-issue-001",
                "target_status": "IN_PROGRESS",
                "actor": "Municipal Engineer"
            }
        )
        assert res_good_csrf.status_code == 200


@pytest.mark.asyncio
async def test_logout_session_clearing():
    """Verify /auth/logout clears access_token and csrf_token cookies"""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Login
        await client.post("/api/v1/auth/login", json={
            "username": "viewer@public.gov.in",
            "password": "Viewer@Public2026"
        })
        assert "access_token" in client.cookies

        # Logout
        logout_res = await client.post("/api/v1/auth/logout")
        assert logout_res.status_code == 200
        assert logout_res.json()["status"] == "success"

        # Cookie should be cleared/expired; subsequent request fails with 401
        post_logout_me = await client.get("/api/v1/auth/me")
        assert post_logout_me.status_code == 401


@pytest.mark.asyncio
async def test_demo_accounts_production_mode(monkeypatch):
    """Verify demo accounts do not return passwords in production mode"""
    from app.config import settings
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/auth/demo-accounts")
        assert res.status_code == 200
        accounts = res.json()
        for acct in accounts:
            assert "default_password" not in acct
            assert "role" in acct
            assert "username" in acct
