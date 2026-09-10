"""
Sliding-Window Rate Limiting Middleware for UrbanPulse Backend.
Protects the API against denial-of-service, rapid telemetry flooding, and brute-force attacks.
"""

import time
from collections import defaultdict
from typing import Dict, List
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import logging

from app.config import settings

from jose import jwt, JWTError

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Sliding-window in-memory rate limiter per client identity or IP.
    Enforces RATE_LIMIT_EDGE_REQUESTS (300 req/min) for authenticated edge devices,
    and RATE_LIMIT_REQUESTS (100 req/min) for standard users/IPs.
    Prevents cellular carrier NAT collision by keying on edge device key or JWT user ID.
    """

    def __init__(self, app):
        super().__init__(app)
        self._request_history: Dict[str, List[float]] = defaultdict(list)
        self._whitelist_paths = {"/health", "/docs", "/redoc", "/openapi.json"}
        self._last_cleanup = time.time()

    def _cleanup_expired(self, now: float, window_start: float):
        """Purge idle and expired identity keys to prevent memory leak over time."""
        expired_keys = [
            k for k, timestamps in self._request_history.items()
            if not timestamps or timestamps[-1] <= window_start
        ]
        for k in expired_keys:
            self._request_history.pop(k, None)

    def _resolve_identity_and_limit(self, request: Request) -> tuple[str, int]:
        """
        Extract identity bucket key and max allowed requests per window.
        Priority:
        1. X-Edge-Device-Key header -> 'edge:<key>' with 300 req/min headroom
        2. Authorization: Bearer <jwt> -> 'user:<sub>' with 100 or 300 req/min depending on role
        3. Fallback: 'ip:<client_ip>' with default rate limit
        """
        edge_key = request.headers.get("x-edge-device-key")
        if edge_key:
            if settings.EDGE_DEVICE_API_KEY and edge_key == settings.EDGE_DEVICE_API_KEY:
                return f"edge:{edge_key}", settings.RATE_LIMIT_EDGE_REQUESTS
            return f"edge:{edge_key}", settings.RATE_LIMIT_REQUESTS

        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                sub = payload.get("sub")
                role = payload.get("role")
                if sub:
                    # Edge operators or mobile field engineers get higher edge throughput
                    if role in ("FIELD_ENGINEER", "TRANSPORT_OPERATOR"):
                        return f"user:{sub}", settings.RATE_LIMIT_EDGE_REQUESTS
                    return f"user:{sub}", settings.RATE_LIMIT_REQUESTS
            except JWTError:
                pass

        # If accessing the edge detection endpoint, grant edge headroom
        if request.url.path.startswith("/api/v1/cv/detect"):
            client_ip = request.client.host if request.client else "127.0.0.1"
            return f"ip:{client_ip}", settings.RATE_LIMIT_EDGE_REQUESTS

        client_ip = request.client.host if request.client else "127.0.0.1"
        return f"ip:{client_ip}", settings.RATE_LIMIT_REQUESTS

    async def dispatch(self, request: Request, call_next):
        if not getattr(settings, "ENABLE_RATE_LIMITING", True) or request.url.path in self._whitelist_paths:
            return await call_next(request)

        bucket_key, max_requests = self._resolve_identity_and_limit(request)
        now = time.time()
        window_start = now - settings.RATE_LIMIT_WINDOW

        # Periodic memory cleanup every 60 seconds or when map exceeds 500 clients
        if now - self._last_cleanup > 60 or len(self._request_history) > 500:
            self._cleanup_expired(now, window_start)
            self._last_cleanup = now

        # Filter out requests older than the sliding window
        history = self._request_history.get(bucket_key, [])
        valid_history = [ts for ts in history if ts > window_start]

        if not valid_history:
            self._request_history.pop(bucket_key, None)
        else:
            self._request_history[bucket_key] = valid_history

        if len(valid_history) >= max_requests:
            retry_after = int(settings.RATE_LIMIT_WINDOW - (now - valid_history[0])) + 1
            logger.warning(
                f"Rate limit exceeded for client {bucket_key}: {len(valid_history)} requests in {settings.RATE_LIMIT_WINDOW}s (limit: {max_requests})"
            )
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too Many Requests",
                    "message": f"Rate limit exceeded: maximum {max_requests} requests per {settings.RATE_LIMIT_WINDOW} seconds.",
                    "retry_after_seconds": retry_after
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": "0"
                }
            )

        if bucket_key not in self._request_history:
            self._request_history[bucket_key] = []
        self._request_history[bucket_key].append(now)
        response = await call_next(request)
        remaining = max(0, max_requests - len(self._request_history[bucket_key]))
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response


