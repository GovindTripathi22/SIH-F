"""
Audit middleware for logging API requests.
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import logging
import time
import json

logger = logging.getLogger(__name__)


class AuditMiddleware(BaseHTTPMiddleware):
    """Middleware for audit logging of API requests"""
    
    async def dispatch(self, request: Request, call_next):
        """Process the request and log audit information"""
        
        # Start timing
        start_time = time.time()
        
        # Get request information
        request_id = request.headers.get('X-Request-ID', str(time.time()))
        client_ip = request.client.host if request.client else 'unknown'
        user_agent = request.headers.get('User-Agent', 'unknown')
        
        # Log request
        logger.info(
            f"API Request: {request.method} {request.url.path} | "
            f"Client: {client_ip} | Request-ID: {request_id}"
        )
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log response
        logger.info(
            f"API Response: {request.method} {request.url.path} | "
            f"Status: {response.status_code} | Duration: {duration:.3f}s | "
            f"Request-ID: {request_id}"
        )
        
        # Add request ID to response headers
        response.headers['X-Request-ID'] = request_id
        response.headers['X-Response-Time'] = f"{duration:.3f}s"
        
        return response
