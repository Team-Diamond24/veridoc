"""Evaluation router — trigger full pipeline, get verdicts, override."""
import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from database import get_db, Tender, Bidder, Criterion, Document, Chunk, Verdict, Correction, AuditLog
from schemas import VerdictOut, OverrideRequest, CorrectionOut

router = APIRouter(prefix="/api", tags=["Evaluation"])


def log_action(db, action, entity_type, entity_id, details=None):
    log = AuditLog(action=action, entity_type=entity_type, entity_id=entity_id, details=details or {})
    db.add(log)
    db.commit()


# ─── Evaluation Trigger ────────────────────────────────────────────────────────

@router.post("/tender/{tender_id}/evaluate")
async def trigger_evaluation(
    tender_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Trigger full 4-layer evaluation for all bidders of a tender."""
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    if tender.status not in ["ready", "completed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Tender is not ready for evaluation. Current status: {tender.status}"
        )

    criteria = db.query(Criterion).filter(Criterion.tender_id == tender_id).all()
    if not criteria:
        raise HTTPException(status_code=400, detail="No criteria extracted. Please wait for criteria extraction to complete.")

    bidders = db.query(Bidder).filter(Bidder.tender_id == tender_id).all()
    if not bidders:
        raise HTTPException(status_code=400, detail="No bidders registered for this tender.")

    tender.status = "evaluating"
    db.commit()

    background_tasks.add_task(run_evaluation_pipeline, tender_id, db)
    log_action(db, "evaluation_triggered", "tender", tender_id)

    return {
        "message": f"Evaluation started for {len(bidders)} bidder(s) across {len(criteria)} criteria.",
        "tender_id": tender_id,
        "bidders": len(bidders),
        "criteria": len(criteria),
        "status": "evaluating"
    }


def run_evaluation_pipeline(tender_id: int, db: Session):
    """Full pipeline: for each bidder, run Layers 3 & 4 for each criterion."""
    import asyncio
    from services.layer3_evidence import build_evidence_chain
    from services.layer4_verdict import evaluate_verdict_rule_based

    try:
        criteria = db.query(Criterion).filter(Criterion.tender_id == tender_id).all()
        bidders = db.query(Bidder).filter(Bidder.tender_id == tender_id).all()

        for bidder in bidders:
            # Gather all chunks for this bidder
            docs = db.query(Document).filter(
                Document.bidder_id == bidder.id,
                Document.status == "processed"
            ).all()

            all_chunks = []
            for doc in docs:
                chunks = db.query(Chunk).filter(Chunk.document_id == doc.id).all()
                for chunk in chunks:
                    all_chunks.append({
                        "text": chunk.text,
                        "page": chunk.page_number,
                        "bbox": chunk.bbox or [0, 0, 600, 800],
                        "ocr_confidence": chunk.ocr_confidence,
                        "source_label": f"{doc.filename} — {chunk.source_label}",
                        "chunk_id": chunk.id,
                    })

            # Layer 3 + 4 for each criterion
            pass_count = fail_count = review_count = 0
            for criterion in criteria:
                # Skip if already has a verdict
                existing = db.query(Verdict).filter(
                    Verdict.criterion_id == criterion.id,
                    Verdict.bidder_id == bidder.id
                ).first()
                if existing:
                    continue

                crit_dict = {
                    "id": criterion.id,
                    "criterion_code": criterion.criterion_code,
                    "name": criterion.name,
                    "description": criterion.description,
                    "modal_type": criterion.modal_type,
                    "threshold_value": criterion.threshold_value,
                    "threshold_unit": criterion.threshold_unit,
                    "threshold_currency": criterion.threshold_currency,
                    "evidence_type": criterion.evidence_type or "",
                }

                # Layer 3: Evidence mapping
                evidence_result = build_evidence_chain(crit_dict, all_chunks)

                # Layer 4: Verdict
                verdict_data = evaluate_verdict_rule_based(crit_dict, evidence_result)

                # Save verdict
                verdict = Verdict(
                    criterion_id=criterion.id,
                    bidder_id=bidder.id,
                    axis_evidence_quality=verdict_data["axis_evidence_quality"],
                    axis_semantic_match=verdict_data["axis_semantic_match"],
                    axis_threshold_compliance=verdict_data["axis_threshold_compliance"],
                    verdict=verdict_data["verdict"],
                    reasoning=verdict_data["reasoning"],
                    evidence_chain=verdict_data["evidence_chain"],
                    pdf_highlights=verdict_data["pdf_highlights"],
                    counterfactual=verdict_data["counterfactual"],
                    confidence=verdict_data["confidence"],
                )
                db.add(verdict)

                if verdict_data["verdict"] == "PASS":
                    pass_count += 1
                elif verdict_data["verdict"] == "FAIL":
                    fail_count += 1
                else:
                    review_count += 1

            # Update bidder summary
            bidder.pass_count = pass_count
            bidder.fail_count = fail_count
            bidder.review_count = review_count

            # Overall verdict logic
            total = len(criteria)
            mandatory_criteria = [c for c in criteria if c.modal_type == "MANDATORY"]
            mandatory_verdicts = db.query(Verdict).filter(
                Verdict.bidder_id == bidder.id,
                Verdict.criterion_id.in_([c.id for c in mandatory_criteria])
            ).all()
            fail_mandatory = sum(1 for v in mandatory_verdicts if v.verdict == "FAIL")
            review_mandatory = sum(1 for v in mandatory_verdicts if v.verdict == "REVIEW")

            if fail_mandatory > 0:
                bidder.overall_verdict = "FAIL"
            elif review_mandatory > 0:
                bidder.overall_verdict = "REVIEW"
            else:
                bidder.overall_verdict = "PASS"

            bidder.status = "evaluated"
            db.commit()

        # Mark tender complete
        tender = db.query(Tender).filter(Tender.id == tender_id).first()
        if tender:
            tender.status = "completed"
            db.commit()

        log_action(db, "evaluation_completed", "tender", tender_id,
                   {"bidders_evaluated": len(bidders)})

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Evaluation pipeline error for tender {tender_id}: {e}")
        tender = db.query(Tender).filter(Tender.id == tender_id).first()
        if tender:
            tender.status = "evaluation_failed"
            db.commit()


# ─── Verdict Retrieval ─────────────────────────────────────────────────────────

@router.get("/bidder/{bidder_id}/verdicts", response_model=List[VerdictOut])
def get_bidder_verdicts(bidder_id: int, db: Session = Depends(get_db)):
    return db.query(Verdict).filter(Verdict.bidder_id == bidder_id).all()


@router.get("/tender/{tender_id}/verdicts/summary")
def get_verdicts_summary(tender_id: int, db: Session = Depends(get_db)):
    """Matrix view: all bidders × criteria."""
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    criteria = db.query(Criterion).filter(Criterion.tender_id == tender_id).all()
    bidders = db.query(Bidder).filter(Bidder.tender_id == tender_id).all()

    matrix = []
    for bidder in bidders:
        verdicts = db.query(Verdict).filter(Verdict.bidder_id == bidder.id).all()
        verdict_map = {v.criterion_id: v for v in verdicts}

        row = {
            "bidder_id": bidder.id,
            "company_name": bidder.company_name,
            "registration_number": bidder.registration_number,
            "overall_verdict": bidder.overall_verdict,
            "pass_count": bidder.pass_count,
            "fail_count": bidder.fail_count,
            "review_count": bidder.review_count,
            "status": bidder.status,
            "criteria_verdicts": [],
        }

        for criterion in criteria:
            v = verdict_map.get(criterion.id)
            row["criteria_verdicts"].append({
                "criterion_id": criterion.id,
                "criterion_code": criterion.criterion_code,
                "criterion_name": criterion.name,
                "modal_type": criterion.modal_type,
                "verdict": v.verdict if v else "PENDING",
                "verdict_id": v.id if v else None,
                "confidence": v.confidence if v else None,
                "is_overridden": v.is_overridden if v else False,
            })

        matrix.append(row)

    return {
        "tender_id": tender_id,
        "tender_title": tender.title,
        "tender_status": tender.status,
        "criteria": [{"id": c.id, "code": c.criterion_code, "name": c.name, "modal": c.modal_type} for c in criteria],
        "matrix": matrix,
    }


@router.get("/verdict/{verdict_id}", response_model=VerdictOut)
def get_verdict(verdict_id: int, db: Session = Depends(get_db)):
    v = db.query(Verdict).filter(Verdict.id == verdict_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Verdict not found")
    return v


@router.get("/verdict/{verdict_id}/detail")
def get_verdict_detail(verdict_id: int, db: Session = Depends(get_db)):
    """Full verdict detail including criterion, bidder info, and evidence chain."""
    v = db.query(Verdict).filter(Verdict.id == verdict_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Verdict not found")

    criterion = db.query(Criterion).filter(Criterion.id == v.criterion_id).first()
    bidder = db.query(Bidder).filter(Bidder.id == v.bidder_id).first()

    return {
        "verdict_id": v.id,
        "verdict": v.verdict,
        "confidence": v.confidence,
        "is_overridden": v.is_overridden,
        "original_verdict": v.original_verdict,
        "axis_scores": {
            "evidence_quality": v.axis_evidence_quality,
            "semantic_match": v.axis_semantic_match,
            "threshold_compliance": v.axis_threshold_compliance,
        },
        "reasoning": v.reasoning,
        "evidence_chain": v.evidence_chain,
        "pdf_highlights": v.pdf_highlights,
        "counterfactual": v.counterfactual,
        "criterion": {
            "id": criterion.id,
            "code": criterion.criterion_code,
            "name": criterion.name,
            "description": criterion.description,
            "modal_type": criterion.modal_type,
            "threshold_value": criterion.threshold_value,
            "threshold_unit": criterion.threshold_unit,
            "evidence_type": criterion.evidence_type,
        } if criterion else None,
        "bidder": {
            "id": bidder.id,
            "company_name": bidder.company_name,
            "registration_number": bidder.registration_number,
        } if bidder else None,
        "created_at": v.created_at,
    }


# ─── Officer Override ──────────────────────────────────────────────────────────

@router.post("/verdict/{verdict_id}/override")
def override_verdict(
    verdict_id: int,
    override: OverrideRequest,
    db: Session = Depends(get_db),
):
    verdict = db.query(Verdict).filter(Verdict.id == verdict_id).first()
    if not verdict:
        raise HTTPException(status_code=404, detail="Verdict not found")

    # Save original
    if not verdict.is_overridden:
        verdict.original_verdict = verdict.verdict

    # Create correction record
    correction = Correction(
        verdict_id=verdict_id,
        original_verdict=verdict.original_verdict or verdict.verdict,
        corrected_verdict=override.correct_verdict,
        axis_wrong=override.axis_wrong,
        reason=override.reason,
        officer_id=override.officer_id,
    )
    db.add(correction)

    # Update verdict
    verdict.verdict = override.correct_verdict
    verdict.is_overridden = True
    db.commit()

    # Update bidder counts
    bidder = db.query(Bidder).filter(Bidder.id == verdict.bidder_id).first()
    if bidder:
        all_verdicts = db.query(Verdict).filter(Verdict.bidder_id == bidder.id).all()
        bidder.pass_count = sum(1 for v in all_verdicts if v.verdict == "PASS")
        bidder.fail_count = sum(1 for v in all_verdicts if v.verdict == "FAIL")
        bidder.review_count = sum(1 for v in all_verdicts if v.verdict == "REVIEW")
        db.commit()

    log_action(db, "verdict_overridden", "verdict", verdict_id, {
        "from": verdict.original_verdict,
        "to": override.correct_verdict,
        "officer": override.officer_id,
        "axis_wrong": override.axis_wrong,
    })

    return {
        "message": "Override recorded successfully.",
        "correction_id": correction.id,
        "new_verdict": override.correct_verdict,
    }


# ─── Collusion Check ───────────────────────────────────────────────────────────

@router.get("/tender/{tender_id}/collusion-check")
def check_collusion(tender_id: int, db: Session = Depends(get_db)):
    from services.layer4_verdict import detect_collusion_flags

    bidders = db.query(Bidder).filter(Bidder.tender_id == tender_id).all()
    all_chunks = {}

    for bidder in bidders:
        docs = db.query(Document).filter(Document.bidder_id == bidder.id).all()
        chunks = []
        for doc in docs:
            c = db.query(Chunk).filter(Chunk.document_id == doc.id).all()
            chunks.extend([{"text": chunk.text} for chunk in c])
        all_chunks[str(bidder.id)] = chunks

    flags = detect_collusion_flags({}, all_chunks)
    return {"tender_id": tender_id, "flags": flags, "flag_count": len(flags)}
