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

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Sliding-window in-memory rate limiter per client IP.
    Enforces RATE_LIMIT_REQUESTS requests per RATE_LIMIT_WINDOW seconds.
    """

    def __init__(self, app):
        super().__init__(app)
        self._request_history: Dict[str, List[float]] = defaultdict(list)
        self._whitelist_paths = {"/health", "/docs", "/redoc", "/openapi.json"}
        self._last_cleanup = time.time()

    def _cleanup_expired(self, now: float, window_start: float):
        """Purge idle and expired IP keys to prevent memory leak over time."""
        expired_ips = [
            ip for ip, timestamps in self._request_history.items()
            if not timestamps or timestamps[-1] <= window_start
        ]
        for ip in expired_ips:
            self._request_history.pop(ip, None)

    async def dispatch(self, request: Request, call_next):
        if not getattr(settings, "ENABLE_RATE_LIMITING", True) or request.url.path in self._whitelist_paths:
            return await call_next(request)

        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()
        window_start = now - settings.RATE_LIMIT_WINDOW

        # Periodic memory cleanup every 60 seconds or when map exceeds 500 clients
        if now - self._last_cleanup > 60 or len(self._request_history) > 500:
            self._cleanup_expired(now, window_start)
            self._last_cleanup = now

        # Filter out requests older than the sliding window
        history = self._request_history.get(client_ip, [])
        valid_history = [ts for ts in history if ts > window_start]

        if not valid_history:
            self._request_history.pop(client_ip, None)
        else:
            self._request_history[client_ip] = valid_history

        if len(valid_history) >= settings.RATE_LIMIT_REQUESTS:
            retry_after = int(settings.RATE_LIMIT_WINDOW - (now - valid_history[0])) + 1
            logger.warning(
                f"Rate limit exceeded for client {client_ip}: {len(valid_history)} requests in {settings.RATE_LIMIT_WINDOW}s"
            )
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too Many Requests",
                    "message": f"Rate limit exceeded: maximum {settings.RATE_LIMIT_REQUESTS} requests per {settings.RATE_LIMIT_WINDOW} seconds.",
                    "retry_after_seconds": retry_after
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(settings.RATE_LIMIT_REQUESTS),
                    "X-RateLimit-Remaining": "0"
                }
            )

        if client_ip not in self._request_history:
            self._request_history[client_ip] = []
        self._request_history[client_ip].append(now)
        response = await call_next(request)
        remaining = max(0, settings.RATE_LIMIT_REQUESTS - len(self._request_history[client_ip]))
        response.headers["X-RateLimit-Limit"] = str(settings.RATE_LIMIT_REQUESTS)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response

