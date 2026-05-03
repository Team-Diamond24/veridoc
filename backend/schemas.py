from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


# ─── Tender Schemas ────────────────────────────────────────────────────────────

class TenderCreate(BaseModel):
    tender_number: str
    title: str
    issuing_authority: str = "CRPF HQ"
    deadline: Optional[str] = None


class TenderOut(BaseModel):
    id: int
    tender_number: str
    title: str
    issuing_authority: str
    deadline: Optional[str]
    status: str
    criteria_count: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Criterion Schemas ─────────────────────────────────────────────────────────

class CriterionOut(BaseModel):
    id: int
    tender_id: int
    criterion_code: str
    name: str
    description: str
    modal_type: str
    threshold_value: Optional[float]
    threshold_unit: Optional[str]
    threshold_currency: Optional[str]
    temporal_period: Optional[int]
    temporal_unit: Optional[str]
    evidence_type: Optional[str]
    dependencies: List[Any]
    page_references: List[Any]
    raw_text: str

    class Config:
        from_attributes = True


class CriterionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    modal_type: Optional[str] = None
    threshold_value: Optional[float] = None
    threshold_unit: Optional[str] = None
    evidence_type: Optional[str] = None


# ─── Bidder Schemas ────────────────────────────────────────────────────────────

class BidderCreate(BaseModel):
    tender_id: int
    company_name: str
    registration_number: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None


class BidderOut(BaseModel):
    id: int
    tender_id: int
    company_name: str
    registration_number: Optional[str]
    contact_email: Optional[str]
    status: str
    pass_count: int
    fail_count: int
    review_count: int
    overall_verdict: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Document Schemas ──────────────────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: int
    bidder_id: int
    filename: str
    file_type: str
    page_count: int
    ocr_confidence: float
    doc_category: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Verdict Schemas ───────────────────────────────────────────────────────────

class VerdictOut(BaseModel):
    id: int
    criterion_id: int
    bidder_id: int
    axis_evidence_quality: float
    axis_semantic_match: float
    axis_threshold_compliance: float
    verdict: str
    reasoning: Optional[str]
    evidence_chain: List[Any]
    pdf_highlights: List[Any]
    counterfactual: Optional[str]
    confidence: float
    is_overridden: bool
    original_verdict: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class OverrideRequest(BaseModel):
    correct_verdict: str = Field(..., pattern="^(PASS|FAIL|REVIEW)$")
    axis_wrong: Optional[int] = Field(None, ge=1, le=3)
    reason: str
    officer_id: str = "officer_001"


# ─── Correction Schemas ────────────────────────────────────────────────────────

class CorrectionOut(BaseModel):
    id: int
    verdict_id: int
    original_verdict: str
    corrected_verdict: str
    axis_wrong: Optional[int]
    reason: Optional[str]
    officer_id: str
    is_validated: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Audit Log Schemas ─────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: Optional[int]
    user_id: str
    details: Optional[Any]
    timestamp: datetime

    class Config:
        from_attributes = True


# ─── Dashboard Stats ───────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_tenders: int
    active_tenders: int
    completed_evaluations: int
    pending_reviews: int
    total_bidders: int
    total_verdicts: int
    pass_count: int
    fail_count: int
    review_count: int
    override_rate: float
    recent_activity: List[Any]
