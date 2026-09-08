"""
Work Orders and Maintenance Lifecycle API Routes.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.services.work_order_service import WorkOrderService
from app.core.security import require_roles, Role

router = APIRouter()


class LifecycleRequest(BaseModel):
    issue_id: str
    target_status: str
    actor: str
    notes: Optional[str] = "Municipal dispatch update"


@router.get("/work-orders/{issue_id}/pdf")
async def download_work_order_pdf(
    issue_id: str,
    department: str = "BBMP Road Infrastructure Division",
    db: AsyncSession = Depends(get_db)
):
    """
    Generate and stream an official municipal PDF Work Order with full audit trail.
    """
    try:
        service = WorkOrderService(db)
        pdf_bytes, filename = await service.generate_pdf_work_order(issue_id, department)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"PDF generation error: {str(e)}")


@router.post("/work-orders/lifecycle")
async def update_lifecycle(
    req: LifecycleRequest,
    current_user: dict = Depends(require_roles([Role.ADMIN, Role.PWD_ENGINEER, Role.FIELD_ENGINEER])),
    db: AsyncSession = Depends(get_db)
):
    """
    Update closed-loop maintenance lifecycle:
    PENDING -> IN_PROGRESS -> REPAIRED -> RESOLUTION_VERIFIED
    """
    try:
        service = WorkOrderService(db)
        updated = await service.advance_lifecycle(
            req.issue_id,
            req.target_status,
            req.actor,
            req.notes
        )
        return {
            "success": True,
            "issue_id": updated.issue_id,
            "status": updated.status,
            "priority": updated.priority,
            "message": f"Issue lifecycle advanced to {updated.status}"
        }
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
