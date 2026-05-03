"""Bidders router — create bidder, upload documents, get status."""
import os
from typing import List
from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from database import get_db, Bidder, Document, Chunk, AuditLog, Tender
from schemas import BidderCreate, BidderOut, DocumentOut

router = APIRouter(prefix="/api/bidder", tags=["Bidders"])

UPLOAD_DIR = "uploads/bidders"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def log_action(db, action, entity_type, entity_id, details=None):
    log = AuditLog(action=action, entity_type=entity_type, entity_id=entity_id, details=details or {})
    db.add(log)
    db.commit()


@router.get("/tender/{tender_id}", response_model=List[BidderOut])
def list_bidders(tender_id: int, db: Session = Depends(get_db)):
    return db.query(Bidder).filter(Bidder.tender_id == tender_id).all()


@router.get("/{bidder_id}", response_model=BidderOut)
def get_bidder(bidder_id: int, db: Session = Depends(get_db)):
    bidder = db.query(Bidder).filter(Bidder.id == bidder_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found")
    return bidder


@router.post("/create", response_model=BidderOut)
def create_bidder(data: BidderCreate, db: Session = Depends(get_db)):
    # Verify tender exists
    tender = db.query(Tender).filter(Tender.id == data.tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    bidder = Bidder(
        tender_id=data.tender_id,
        company_name=data.company_name,
        registration_number=data.registration_number,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        status="documents_pending",
    )
    db.add(bidder)
    db.commit()
    db.refresh(bidder)
    log_action(db, "bidder_created", "bidder", bidder.id, {"company": data.company_name})
    return bidder


@router.post("/{bidder_id}/upload-documents")
async def upload_documents(
    bidder_id: int,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """Upload one or more documents for a bidder."""
    bidder = db.query(Bidder).filter(Bidder.id == bidder_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found")

    uploaded = []
    bidder_dir = os.path.join(UPLOAD_DIR, f"bidder_{bidder_id}")
    os.makedirs(bidder_dir, exist_ok=True)

    for file in files:
        file_path = os.path.join(bidder_dir, file.filename)
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        # Detect file type
        ext = os.path.splitext(file.filename)[1].lower()
        type_map = {".pdf": "pdf", ".docx": "docx", ".doc": "docx",
                    ".xlsx": "xlsx", ".xls": "xlsx",
                    ".jpg": "image", ".jpeg": "image", ".png": "image"}
        file_type = type_map.get(ext, "unknown")

        doc = Document(
            bidder_id=bidder_id,
            filename=file.filename,
            file_path=file_path,
            file_type=file_type,
            status="uploaded",
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        uploaded.append(doc.id)

        # Process in background
        background_tasks.add_task(process_document_background, doc.id, file_path, db)

    bidder.status = "documents_uploaded"
    db.commit()
    log_action(db, "documents_uploaded", "bidder", bidder_id, {"doc_ids": uploaded})

    return {"message": f"{len(uploaded)} document(s) uploaded and processing", "document_ids": uploaded}


def process_document_background(doc_id: int, file_path: str, db: Session):
    """Background: OCR process a bidder document and save chunks."""
    from services.layer1_ocr import process_document

    try:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return
        doc.status = "processing"
        db.commit()

        result = process_document(file_path)
        doc.page_count = result["page_count"]
        doc.ocr_confidence = result["avg_confidence"]
        doc.file_type = result["file_type"]

        # Auto-categorize
        all_text = " ".join(c["text"] for c in result["chunks"]).lower()
        if any(kw in all_text for kw in ["balance sheet", "profit", "loss", "turnover", "revenue", "ca certificate"]):
            doc.doc_category = "financial"
        elif any(kw in all_text for kw in ["gst", "gstin", "registration certificate"]):
            doc.doc_category = "registration"
        elif any(kw in all_text for kw in ["completion certificate", "work order", "experience"]):
            doc.doc_category = "experience"
        elif any(kw in all_text for kw in ["iso", "certification", "quality"]):
            doc.doc_category = "certification"
        else:
            doc.doc_category = "general"

        # Save chunks
        for chunk_data in result["chunks"]:
            chunk = Chunk(
                document_id=doc_id,
                chunk_index=chunk_data["chunk_index"],
                text=chunk_data["text"],
                page_number=chunk_data.get("page", 1),
                bbox=chunk_data.get("bbox"),
                ocr_confidence=chunk_data.get("ocr_confidence", 1.0),
                source_label=chunk_data.get("source_label", ""),
            )
            db.add(chunk)

        doc.status = "processed"
        db.commit()

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Document processing failed for doc {doc_id}: {e}")
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = "failed"
            db.commit()


@router.get("/{bidder_id}/documents", response_model=List[DocumentOut])
def get_bidder_documents(bidder_id: int, db: Session = Depends(get_db)):
    return db.query(Document).filter(Document.bidder_id == bidder_id).all()


@router.delete("/{bidder_id}")
def delete_bidder(bidder_id: int, db: Session = Depends(get_db)):
    bidder = db.query(Bidder).filter(Bidder.id == bidder_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found")
    db.delete(bidder)
    db.commit()
    return {"message": "Bidder deleted"}
