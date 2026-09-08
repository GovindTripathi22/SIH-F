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


class CleanPassRequest(BaseModel):
    bus_id: str
    timestamp: Optional[str] = None


@router.post("/work-orders/{issue_id}/clean-pass")
async def record_clean_pass_endpoint(
    issue_id: str,
    req: CleanPassRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Record an automated clean fleet transit pass over a repaired infrastructure coordinate.
    When 2 consecutive clean passes report zero defect recurrence, auto-promotes to RESOLUTION_VERIFIED.
    """
    try:
        service = WorkOrderService(db)
        updated_issue, is_auto_verified = await service.record_clean_pass(
            issue_id=issue_id,
            bus_id=req.bus_id
        )
        return {
            "success": True,
            "issue_id": updated_issue.issue_id,
            "status": updated_issue.status,
            "verification_state": updated_issue.verification_state,
            "is_resolution_verified": is_auto_verified,
            "message": "Resolution verified by consecutive clean passes" if is_auto_verified else f"Clean pass recorded for Bus {req.bus_id}"
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

