"""
Issue service for business logic.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import uuid
import logging

from app.models.issue import VerifiedIssue, IssueStatusHistory
from app.services.priority_engine import PriorityEngine, PriorityConfig

logger = logging.getLogger(__name__)


class IssueService:
    """Service for issue-related business logic"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.priority_engine = PriorityEngine()
    
    async def update_status(
        self,
        issue_id: str,
        new_status: str,
        changed_by: str,
        change_reason: str = None,
        resolution_notes: str = None
    ) -> VerifiedIssue:
        """Update issue status with history tracking"""
        
        # Get issue
        query = select(VerifiedIssue).where(VerifiedIssue.issue_id == issue_id)
        result = await self.db.execute(query)
        issue = result.scalar_one_or_none()
        
        if not issue:
            raise ValueError(f"Issue {issue_id} not found")
        
        old_status = issue.status
        
        # Create status history entry
        history = IssueStatusHistory(
            issue_id=issue_id,
            old_status=old_status,
            new_status=new_status,
            changed_by=changed_by,
            change_reason=change_reason
        )
        self.db.add(history)
        
        # Update issue
        issue.status = new_status
        
        if new_status == 'RESOLVED':
            issue.resolved_at = datetime.utcnow()
            issue.resolved_by = changed_by
            if resolution_notes:
                issue.resolution_notes = resolution_notes
        
        await self.db.flush()
        await self.db.refresh(issue)
        
        return issue
    
    async def get_issue_by_id(self, issue_id: str) -> VerifiedIssue:
        """Get issue by ID"""
        query = select(VerifiedIssue).where(VerifiedIssue.issue_id == issue_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
