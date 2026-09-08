"""
Middleware package.
"""

from app.middleware.audit import AuditMiddleware

__all__ = ['AuditMiddleware']
