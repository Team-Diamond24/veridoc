"""Reports & Audit log router."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io

from database import get_db, AuditLog, Correction, Verdict, Tender, Bidder, Criterion
from schemas import AuditLogOut, CorrectionOut

router = APIRouter(prefix="/api", tags=["Reports"])


@router.get("/audit-log", response_model=List[AuditLogOut])
def get_audit_log(
    limit: int = 100,
    entity_type: str = None,
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog).order_by(AuditLog.timestamp.desc())
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    return query.limit(limit).all()


@router.get("/corrections", response_model=List[CorrectionOut])
def get_corrections(
    validated: bool = None,
    db: Session = Depends(get_db),
):
    query = db.query(Correction).order_by(Correction.created_at.desc())
    if validated is not None:
        query = query.filter(Correction.is_validated == validated)
    return query.all()


@router.post("/corrections/{correction_id}/validate")
def validate_correction(correction_id: int, db: Session = Depends(get_db)):
    """Senior analyst validates a correction."""
    c = db.query(Correction).filter(Correction.id == correction_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Correction not found")
    c.is_validated = True
    db.commit()
    return {"message": "Correction validated"}


@router.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_tenders = db.query(Tender).count()
    active = db.query(Tender).filter(Tender.status.in_(["ready", "evaluating"])).count()
    completed = db.query(Tender).filter(Tender.status == "completed").count()
    total_bidders = db.query(Bidder).count()
    total_verdicts = db.query(Verdict).count()
    pass_count = db.query(Verdict).filter(Verdict.verdict == "PASS").count()
    fail_count = db.query(Verdict).filter(Verdict.verdict == "FAIL").count()
    review_count = db.query(Verdict).filter(Verdict.verdict == "REVIEW").count()
    pending_reviews = db.query(Bidder).filter(Bidder.overall_verdict == "REVIEW").count()

    total_corrections = db.query(Correction).count()
    override_rate = round(total_corrections / total_verdicts * 100, 1) if total_verdicts > 0 else 0

    recent_logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(10).all()
    recent = [
        {
            "id": log.id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "user_id": log.user_id,
            "timestamp": log.timestamp.isoformat(),
        }
        for log in recent_logs
    ]

    return {
        "total_tenders": total_tenders,
        "active_tenders": active,
        "completed_evaluations": completed,
        "pending_reviews": pending_reviews,
        "total_bidders": total_bidders,
        "total_verdicts": total_verdicts,
        "pass_count": pass_count,
        "fail_count": fail_count,
        "review_count": review_count,
        "override_rate": override_rate,
        "recent_activity": recent,
    }


@router.get("/admin/bias-dashboard")
def get_bias_dashboard(db: Session = Depends(get_db)):
    """Bias detection: per-officer override rates."""
    corrections = db.query(Correction).all()

    officer_stats = {}
    for c in corrections:
        officer_id = c.officer_id
        if officer_id not in officer_stats:
            officer_stats[officer_id] = {"total": 0, "pass_to_fail": 0, "fail_to_pass": 0, "validated": 0}
        officer_stats[officer_id]["total"] += 1
        if c.original_verdict == "PASS" and c.corrected_verdict == "FAIL":
            officer_stats[officer_id]["pass_to_fail"] += 1
        elif c.original_verdict == "FAIL" and c.corrected_verdict == "PASS":
            officer_stats[officer_id]["fail_to_pass"] += 1
        if c.is_validated:
            officer_stats[officer_id]["validated"] += 1

    # Compute average override rate
    avg_overrides = (
        sum(v["total"] for v in officer_stats.values()) / len(officer_stats)
        if officer_stats else 0
    )

    # Flag officers with >2x average
    alerts = []
    for officer_id, stats in officer_stats.items():
        if avg_overrides > 0 and stats["total"] > avg_overrides * 2:
            alerts.append({
                "officer_id": officer_id,
                "override_count": stats["total"],
                "avg_overrides": avg_overrides,
                "alert": "Override rate >2x average — review recommended",
            })

    total_corrections = db.query(Correction).count()
    validated_count = db.query(Correction).filter(Correction.is_validated == True).count()

    return {
        "officer_stats": officer_stats,
        "alerts": alerts,
        "total_corrections": total_corrections,
        "validated_corrections": validated_count,
        "retraining_ready": total_corrections >= 200,
        "retraining_threshold": 200,
        "avg_override_rate": round(avg_overrides, 1),
    }


@router.get("/report/{tender_id}")
def export_report(tender_id: int, db: Session = Depends(get_db)):
    """Export evaluation report as PDF using ReportLab."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, HRFlowable
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        tender = db.query(Tender).filter(Tender.id == tender_id).first()
        if not tender:
            raise HTTPException(status_code=404, detail="Tender not found")

        criteria = db.query(Criterion).filter(Criterion.tender_id == tender_id).all()
        bidders = db.query(Bidder).filter(Bidder.tender_id == tender_id).all()

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm,
                                topMargin=2.5*cm, bottomMargin=2*cm)
        styles = getSampleStyleSheet()
        story = []

        # Header
        title_style = ParagraphStyle('title', parent=styles['Heading1'],
                                     fontSize=16, textColor=colors.HexColor('#1a3a6b'),
                                     alignment=TA_CENTER)
        sub_style = ParagraphStyle('sub', parent=styles['Normal'],
                                   fontSize=10, textColor=colors.HexColor('#666666'),
                                   alignment=TA_CENTER)
        body_style = ParagraphStyle('body', parent=styles['Normal'], fontSize=9)

        story.append(Paragraph("VERIDOC — TENDER EVALUATION REPORT", title_style))
        story.append(Paragraph("Government of India | CRPF Procurement Division", sub_style))
        story.append(Spacer(1, 0.3*cm))
        story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1a3a6b')))
        story.append(Spacer(1, 0.3*cm))

        # Tender info
        story.append(Paragraph(f"<b>Tender Number:</b> {tender.tender_number}", body_style))
        story.append(Paragraph(f"<b>Title:</b> {tender.title}", body_style))
        story.append(Paragraph(f"<b>Issuing Authority:</b> {tender.issuing_authority}", body_style))
        story.append(Paragraph(f"<b>Evaluation Date:</b> {tender.updated_at.strftime('%d %b %Y')}", body_style))
        story.append(Spacer(1, 0.5*cm))

        # Summary table
        story.append(Paragraph("<b>BIDDER EVALUATION SUMMARY</b>", styles['Heading2']))
        summary_data = [["S.No.", "Company Name", "Reg. No.", "PASS", "FAIL", "REVIEW", "Verdict"]]
        for i, bidder in enumerate(bidders, 1):
            verdict_color = {"PASS": "✓ PASS", "FAIL": "✗ FAIL", "REVIEW": "⚠ REVIEW"}.get(bidder.overall_verdict or "PENDING", "PENDING")
            summary_data.append([
                str(i), bidder.company_name[:30],
                bidder.registration_number or "N/A",
                str(bidder.pass_count), str(bidder.fail_count), str(bidder.review_count),
                verdict_color,
            ])

        summary_table = Table(summary_data, colWidths=[1*cm, 5*cm, 3*cm, 1.2*cm, 1.2*cm, 1.5*cm, 2.5*cm])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a3a6b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f4f8')]),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 0.5*cm))

        # Audit trail
        story.append(Paragraph("<b>AUDIT TRAIL</b>", styles['Heading2']))
        logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(20).all()
        log_data = [["Timestamp", "Action", "Entity", "User"]]
        for log in logs:
            log_data.append([
                log.timestamp.strftime('%d/%m/%Y %H:%M'),
                log.action.replace("_", " ").title(),
                f"{log.entity_type} #{log.entity_id}",
                log.user_id,
            ])
        log_table = Table(log_data, colWidths=[3.5*cm, 5*cm, 3.5*cm, 3.5*cm])
        log_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a4742')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f7f3')]),
        ]))
        story.append(log_table)
        story.append(Spacer(1, 0.5*cm))

        story.append(Paragraph(
            "This report is auto-generated by VERIDOC AI Evaluation System. "
            "All verdicts are subject to officer review. "
            "Reference: GFR 2017.",
            ParagraphStyle('footer', parent=styles['Normal'], fontSize=7,
                           textColor=colors.grey, alignment=TA_CENTER)
        ))

        doc.build(story)
        buf.seek(0)

        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=VERIDOC_Report_{tender.tender_number}.pdf"}
        )

    except ImportError:
        raise HTTPException(status_code=500, detail="ReportLab not installed. Cannot generate PDF.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")
