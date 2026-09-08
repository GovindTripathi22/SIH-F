"""
Closed-Loop Maintenance Lifecycle & Work Order Generation Service.
Generates official municipal PDF work orders, CSV exports, and verifies post-repair resolution.
"""

import io
import os
import csv
import json
from datetime import datetime, timezone
from typing import Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from app.models.issue import VerifiedIssue, IssueStatusHistory
from app.models.event import EventObservation, RawEvent

class WorkOrderService:
    """Manages work order creation, official municipal PDF generation, and closed-loop verification"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_pdf_work_order(self, issue_id: str, department: str = "BBMP Road Infrastructure Division") -> Tuple[bytes, str]:
        """
        Generate a formal municipal work order PDF using ReportLab.
        Returns: (pdf_bytes, filename)
        """
        query = select(VerifiedIssue).where(VerifiedIssue.issue_id == issue_id)
        result = await self.db.execute(query)
        issue = result.scalar_one_or_none()
        if not issue:
            raise ValueError(f"Issue {issue_id} does not exist")

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=18,
            leading=22,
            textColor=colors.HexColor('#0f172a'),
            spaceAfter=6
        )
        subtitle_style = ParagraphStyle(
            'SubTitleStyle',
            parent=styles['Normal'],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#475569')
        )
        bold_style = ParagraphStyle('BoldStyle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9)
        normal_style = ParagraphStyle('NormalStyle', parent=styles['Normal'], fontSize=9, leading=12)

        elements = []

        # Municipal Header
        elements.append(Paragraph("MUNICIPAL CORPORATION OF GREATER BENGALURU (BBMP)", title_style))
        elements.append(Paragraph("In collaboration with Bharat Electronics Limited (BEL) • Smart Cities Division", subtitle_style))
        elements.append(Paragraph(f"URBANPULSE AUTOMATED INFRASTRUCTURE WORK ORDER #{issue_id.upper()}", bold_style))
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#2563eb'), spaceAfter=14))

        # Metadata grid
        now_str = datetime.now(timezone.utc).strftime("%d-%b-%Y %H:%M UTC")
        meta_data = [
            [Paragraph("<b>Work Order ID:</b>", normal_style), Paragraph(f"WO-{issue_id.upper()}", bold_style),
             Paragraph("<b>Issue Category:</b>", normal_style), Paragraph(issue.event_type.upper(), bold_style)],
            [Paragraph("<b>Date Generated:</b>", normal_style), Paragraph(now_str, normal_style),
             Paragraph("<b>Severity Rating:</b>", normal_style), Paragraph(issue.severity, bold_style)],
            [Paragraph("<b>Priority Score:</b>", normal_style), Paragraph(f"{issue.priority} ({issue.priority_score}/100)", bold_style),
             Paragraph("<b>Assigned Authority:</b>", normal_style), Paragraph(department, normal_style)],
            [Paragraph("<b>GPS Coordinates:</b>", normal_style), Paragraph(f"{issue.centroid_latitude:.5f}° N, {issue.centroid_longitude:.5f}° E", normal_style),
             Paragraph("<b>Cluster Radius:</b>", normal_style), Paragraph(f"±{issue.cluster_radius_meters:.1f} meters", normal_style)],
        ]
        meta_table = Table(meta_data, colWidths=[110, 160, 110, 160])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 14))

        # Evidence & Multi-Pass Fleet Verification Breakdown
        elements.append(Paragraph("<b>FLEET MULTI-PASS VERIFICATION AUDIT TRAIL</b>", bold_style))
        elements.append(Spacer(1, 4))

        reasons = []
        try:
            if issue.priority_reasons:
                reasons = json.loads(issue.priority_reasons)
        except Exception:
            reasons = [issue.priority_reasons or "Verified via automated bus sensing"]

        reasons_text = "<br/>• " + "<br/>• ".join(reasons)
        evidence_data = [
            [Paragraph("<b>Fleet Passes:</b>", normal_style), Paragraph(str(issue.observation_count), bold_style),
             Paragraph("<b>Distinct Buses:</b>", normal_style), Paragraph(str(issue.distinct_bus_count), bold_style)],
            [Paragraph("<b>Combined AI Confidence:</b>", normal_style), Paragraph(f"{issue.confidence*100:.1f}%", bold_style),
             Paragraph("<b>Consensus Score:</b>", normal_style), Paragraph(f"{issue.verification_score*100:.1f}%", bold_style)],
            [Paragraph("<b>Verification Factors:</b>", normal_style), Paragraph(reasons_text, normal_style), "", ""]
        ]
        evidence_table = Table(evidence_data, colWidths=[110, 160, 110, 160])
        evidence_table.setStyle(TableStyle([
            ('SPAN', (1, 2), (3, 2)),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#eff6ff')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#93c5fd')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#bfdbfe')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(evidence_table)
        elements.append(Spacer(1, 16))

        # Required Maintenance Actions
        elements.append(Paragraph("<b>REQUIRED MUNICIPAL ACTION & DISPATCH PROTOCOL</b>", bold_style))
        actions_text = (
            "1. Dispatch PWD Ward Rapid Response Unit within 24 hours of notice.<br/>"
            "2. Excavate loose debris and apply hot/cold mix asphalt to specified grade.<br/>"
            "3. Compact with dynamic roller to match ambient road roughness index (IRI).<br/>"
            "4. Post-repair validation: mark status REPAIRED in portal; UrbanPulse fleet sensors "
            "will automatically monitor the GPS coordinate on subsequent bus runs to certify durable resolution."
        )
        elements.append(Paragraph(actions_text, normal_style))
        elements.append(Spacer(1, 20))

        # Sign-off block
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#cbd5e1'), spaceAfter=12))
        sig_data = [
            [Paragraph("<b>Issuing Authority (BEL/BBMP):</b>", normal_style), Paragraph("<b>Contractor Representative:</b>", normal_style), Paragraph("<b>Resolution Verifier:</b>", normal_style)],
            [Paragraph("____________________________<br/>Executive Engineer, BBMP", normal_style),
             Paragraph("____________________________<br/>Site Supervisor", normal_style),
             Paragraph("____________________________<br/>Automated Bus Fleet Pass", normal_style)]
        ]
        sig_table = Table(sig_data, colWidths=[180, 180, 180])
        sig_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(sig_table)

        doc.build(elements)
        buffer.seek(0)
        filename = f"WorkOrder_{issue_id.upper()}.pdf"
        return buffer.getvalue(), filename

    async def advance_lifecycle(
        self,
        issue_id: str,
        target_status: str,
        actor: str,
        notes: str = ""
    ) -> VerifiedIssue:
        """
        Closed-loop state transitions:
        PENDING -> IN_PROGRESS -> REPAIRED -> RESOLUTION_VERIFIED
        """
        valid_transitions = {
            "PENDING": ["IN_PROGRESS", "CLOSED"],
            "CANDIDATE": ["IN_PROGRESS", "CLOSED"],
            "SUPPORTED": ["IN_PROGRESS", "CLOSED"],
            "VERIFIED": ["IN_PROGRESS", "CLOSED"],
            "IN_PROGRESS": ["REPAIRED", "PENDING"],
            "REPAIRED": ["RESOLUTION_VERIFIED", "REOPENED", "IN_PROGRESS"],
            "REOPENED": ["IN_PROGRESS"],
            "RESOLUTION_VERIFIED": ["CLOSED"]
        }

        query = select(VerifiedIssue).where(VerifiedIssue.issue_id == issue_id)
        result = await self.db.execute(query)
        issue = result.scalar_one_or_none()
        if not issue:
            raise ValueError(f"Issue {issue_id} not found")

        old_status = issue.status
        if target_status == old_status:
            if notes:
                issue.resolution_notes = notes
            issue.updated_at = datetime.now(timezone.utc)
            return issue

        allowed_next = valid_transitions.get(old_status, [])
        if target_status not in allowed_next:
            raise ValueError(
                f"Invalid lifecycle transition from '{old_status}' to '{target_status}'. "
                f"Defensible municipal transitions allowed from '{old_status}': {allowed_next}"
            )

        issue.status = target_status
        issue.updated_at = datetime.now(timezone.utc)

        # Explicit verification state progression (Phase 6 & Phase 15)
        if target_status == "IN_PROGRESS":
            issue.verification_state = "ACTIONED"
        elif target_status in ["REPAIRED", "RESOLVED"]:
            issue.verification_state = "RESOLVED"
        elif target_status == "RESOLUTION_VERIFIED":
            issue.verification_state = "RESOLUTION_VERIFIED"
        elif target_status == "REOPENED":
            issue.verification_state = "REPAIR_FAILED"

        if target_status in ["RESOLVED", "REPAIRED", "RESOLUTION_VERIFIED"]:
            issue.resolved_at = datetime.now(timezone.utc)
            issue.resolved_by = actor
            issue.resolution_notes = notes

        # Track history
        history = IssueStatusHistory(
            issue_id=issue_id,
            old_status=old_status,
            new_status=target_status,
            changed_by=actor,
            change_reason=notes
        )
        self.db.add(history)
        await self.db.flush()
        await self.db.refresh(issue)

        return issue
