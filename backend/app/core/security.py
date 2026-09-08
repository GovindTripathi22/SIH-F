"""
Authentication, RBAC, Password Hashing, and Token Management.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict
import bcrypt
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
import logging

from app.config import settings

logger = logging.getLogger(__name__)

# Security scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)
http_bearer = HTTPBearer(auto_error=False)

# Standard roles
class Role:
    ADMIN = "ADMIN"
    TRANSPORT_OPERATOR = "TRANSPORT_OPERATOR"
    TRAFFIC_AUTHORITY = "TRAFFIC_AUTHORITY"
    PWD_ENGINEER = "PWD_ENGINEER"
    FIELD_ENGINEER = "FIELD_ENGINEER"
    VIEWER = "VIEWER"

# Standard seeded user accounts
PRECONFIGURED_USERS: Dict[str, Dict[str, any]] = {
    "admin@urbanpulse.bel": {
        "username": "admin@urbanpulse.bel",
        "full_name": "Chief Municipal Architect",
        "role": Role.ADMIN,
        "password_hash": bcrypt.hashpw("Admin@BEL2026".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    },
    "operator@bmtc.gov.in": {
        "username": "operator@bmtc.gov.in",
        "full_name": "BMTC Fleet Controller",
        "role": Role.TRANSPORT_OPERATOR,
        "password_hash": bcrypt.hashpw("Operator@BMTC2026".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    },
    "traffic@bengaluru.police.gov.in": {
        "username": "traffic@bengaluru.police.gov.in",
        "full_name": "BTP Traffic Inspector",
        "role": Role.TRAFFIC_AUTHORITY,
        "password_hash": bcrypt.hashpw("Traffic@BTP2026".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    },
    "engineer@bbmp.gov.in": {
        "username": "engineer@bbmp.gov.in",
        "full_name": "BBMP Road Maintenance Exec",
        "role": Role.PWD_ENGINEER,
        "password_hash": bcrypt.hashpw("PWD@BBMP2026".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    },
    "field@bbmp.gov.in": {
        "username": "field@bbmp.gov.in",
        "full_name": "BBMP Ward 150 Field Crew",
        "role": Role.FIELD_ENGINEER,
        "password_hash": bcrypt.hashpw("Field@BBMP2026".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    },
    "viewer@public.gov.in": {
        "username": "viewer@public.gov.in",
        "full_name": "Civic Oversight Observer",
        "role": Role.VIEWER,
        "password_hash": bcrypt.hashpw("Viewer@Public2026".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    }
}


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_password_hash(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate signed JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": int(expire.timestamp())})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """Decode and validate signed JWT access token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer)
) -> dict:
    """FastAPI dependency to extract current user from Authorization header"""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    username: str = payload.get("sub")
    role: str = payload.get("role")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject identifier",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"username": username, "role": role, "full_name": payload.get("name", username)}


def require_roles(allowed_roles: List[str]):
    """Role-based authorization guard for route handlers"""
    async def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user_role}' is not authorized to access this resource. Allowed: {allowed_roles}"
            )
        return current_user
    return role_checker


from fastapi import Header

async def get_event_ingestion_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    x_edge_device_key: Optional[str] = Header(None, alias="X-Edge-Device-Key")
) -> dict:
    """
    Authenticate event ingestion from mobile bus sensors / edge devices.
    Accepts either:
    1. Valid signed Bearer JWT with TRANSPORT_OPERATOR or ADMIN role.
    2. Valid X-Edge-Device-Key matching settings.EDGE_DEVICE_API_KEY.
    Explicitly rejects VIEWER (403) or missing/invalid credentials (401).
    """
    if credentials and credentials.credentials:
        payload = decode_access_token(credentials.credentials)
        role = payload.get("role")
        username = payload.get("sub", "edge-operator")
        if role == Role.VIEWER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Role 'VIEWER' is not authorized to ingest events"
            )
        if role not in [Role.ADMIN, Role.TRANSPORT_OPERATOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' is not authorized to ingest events. Allowed: [ADMIN, TRANSPORT_OPERATOR]"
            )
        return {"auth_type": "bearer", "user": username, "role": role}

    if x_edge_device_key is not None:
        expected_key = getattr(settings, "EDGE_DEVICE_API_KEY", "urbanpulse-edge-bus-telemetry-key-2026")
        if x_edge_device_key == expected_key:
            return {"auth_type": "edge_key", "user": "edge-bus-hardware", "role": Role.TRANSPORT_OPERATOR}
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid X-Edge-Device-Key provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required: Provide Authorization Bearer token or valid X-Edge-Device-Key",
        headers={"WWW-Authenticate": "Bearer"},
    )
