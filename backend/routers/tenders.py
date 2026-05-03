"""Tenders router — upload, list, get criteria, trigger evaluation."""
import os
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from database import get_db, Tender, Criterion, AuditLog
from schemas import TenderCreate, TenderOut, CriterionOut, CriterionUpdate

router = APIRouter(prefix="/api/tender", tags=["Tenders"])

UPLOAD_DIR = "uploads/tenders"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def log_action(db: Session, action: str, entity_type: str, entity_id: int, details: dict = None):
    log = AuditLog(action=action, entity_type=entity_type, entity_id=entity_id, details=details or {})
    db.add(log)
    db.commit()


@router.get("/", response_model=List[TenderOut])
def list_tenders(db: Session = Depends(get_db)):
    return db.query(Tender).order_by(Tender.created_at.desc()).all()


@router.get("/{tender_id}", response_model=TenderOut)
def get_tender(tender_id: int, db: Session = Depends(get_db)):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return tender


@router.post("/upload", response_model=TenderOut)
async def upload_tender(
    background_tasks: BackgroundTasks,
    tender_number: str = Form(...),
    title: str = Form(...),
    issuing_authority: str = Form(default="CRPF HQ"),
    deadline: Optional[str] = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Check duplicate tender number
    existing = db.query(Tender).filter(Tender.tender_number == tender_number).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Tender '{tender_number}' already exists")

    # Save file
    file_path = os.path.join(UPLOAD_DIR, f"{tender_number}_{file.filename}")
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Create DB record
    tender = Tender(
        tender_number=tender_number,
        title=title,
        issuing_authority=issuing_authority,
        deadline=deadline,
        file_path=file_path,
        status="uploaded",
    )
    db.add(tender)
    db.commit()
    db.refresh(tender)

    log_action(db, "tender_uploaded", "tender", tender.id, {"filename": file.filename})

    # Start criteria extraction in background
    background_tasks.add_task(extract_criteria_background, tender.id, file_path, db)

    return tender


def extract_criteria_background(tender_id: int, file_path: str, db: Session):
    """Background task: OCR + obligation extraction for tender document."""
    from services.layer1_ocr import process_document
    from services.layer2_obligations import extract_criteria_from_text

    try:
        # Update status
        tender = db.query(Tender).filter(Tender.id == tender_id).first()
        if not tender:
            return
        tender.status = "extracting"
        db.commit()

        # Layer 1: Extract text
        result = process_document(file_path)
        full_text = "\n\n".join(c["text"] for c in result["chunks"])

        # Collect page references
        page_refs = list(set(c["page"] for c in result["chunks"]))

        # Layer 2: Extract criteria
        raw_criteria = extract_criteria_from_text(full_text, page_refs)

        # Save criteria to DB
        for crit_data in raw_criteria:
            criterion = Criterion(
                tender_id=tender_id,
                criterion_code=crit_data["criterion_code"],
                name=crit_data["name"],
                description=crit_data["description"],
                modal_type=crit_data["modal_type"],
                threshold_value=crit_data.get("threshold_value"),
                threshold_unit=crit_data.get("threshold_unit"),
                threshold_currency=crit_data.get("threshold_currency"),
                temporal_period=crit_data.get("temporal_period"),
                temporal_unit=crit_data.get("temporal_unit"),
                evidence_type=crit_data.get("evidence_type"),
                dependencies=crit_data.get("dependencies", []),
                page_references=crit_data.get("page_references", []),
                raw_text=crit_data.get("raw_text", ""),
            )
            db.add(criterion)

        tender.criteria_count = len(raw_criteria)
        tender.status = "ready"
        db.commit()

        log_action(db, "criteria_extracted", "tender", tender_id,
                   {"criteria_count": len(raw_criteria)})

    except Exception as e:
        db_session = db
        tender = db_session.query(Tender).filter(Tender.id == tender_id).first()
        if tender:
            tender.status = "extraction_failed"
            db_session.commit()
        import logging
        logging.getLogger(__name__).error(f"Criteria extraction failed for tender {tender_id}: {e}")


@router.get("/{tender_id}/criteria", response_model=List[CriterionOut])
def get_criteria(tender_id: int, db: Session = Depends(get_db)):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return db.query(Criterion).filter(Criterion.tender_id == tender_id).all()


@router.put("/criteria/{criterion_id}", response_model=CriterionOut)
def update_criterion(
    criterion_id: int,
    update: CriterionUpdate,
    db: Session = Depends(get_db),
):
    """Allow officer to edit extracted criteria before evaluation."""
    crit = db.query(Criterion).filter(Criterion.id == criterion_id).first()
    if not crit:
        raise HTTPException(status_code=404, detail="Criterion not found")

    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(crit, field, value)
    db.commit()
    db.refresh(crit)

    log_action(db, "criterion_edited", "criterion", criterion_id, {"fields_updated": list(update.model_dump(exclude_unset=True).keys())})
    return crit


@router.delete("/{tender_id}")
def delete_tender(tender_id: int, db: Session = Depends(get_db)):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    # Clean up file
    if tender.file_path and os.path.exists(tender.file_path):
        os.remove(tender.file_path)
    db.delete(tender)
    db.commit()
    return {"message": "Tender deleted"}
