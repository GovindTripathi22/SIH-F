"""
Authentication and User Session API Routes.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import timedelta

from app.core.security import (
    PRECONFIGURED_USERS,
    verify_password,
    create_access_token,
    get_current_user,
    Role
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


class UserProfileResponse(BaseModel):
    username: str
    role: str
    full_name: str


@router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: LoginRequest):
    """
    Authenticate user credentials and issue a signed JWT bearer token with RBAC role.
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

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user["role"],
        username=user["username"],
        full_name=user["full_name"],
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )


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
    """Returns available preconfigured role accounts for evaluation demonstration"""
    return [
        {
            "role": Role.ADMIN,
            "username": "admin@urbanpulse.bel",
            "default_password": "Admin@BEL2026",
            "description": "Full municipal administration & system override authority"
        },
        {
            "role": Role.TRANSPORT_OPERATOR,
            "username": "operator@bmtc.gov.in",
            "default_password": "Operator@BMTC2026",
            "description": "Bus fleet telemetry, edge camera feeds, and event injection"
        },
        {
            "role": Role.TRAFFIC_AUTHORITY,
            "username": "traffic@bengaluru.police.gov.in",
            "default_password": "Traffic@BTP2026",
            "description": "Traffic congestion & road hazard priority reviews"
        },
        {
            "role": Role.PWD_ENGINEER,
            "username": "engineer@bbmp.gov.in",
            "default_password": "PWD@BBMP2026",
            "description": "BBMP public works work-order generation and contractor assignment"
        },
        {
            "role": Role.FIELD_ENGINEER,
            "username": "field@bbmp.gov.in",
            "default_password": "Field@BBMP2026",
            "description": "Ground crew status updates (IN_PROGRESS, REPAIRED)"
        },
        {
            "role": Role.VIEWER,
            "username": "viewer@public.gov.in",
            "default_password": "Viewer@Public2026",
            "description": "Read-only civic transparency and audit trail observer"
        }
    ]
