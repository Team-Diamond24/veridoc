# VERIDOC — AI-Powered Tender Evaluation Platform

## What is VERIDOC?

VERIDOC is an intelligent system that automates the evaluation of government tender bids. Imagine you're a government procurement officer with a stack of 100+ pages of tender rules and 10 bidders each submitting their own 50+ pages of documents. Your job: figure out which bidders meet the eligibility criteria.

**Current reality**: This is manual, slow, inconsistent, and exhausting. Two officers might reach different conclusions from the same documents.

**VERIDOC's goal**: Use AI to extract the eligibility rules from the tender, parse each bidder's documents (whether they're typed PDFs, scanned copies, Word files, or even photos), and produce a clear, explainable verdict for each bidder on each criterion. Ambiguous cases go to a human for review — nothing is silently rejected.

---

## The Problem We're Solving

### Government Tenders Are Complex

When the Central Reserve Police Force (CRPF) issues a tender, they specify detailed requirements:
- **Technical specs**: "Bidders must be ISO 9001 certified"
- **Financial**: "Minimum annual turnover ₹5 crore"
- **Compliance**: "GST registration mandatory"
- **Experience**: "At least 3 similar projects in the last 5 years"

These rules are written across many pages of formal, legally careful language.

### Bids Come in All Shapes

Each company responds with a different mix of documents:
- Some submit typed PDFs
- Some submit scanned copies of certificates
- Some send Word documents or Excel files
- Some attach photos of physical documents
- The *same information* is presented in *different ways* by different bidders

### Current Evaluation is Manual & Unreliable

A committee manually cross-checks hundreds of pages against the criteria list:
- Takes days per tender
- Inconsistent results between evaluators
- Easy to miss things or misinterpret language
- Hard to audit decisions later
- No clear trail of why a bidder passed or failed

---

## How VERIDOC Works

### The Four-Layer Architecture

VERIDOC processes tenders in four connected layers, each handling a specific part of the problem:

#### **Layer 1: Document Ingestion & OCR**
*"Turn every document into machine-readable text"*

- **What it does**: Takes all incoming documents (PDFs, Word files, scanned images, photos) and converts them into structured text with precise references.
- **Technology**: 
  - PaddleOCR for scans/images
  - python-docx for Word files
  - PDF parsers for typed PDFs
- **Output**: Clean markdown with bounding boxes that point to exact locations in the original PDF
- **Why this matters**: Later on, when we tell an officer "the bidder's turnover is ₹50 crore," we can highlight exactly where that number appears in the PDF.

#### **Layer 2: Obligation Extraction**
*"Extract the rules from the tender"*

- **What it does**: Reads the tender document and pulls out structured eligibility criteria.
- **Technology**: LegalBERT (a legal AI model) fine-tuned on CRPF tender documents
- **Understands**: 
  - Which criteria are mandatory vs. optional ("must have" vs. "nice to have")
  - Numerical thresholds ("₹5 crore minimum")
  - Time-based requirements ("last 5 years")
  - Evidence types ("provide GST certificate")
- **Output**: An "obligation graph" — a structured list of rules that can be checked programmatically
- **Why this matters**: We need to understand what the tender *actually requires* before we can check if a bidder meets it.

#### **Layer 3: Evidence Mapping**
*"Find the proof that bidders provide"*

- **What it does**: For each criterion, finds and chains together the relevant evidence across all the bidder's documents.
- **Technology**: IndexRAG (a retrieval system) that builds multi-hop connections
- **Example**: For "Annual turnover ₹5 crore":
  - Finds the claim in the bid letter ("We have annual turnover ₹50 crores")
  - Links to the supporting P&L statement (pages 4–5)
  - Links to the auditor's certificate ("P&L verified for FY2021–23")
  - Brings all three pieces together so the next layer can evaluate them
- **Output**: Complete evidence chains with confidence scores
- **Why this matters**: We don't just check "does the bidder claim they meet the criterion?" We check "does the bidder *prove* it with credible evidence?"

#### **Layer 4: Verdict Engine**
*"Make the actual pass/fail/review decision"*

- **What it does**: Evaluates the evidence against each criterion and produces a verdict
- **Technology**: Claude Sonnet 4 (an LLM) + a three-axis decision framework
- **Three axes** (each scored 0–100):
  1. **Evidence Quality**: Is the evidence legible, complete, properly formatted? (OCR confidence, document structure, etc.)
  2. **Semantic Match**: Does the evidence actually address the criterion? (not just any document, but the *right* document)
  3. **Threshold Compliance**: Does the value meet the requirement? (₹50 crore > ₹5 crore? ✓)
- **Decision logic**:
  - **PASS**: All three axes ≥80%
  - **FAIL**: Any axis <20% (automatic veto)
  - **REVIEW**: Borderline cases (anything in the 50–79% range, or mixed scores)
- **Output**: Structured verdict with reasoning and counterfactual guidance ("If you submit X, you'd pass")
- **Why this matters**: We don't just say "you failed." We explain *why* and *what would fix it*.

---

## What Makes VERIDOC Different

### ✓ Never Silently Rejects
If the system is unsure, it flags the case for human review rather than rejecting the bidder. An officer sees the uncertainty and makes the call.

### ✓ Fully Explainable
Every verdict references:
- The specific criterion
- The specific document(s) used
- The exact values/evidence found
- A visual highlight in the PDF
- A clear explanation of the reasoning

This is essential for auditability in government procurement.

### ✓ Handles Real-World Messiness
- **Scanned documents**: OCR handles handwritten or low-quality scans
- **Format variation**: Same info presented differently by different bidders? The system finds it.
- **Multiple document types**: Word files, Excel sheets, PDFs, photos — all processed uniformly
- **Ambiguity**: Unclear cases go to humans, not automatically rejected

### ✓ Learns from Feedback
When an officer disagrees with a verdict, the system captures:
- What was wrong (which axis?)
- The correct verdict
- The original documents and evidence
This gets fed back into model retraining, so the system improves over time.

---

## System Architecture

```
INPUT DOCUMENTS
    ↓
┌─────────────────────────────────────┐
│ LAYER 1: Document Ingestion & OCR   │
├─────────────────────────────────────┤
│ • Detect file type (PDF, DOCX, JPG) │
│ • Parse → structured text           │
│ • Preserve bounding boxes           │
│ • Confidence scoring                │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ LAYER 2: Obligation Extraction      │
├─────────────────────────────────────┤
│ • LegalBERT fine-tuned on CRPF data │
│ • Extract criteria with metadata    │
│ • Build dependency graph            │
│ • Flag mandatory vs. optional       │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ LAYER 3: Evidence Mapping           │
├─────────────────────────────────────┤
│ • IndexRAG multi-hop retrieval      │
│ • Chain evidence across documents   │
│ • Completeness scoring              │
│ • Confidence per chain              │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ LAYER 4: Verdict Engine             │
├─────────────────────────────────────┤
│ • 3-axis scoring (Quality/Match/OK) │
│ • Decision tree logic               │
│ • Counterfactual generation         │
│ • Collusion risk flagging           │
└─────────────────────────────────────┘
    ↓
OUTPUT: Structured Evaluation Report
├─ Per-bidder summary
├─ Criterion-by-criterion verdicts
├─ PDF citations
├─ Officer review form
└─ Collusion flags
```

---

## Technology Stack

### Document Processing
- **OCR**: PaddleOCR-VL-0.9B (handles 109+ languages including Hindi)
- **Word parsing**: python-docx
- **PDF handling**: pdfplumber, PyPDF2
- **Markdown conversion**: pandoc

### NLP & Reasoning
- **Obligation extraction**: LegalBERT (fine-tuned on CRPF tenders)
- **Evidence retrieval**: IndexRAG (multi-hop RAG system)
- **Embeddings**: IndicBERT (for Indian names/text)
- **Verdict reasoning**: Claude Sonnet 4 (structured output)

### Infrastructure
- **Backend**: FastAPI (async Python framework)
- **Database**: PostgreSQL (audit trail, corrections, verdicts)
- **Vector store**: Faiss (self-hosted embeddings for retrieval)
- **Frontend**: React + PDF.js (interactive verdict viewer)
- **Deployment**: Self-hosted (on-prem or AWS)

---

## Implementation Roadmap (20 Weeks)

### **Phase 1: Foundation (Weeks 1–3)**
- Set up OCR pipeline (PaddleOCR + multi-format handler)
- Build FastAPI backend + PostgreSQL schema
- Collect & prepare CRPF tender training data (50+ documents)
- Start LegalBERT fine-tuning
- **Validation gate**: Test LegalBERT on hold-out tenders (F1 ≥ 0.75)

### **Phase 2: Core Reasoning (Weeks 4–9)**
- Complete obligation graph extraction
- Build IndexRAG evidence mapper
- Implement verdict engine with Claude Sonnet 4
- **Validation gate**: Test evidence chains on real scenarios
- Define REVIEW thresholds explicitly

### **Phase 3: Explainability & UI (Weeks 10–15)**
- PDF bounding-box overlay system
- Counterfactual recourse generator (GFR 2017 compliant)
- Collusion detection module + validation on real data
- React frontend with PDF viewer
- Officer review form
- **Validation gate**: Collusion precision ≥ 85%

### **Phase 4: Learning & Deployment (Weeks 16–20)**
- Correction capture & storage
- Bias detection dashboard
- Active learning retraining pipeline
- Full audit report generation
- Deployment on sandbox with sample documents

---

## Key Design Decisions & Why

### **Why Three Axes for Verdicts?**
Instead of one overall score, we evaluate on three independent axes because:
1. A bidder might have excellent documents (Axis 1 ✓) that don't match what we're looking for (Axis 2 ✗) → REVIEW, not silent FAIL
2. It gives officers clarity on *what went wrong* so they can provide feedback
3. It's debuggable: we can retrain specific components that are failing

### **Why IndexRAG Over Naive RAG?**
Naive RAG (retrieve one chunk at a time) fails on complex criteria that require evidence spanning multiple documents. IndexRAG pre-computes "bridges" between related facts so we get complete chains in one retrieval.

### **Why REVIEW Instead of Accepting/Rejecting Ambiguous Cases?**
Government procurement has high stakes. A bidder silently rejected due to low OCR confidence might sue. Better to flag ambiguity and let a human decide, with full transparency.

### **Why Active Learning?**
CRPF will process hundreds of tenders. Every officer override is free training data. By capturing corrections and retraining monthly, the system improves over time, adapting to CRPF's specific style and preferences.

---

## How to Use VERIDOC

### For a Procurement Officer:

1. **Upload** a tender document
2. **Upload** all bidder submissions
3. **Click** "Evaluate"
4. VERIDOC extracts criteria, processes bids, generates verdicts
5. **Review** the results:
   - Green badges: clearly eligible
   - Red badges: clearly ineligible
   - Amber badges: needs your review
6. **For amber cases**: Click to see the evidence, read the reasoning, make a call
7. **Click** "Override" if you disagree → your correction gets logged and will improve the system
8. **Export** the final report (PDF with audit trail)

### For a System Admin:

1. Deploy VERIDOC on your server (Docker container)
2. Point to your database
3. Ensure self-hosted OCR service is running
4. Set CRPF-specific tuning (collusion thresholds, modal language mappings)
5. Monitor audit logs and bias dashboard
6. Monthly: review corrections, check for systemic bias, retrain if >200 corrections accumulate

---

## Critical Assumptions & Limitations

### What VERIDOC Does Well
- Extract structure from unstructured documents
- Provide explainable verdicts with sources
- Handle scanned/low-quality documents
- Learn from officer feedback over time
- Ensure no silent rejections

### What VERIDOC Requires
- At least 50+ representative CRPF tenders for LegalBERT fine-tuning
- A senior analyst to validate correction quality (prevents bias drift)
- Clear definitions of what "evidence quality" means for your context
- Officer training on how to use the system and provide corrections

### What VERIDOC Can't Do (Yet)
- Verify credentials against external databases (e.g., "is this GST number real?") — we flag these for manual lookup
- Detect completely new bid formats never seen before
- Audit whether a certificate/signature is actually valid (we read it, not verify it)
- Replace domain expertise (the final decision should always involve a human)

---

## Evaluation Criteria: How We Know It's Working

We'll measure success against these benchmarks:

| Metric | Target | Why |
|--------|--------|-----|
| **LegalBERT F1 on obligations** | ≥0.75 | Ensures we extract rules correctly |
| **Evidence mapper chain length** | 2–4 docs per criterion | Sweet spot: complete proof without noise |
| **Verdict accuracy** (vs. officer review) | ≥85% | Most verdicts don't need human review |
| **False positive rate on collusion** | ≤15% | Officers trust the flags |
| **Time per tender** (100 criteria, 10 bidders) | <2 hours | Faster than manual review |
| **Audit trail completeness** | 100% | Every decision is explainable |
| **Officer feedback incorporation** | 200+ corrections → retrain, F1 improvement ≥5% | System learns from corrections |

---

## Risk Mitigation

### Risk: "LegalBERT doesn't work on CRPF language"
**Mitigation**: Validate on hold-out tenders in Week 2. If F1 < 0.75, expand training set to 100+ documents before proceeding.

### Risk: "Officers don't trust the system"
**Mitigation**: Start with "advisory" mode (verdicts are suggestions, not decisions). Run parallel for 2–3 tenders. Show officers the PDF evidence and explanations side-by-side so they can audit reasoning.

### Risk: "Collusion detection flags are wrong"
**Mitigation**: Validate on real CRPF data (50+ past tenders). Only show flags above 85% precision. Always mark as "advisory — officer decides."

### Risk: "System improves with bias if officers are biased"
**Mitigation**: Monthly validation of corrections by a senior analyst. Bias dashboard tracks per-officer and per-bidder override rates. Alert if any spike >2x average.

### Risk: "Evidence mapper returns incomplete chains"
**Mitigation**: Test on 20 real scenarios in Phase 2. Fall back to "external evidence checklist" for criteria that require manual verification.

---

## Getting Started

### To Review This Project:
1. Read this README
2. Check the `architecture.html` for visual overview
3. Review the GitHub issues for implementation tasks

### To Contribute:
1. Pick a Phase 1 task (e.g., "multi-format document handler")
2. Create a branch: `feature/ocr-docx-handler`
3. Implement with tests
4. Open a PR with a clear description of what you built and how to test it

### To Deploy (Round 2):
1. Follow the `DEPLOYMENT.md` guide
2. Prepare your sandbox tender + sample bids
3. Configure CRPF-specific settings
4. Run the validation suite
5. Invite officers to try the UI

---

## Questions?

- **How does it handle Hindi/regional text?** PaddleOCR supports 109+ languages including all Indian scripts. LegalBERT fine-tuning on CRPF docs will learn domain-specific terminology.
- **What if a bidder doesn't provide evidence for a criterion?** The system will flag this and route to REVIEW, letting the officer decide if it's an automatic FAIL or needs additional info.
- **Can we use VERIDOC for other types of tenders (beyond CRPF)?** Yes, once trained. The architecture is generic; you'd fine-tune on your organization's tenders.
- **How long does evaluation take?** ~5–10 minutes for 100 criteria across 10 bidders (depending on document sizes and LLM latency). Faster than manual review.
- **Is the code open source?** This is a government-focused project. Licensing TBD pending CRPF approval.

---

## Team & Acknowledgments

**Built for**: Central Reserve Police Force (CRPF) Tender Evaluation Challenge

**Core Contributors**: Team Diamond

**Inspired by**: Government AI initiatives (Singapore iCAS, India's procurement modernization efforts)

---

**Last Updated**: May 2026 | **Version**: 1.0 Draft | **Status**: Ready for Round 2 Implementation
