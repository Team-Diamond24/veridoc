from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./veridoc.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)


# ─── Models ───────────────────────────────────────────────────────────────────

class Tender(Base):
    __tablename__ = "tenders"
    id = Column(Integer, primary_key=True, index=True)
    tender_number = Column(String(100), unique=True, index=True)
    title = Column(String(500))
    issuing_authority = Column(String(200))
    deadline = Column(String(50))
    file_path = Column(String(500))
    status = Column(String(50), default="uploaded")  # uploaded, extracting, ready, evaluating, completed
    criteria_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    criteria = relationship("Criterion", back_populates="tender", cascade="all, delete-orphan")
    bidders = relationship("Bidder", back_populates="tender", cascade="all, delete-orphan")


class Criterion(Base):
    __tablename__ = "criteria"
    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False)
    criterion_code = Column(String(50))
    name = Column(String(300))
    description = Column(Text)
    modal_type = Column(String(20), default="MANDATORY")  # MANDATORY, CONDITIONAL, OPTIONAL
    threshold_value = Column(Float, nullable=True)
    threshold_unit = Column(String(50), nullable=True)
    threshold_currency = Column(String(10), nullable=True)
    temporal_period = Column(Integer, nullable=True)
    temporal_unit = Column(String(20), nullable=True)
    evidence_type = Column(String(200), nullable=True)
    dependencies = Column(JSON, default=list)
    page_references = Column(JSON, default=list)
    raw_text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    tender = relationship("Tender", back_populates="criteria")
    verdicts = relationship("Verdict", back_populates="criterion")


class Bidder(Base):
    __tablename__ = "bidders"
    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False)
    company_name = Column(String(300))
    registration_number = Column(String(100), nullable=True)
    contact_email = Column(String(200), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    status = Column(String(50), default="documents_pending")
    pass_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    review_count = Column(Integer, default=0)
    overall_verdict = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tender = relationship("Tender", back_populates="bidders")
    documents = relationship("Document", back_populates="bidder", cascade="all, delete-orphan")
    verdicts = relationship("Verdict", back_populates="bidder")


class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    bidder_id = Column(Integer, ForeignKey("bidders.id"), nullable=False)
    filename = Column(String(300))
    file_path = Column(String(500))
    file_type = Column(String(20))  # pdf, docx, xlsx, image
    page_count = Column(Integer, default=0)
    ocr_confidence = Column(Float, default=0.0)
    doc_category = Column(String(100), nullable=True)  # financial, certificate, experience, etc.
    status = Column(String(30), default="uploaded")  # uploaded, processing, processed, failed
    created_at = Column(DateTime, default=datetime.utcnow)

    bidder = relationship("Bidder", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    chunk_index = Column(Integer)
    text = Column(Text)
    page_number = Column(Integer, default=1)
    bbox = Column(JSON, nullable=True)  # [x0, y0, x1, y1]
    ocr_confidence = Column(Float, default=1.0)
    source_label = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="chunks")


class Verdict(Base):
    __tablename__ = "verdicts"
    id = Column(Integer, primary_key=True, index=True)
    criterion_id = Column(Integer, ForeignKey("criteria.id"), nullable=False)
    bidder_id = Column(Integer, ForeignKey("bidders.id"), nullable=False)
    axis_evidence_quality = Column(Float, default=0.0)   # 0–100
    axis_semantic_match = Column(Float, default=0.0)     # 0–100
    axis_threshold_compliance = Column(Float, default=0.0)  # 0–100
    verdict = Column(String(20))  # PASS, FAIL, REVIEW
    reasoning = Column(Text, nullable=True)
    evidence_chain = Column(JSON, default=list)
    pdf_highlights = Column(JSON, default=list)
    counterfactual = Column(Text, nullable=True)
    confidence = Column(Float, default=0.0)
    is_overridden = Column(Boolean, default=False)
    original_verdict = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    criterion = relationship("Criterion", back_populates="verdicts")
    bidder = relationship("Bidder", back_populates="verdicts")
    corrections = relationship("Correction", back_populates="verdict")


class Correction(Base):
    __tablename__ = "corrections"
    id = Column(Integer, primary_key=True, index=True)
    verdict_id = Column(Integer, ForeignKey("verdicts.id"), nullable=False)
    original_verdict = Column(String(20))
    corrected_verdict = Column(String(20))
    axis_wrong = Column(Integer, nullable=True)  # 1, 2, or 3
    reason = Column(Text, nullable=True)
    officer_id = Column(String(100), default="officer_001")
    is_validated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    verdict = relationship("Verdict", back_populates="corrections")


class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100))
    entity_type = Column(String(50))  # tender, bidder, verdict, correction
    entity_id = Column(Integer, nullable=True)
    user_id = Column(String(100), default="officer_001")
    details = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
