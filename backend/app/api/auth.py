"""
Authentication and User Session API Routes.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Response, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import timedelta
import secrets

from app.core.security import (
    PRECONFIGURED_USERS,
    verify_password,
    create_access_token,
    get_current_user,
    Role,
    ADMIN_PWD,
    OPERATOR_PWD,
    TRAFFIC_PWD,
    PWD_ENG_PWD,
    FIELD_PWD,
    VIEWER_PWD
)
from app.config import settings

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str
    full_name: str
    expires_in_minutes: int
    csrf_token: Optional[str] = None


class UserProfileResponse(BaseModel):
    username: str
    role: str
    full_name: str


@router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, response: Response):
    """
    Authenticate user credentials, issue a signed JWT bearer token with RBAC role,
    and set httpOnly SameSite session cookie with double-submit CSRF token for web security.
    """
    user = PRECONFIGURED_USERS.get(credentials.username)
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={
            "sub": user["username"],
            "role": user["role"],
            "name": user["full_name"]
        },
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    csrf_token = secrets.token_hex(32)
    is_prod = settings.ENVIRONMENT.lower() in ("production", "prod")

    # Set httpOnly, Secure-in-production, SameSite cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )

    # Set client-readable CSRF token cookie for state-changing browser requests
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        samesite="lax",
        secure=is_prod,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user["role"],
        username=user["username"],
        full_name=user["full_name"],
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        csrf_token=csrf_token
    )


@router.post("/auth/logout")
async def logout(response: Response):
    """Clear authentication and CSRF session cookies"""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="csrf_token", path="/")
    return {"status": "success", "message": "Successfully logged out"}


@router.get("/auth/me", response_model=UserProfileResponse)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Return the profile and verified role of the current authenticated user"""
    return UserProfileResponse(
        username=current_user["username"],
        role=current_user["role"],
        full_name=current_user["full_name"]
    )


@router.get("/auth/demo-accounts")
async def get_demo_accounts():
    """
    Returns available preconfigured role accounts for evaluation demonstration.
    In production, default passwords are never returned.
    """
    is_prod = settings.ENVIRONMENT.lower() in ("production", "prod")
    accounts = [
        {
            "role": Role.ADMIN,
            "username": "admin@urbanpulse.bel",
            "description": "Full municipal administration & system override authority"
        },
        {
            "role": Role.TRANSPORT_OPERATOR,
            "username": "operator@bmtc.gov.in",
            "description": "Bus fleet telemetry, edge camera feeds, and event injection"
        },
        {
            "role": Role.TRAFFIC_AUTHORITY,
            "username": "traffic@bengaluru.police.gov.in",
            "description": "Traffic congestion & road hazard priority reviews"
        },
        {
            "role": Role.PWD_ENGINEER,
            "username": "engineer@bbmp.gov.in",
            "description": "BBMP public works work-order generation and contractor assignment"
        },
        {
            "role": Role.FIELD_ENGINEER,
            "username": "field@bbmp.gov.in",
            "description": "Ground crew status updates (IN_PROGRESS, REPAIRED)"
        },
        {
            "role": Role.VIEWER,
            "username": "viewer@public.gov.in",
            "description": "Read-only civic transparency and audit trail observer"
        }
    ]

    # In development/test mode only, inject default passwords
    if not is_prod:
        pwds = {
            Role.ADMIN: ADMIN_PWD,
            Role.TRANSPORT_OPERATOR: OPERATOR_PWD,
            Role.TRAFFIC_AUTHORITY: TRAFFIC_PWD,
            Role.PWD_ENGINEER: PWD_ENG_PWD,
            Role.FIELD_ENGINEER: FIELD_PWD,
            Role.VIEWER: VIEWER_PWD,
        }
        for acct in accounts:
            if pwds.get(acct["role"]):
                acct["default_password"] = pwds[acct["role"]]

    return accounts
