"""
Authentication, RBAC, Password Hashing, and Token Management.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict
import bcrypt
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status, Request, Header
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
import secrets
import os
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

is_prod = settings.ENVIRONMENT.lower() in ("production", "prod")

# Standard seeded user accounts (in dev/test, fallback credentials; in prod, env vars required)
ADMIN_PWD = os.getenv("URBANPULSE_ADMIN_PASSWORD", "" if is_prod else "Admin@BEL2026")
OPERATOR_PWD = os.getenv("URBANPULSE_OPERATOR_PASSWORD", "" if is_prod else "Operator@BMTC2026")
TRAFFIC_PWD = os.getenv("URBANPULSE_TRAFFIC_PASSWORD", "" if is_prod else "Traffic@BTP2026")
PWD_ENG_PWD = os.getenv("URBANPULSE_PWD_PASSWORD", "" if is_prod else "PWD@BBMP2026")
FIELD_PWD = os.getenv("URBANPULSE_FIELD_PASSWORD", "" if is_prod else "Field@BBMP2026")
VIEWER_PWD = os.getenv("URBANPULSE_VIEWER_PASSWORD", "" if is_prod else "Viewer@Public2026")

def _hash_or_empty(pwd: str) -> str:
    if not pwd:
        return ""
    return bcrypt.hashpw(pwd.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

PRECONFIGURED_USERS: Dict[str, Dict[str, any]] = {
    "admin@urbanpulse.bel": {
        "username": "admin@urbanpulse.bel",
        "full_name": "Chief Municipal Architect",
        "role": Role.ADMIN,
        "password_hash": _hash_or_empty(ADMIN_PWD)
    },
    "operator@bmtc.gov.in": {
        "username": "operator@bmtc.gov.in",
        "full_name": "BMTC Fleet Controller",
        "role": Role.TRANSPORT_OPERATOR,
        "password_hash": _hash_or_empty(OPERATOR_PWD)
    },
    "traffic@bengaluru.police.gov.in": {
        "username": "traffic@bengaluru.police.gov.in",
        "full_name": "BTP Traffic Inspector",
        "role": Role.TRAFFIC_AUTHORITY,
        "password_hash": _hash_or_empty(TRAFFIC_PWD)
    },
    "engineer@bbmp.gov.in": {
        "username": "engineer@bbmp.gov.in",
        "full_name": "BBMP Road Maintenance Exec",
        "role": Role.PWD_ENGINEER,
        "password_hash": _hash_or_empty(PWD_ENG_PWD)
    },
    "field@bbmp.gov.in": {
        "username": "field@bbmp.gov.in",
        "full_name": "BBMP Ward 150 Field Crew",
        "role": Role.FIELD_ENGINEER,
        "password_hash": _hash_or_empty(FIELD_PWD)
    },
    "viewer@public.gov.in": {
        "username": "viewer@public.gov.in",
        "full_name": "Civic Oversight Observer",
        "role": Role.VIEWER,
        "password_hash": _hash_or_empty(VIEWER_PWD)
    }
}



def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash"""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


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
    request: Request = None,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer)
) -> dict:
    """
    FastAPI dependency to extract current user from Authorization header (Bearer token)
    or from secure httpOnly session cookie with CSRF protection for state-changing browser requests.
    """
    token = None
    is_cookie_auth = False

    if credentials and credentials.credentials:
        token = credentials.credentials
    elif request and "access_token" in request.cookies:
        token = request.cookies.get("access_token")
        is_cookie_auth = True

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # CSRF protection: state-changing requests using cookie authentication must supply matching X-CSRF-Token
    if is_cookie_auth and request and request.method in ("POST", "PUT", "PATCH", "DELETE"):
        csrf_header = request.headers.get("x-csrf-token")
        csrf_cookie = request.cookies.get("csrf_token")
        if not csrf_header or not csrf_cookie or not secrets.compare_digest(csrf_header, csrf_cookie):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token validation failed. State-changing requests must supply valid X-CSRF-Token header matching cookie.",
            )

    payload = decode_access_token(token)
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


async def get_event_ingestion_auth(
    request: Request = None,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    x_edge_device_key: Optional[str] = Header(None, alias="X-Edge-Device-Key")
) -> dict:
    """
    Authenticate event ingestion from mobile bus sensors, edge devices, or web client.
    Accepts:
    1. Valid signed Bearer JWT with TRANSPORT_OPERATOR or ADMIN role.
    2. Valid X-Edge-Device-Key matching settings.EDGE_DEVICE_API_KEY.
    3. Valid session cookie with CSRF token for web testing/dashboard.
    Explicitly rejects VIEWER (403) or missing/invalid credentials (401).
    """
    # 1. Bearer Token Authentication (Mobile app or API client)
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

    # 2. X-Edge-Device-Key Authentication (Physical bus hardware / dashcam)
    if x_edge_device_key is not None:
        expected_key = getattr(settings, "EDGE_DEVICE_API_KEY", "")
        if expected_key and secrets.compare_digest(x_edge_device_key, expected_key):
            return {"auth_type": "edge_key", "user": "edge-bus-hardware", "role": Role.TRANSPORT_OPERATOR}
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid X-Edge-Device-Key provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Cookie Session Authentication (Web dashboard / browser inspection)
    if request and "access_token" in request.cookies:
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            csrf_header = request.headers.get("x-csrf-token")
            csrf_cookie = request.cookies.get("csrf_token")
            if not csrf_header or not csrf_cookie or not secrets.compare_digest(csrf_header, csrf_cookie):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="CSRF token validation failed for event ingestion",
                )

        payload = decode_access_token(request.cookies.get("access_token"))
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
        return {"auth_type": "cookie", "user": username, "role": role}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required: Provide Authorization Bearer token or valid X-Edge-Device-Key",
        headers={"WWW-Authenticate": "Bearer"},
    )
