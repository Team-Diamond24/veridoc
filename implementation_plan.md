# VERIDOC — Implementation Gap Analysis & Plan

A full audit of what exists in the current codebase versus what the full implementation checklist requires, plus a prioritized roadmap to close each gap.

---

## Current State Summary

| Phase | Area | Status | Completion |
|---|---|---|---|
| Phase 1 | Infrastructure & FastAPI | ✅ Done | ~90% |
| Phase 1 | Document Processing (OCR) | 🟡 Partial | ~60% |
| Phase 1 | LegalBERT Fine-Tuning | ❌ Not Started | 0% |
| Phase 1 | Obligation Graph (DAG) | 🟡 Partial | ~25% |
| Phase 2 | Evidence Mapper (IndexRAG) | 🟡 Partial | ~40% |
| Phase 2 | Verdict Engine (3-Axis) | ✅ Done | ~85% |
| Phase 2 | External Evidence Checklists | 🟡 Partial | ~50% |
| Phase 3 | React Frontend (Routing/UI) | ✅ Done | ~80% |
| Phase 3 | PDF Viewer + Bbox Overlays | ❌ Not Started | 0% |
| Phase 3 | Collusion Detection | 🟡 Partial | ~30% |
| Phase 3 | Audit Report PDF | ❌ Not Started | 0% |
| Phase 4 | Active Learning / Retraining | ❌ Not Started | 0% |
| Phase 4 | Bias Detection Dashboard | ❌ Not Started | 0% |
| Phase 4 | Docker / Deployment | ❌ Not Started | 0% |

**Overall estimated completion: ~40%**

---

## Open Questions

> [!IMPORTANT]
> **Do you have an Anthropic API key?**
> `layer4_verdict.py` checks for `ANTHROPIC_API_KEY` in the environment. Without it, Claude falls back to pure rule-based logic. The plan below assumes Claude is available for the verdict engine. Please confirm.

> [!IMPORTANT]
> **Do you have a GPU or access to a cloud GPU?**
> LegalBERT fine-tuning (~2–4 hours), sentence-transformers, and spaCy model downloads all require significant compute. If running only on CPU, training times will be 5–10× longer.

> [!WARNING]
> **SQLite vs PostgreSQL**
> The current `database.py` defaults to `sqlite:///./veridoc.db`. The checklist specifies PostgreSQL. For the current prototype this is fine, but concurrent officers or a production deployment will require migration to Postgres. This plan keeps SQLite for now.

---

## Proposed Changes — Prioritized by Phase

---

### 🔴 BLOCKER — Fix Immediately (Before Anything Else)

The backend logs already show this error:
```
PDF extraction error: No /Root object! — Is this really a PDF?
PyPDF2 extraction error: EOF marker not found
```
The test file uploaded was only **17 bytes** (a fake PDF). The OCR pipeline works correctly on real PDFs — this is not a code bug. However, the upload UI needs a **file-type and minimum-size validator** to prevent garbage files from reaching the backend.

#### [MODIFY] `frontend/src/pages/TenderUpload.jsx`
- Add client-side validation: reject files under 10KB and non-PDF MIME types
- Show a descriptive error toast before calling the API

#### [MODIFY] `backend/routers/tenders.py`
- Add server-side validation: check `file.content_type` is `application/pdf`
- Check that the uploaded file is at least 1KB; return HTTP 422 with a clear message if not

---

### Phase 1 Gaps

---

#### Gap 1A — OCR: Switch from pytesseract to PaddleOCR

**What exists:** `layer1_ocr.py` uses `pdfplumber` for typed PDFs and falls back to `pytesseract` for scanned pages.

**What the checklist requires:** PaddleOCR-VL-0.9B weights for higher-quality multilingual OCR (Hindi + English).

> [!NOTE]
> PaddleOCR is significantly more accurate on Indian government documents with mixed Hindi/English text. `pytesseract` can remain as the final fallback if PaddleOCR is unavailable.

#### [MODIFY] `backend/services/layer1_ocr.py`
- Add `_ocr_page_paddleocr()` function that wraps `paddleocr.PaddleOCR(use_angle_cls=True, lang='en')`
- Update `_ocr_page_image()` to try PaddleOCR first, then fall back to pytesseract

#### [NEW] `backend/services/setup_ocr.py`
- One-time script to download and cache PaddleOCR-VL-0.9B weights
- Run on first startup if weights are missing

---

#### Gap 1B — LegalBERT Fine-Tuning Pipeline

**What exists:** `layer2_obligations.py` uses handcrafted regex patterns to classify and extract criteria.

**What the checklist requires:** A fine-tuned LegalBERT model that achieves F1 ≥ 0.75 on held-out CRPF tenders.

> [!WARNING]
> This is the most significant technical gap. Until 40+ annotated CRPF tenders are collected and the model is trained, the Regex approach is the production path. Treat LegalBERT as a **parallel track** — the regex layer stays live while the model is being developed.

#### [NEW] `backend/ml/train_legalbert.py`
- HuggingFace `transformers` training script
- Input: JSON annotations `{"text": "...", "modal": "MANDATORY", "threshold_value": 5.0, ...}`
- Hyperparameters: LR=2e-5, batch=16, epochs=3, warmup=10%
- Saves fine-tuned checkpoint to `backend/ml/checkpoints/legalbert-crpf/`

#### [NEW] `backend/ml/annotate_format.json`
- Template schema for annotating tender documents for training

#### [MODIFY] `backend/services/layer2_obligations.py`
- Add `_legalbert_extract()` function that loads the checkpoint if it exists
- If checkpoint missing → fall back to current regex approach (no breaking change)
- Add `USE_LEGALBERT` env variable flag to toggle

---

#### Gap 1C — Obligation Graph (True DAG)

**What exists:** A hardcoded `_build_dependency_graph()` that only links "GST History → GST Registration".

**What the checklist requires:** A full DAG where failing one criterion auto-marks downstream criteria as "blocked".

#### [MODIFY] `backend/services/layer2_obligations.py`
- Replace `_build_dependency_graph()` with a proper topological sort using the `networkx` library
- Define dependency rules as a config dictionary (e.g., `ISO cert → Company Registration`, `Turnover cert → CA Certificate`)
- Store the full DAG in the `criteria.dependencies` JSON column as an ordered adjacency list

#### [MODIFY] `backend/routers/evaluation.py`
- After all verdicts are computed, walk the DAG and mark criteria as `"BLOCKED"` if a dependency FAILed
- Add `blocked_reason` field to the `Verdict` response schema

---

### Phase 2 Gaps

---

#### Gap 2A — Upgrade IndexRAG to Real Vector Embeddings

**What exists:** `layer3_evidence.py` uses TF-IDF cosine similarity and keyword overlap scoring.

**What the checklist requires:** FAISS vector store + IndicBERT or sentence-transformers embeddings.

> [!NOTE]
> `sentence-transformers==2.7.0` is already in `requirements.txt`. The infrastructure is half-done — we just need to wire it up.

#### [MODIFY] `backend/services/layer3_evidence.py`
- Add `embed_chunks()` using `sentence_transformers.SentenceTransformer('all-MiniLM-L6-v2')` (lightweight, fast)
- Build a FAISS `IndexFlatL2` at evaluation time over all bidder chunks
- Replace `compute_tfidf_similarity()` with FAISS ANN search
- Keep TF-IDF as a re-ranking step after FAISS retrieval (hybrid approach)
- Target: retrieval latency < 2s per criterion chain

#### [NEW] `backend/services/vector_store.py`
- Singleton class that manages the FAISS index lifecycle (build, query, reset)
- Supports adding new chunks incrementally as bidder docs are uploaded

---

#### Gap 2B — Collusion Detection (Full 6 Detectors)

**What exists:** Only 2 of 6 detectors: identical bid text overlap and similar financial values.

**What the checklist requires:** 6 detectors: price clustering, timing, address rotation, text similarity, pattern, relationships.

#### [MODIFY] `backend/services/layer4_verdict.py`
- Add `_detect_timing_anomaly()`: flag if 3+ bids submitted within 60 seconds of each other
- Add `_detect_address_rotation()`: extract address strings from chunks, flag near-duplicates across bidders
- Add `_detect_pattern_withdrawal()`: flag bidders who submit then withdraw across multiple tenders
- Combine all detector scores: `overall_risk = max(individual_scores)` — flag if ≥ 0.8
- All flags remain `"advisory": True`

---

### Phase 3 Gaps

---

#### Gap 3A — PDF Viewer with Bounding Box Overlays *(Highest User Value)*

**What exists:** Bounding box data is stored in `verdicts.pdf_highlights` JSON but never rendered in the UI.

**What the checklist requires:** A `PDF.js`-powered viewer that renders the uploaded document and overlays coloured bounding boxes (green/amber/red) that officers can click to see the verdict detail.

> [!IMPORTANT]
> This is the single feature that will most impress officers during the Phase 3 validation gate. It makes the AI's reasoning tangible and auditable. Prioritize this above collusion detection.

#### [NEW] `frontend/src/components/PdfViewer.jsx`
- Integrate `pdfjs-dist` npm package
- Render each PDF page onto an HTML Canvas
- Accept a `highlights` prop: `[{ page, bbox, verdict, criterion_name }]`
- Draw coloured rectangles over each bbox (`green` = PASS, `red` = FAIL, `amber` = REVIEW)
- `onClick` on a bbox → open a side-panel showing the full verdict reasoning

#### [MODIFY] `frontend/src/pages/BidderDetail.jsx`
- Replace the current static text section with `<PdfViewer>` component
- Pass `bidder.documents[0].url` and all verdict highlights as props

#### [MODIFY] `backend/routers/evaluation.py`
- Ensure `pdf_highlights` are returned correctly in the `VerdictOut` schema with normalized `bbox` coordinates

---

#### Gap 3B — Audit Report PDF Generation

**What exists:** `reportlab==4.2.0` is in `requirements.txt` but no report generation code exists.

**What the checklist requires:** A professional PDF report with cover page, executive summary, per-bidder verdict sections, evidence citations, and GFR 2017 compliance statement.

#### [NEW] `backend/services/report_generator.py`
- `generate_audit_report(tender_id, db)` function using ReportLab
- **Cover page:** Tender number, title, CRPF emblem placeholder, date, officer name
- **Executive Summary:** Stat table (total bidders, PASS/FAIL/REVIEW counts, override rate)
- **Per-bidder section:** Company name, overall decision badge, per-criterion verdict rows
- **Evidence Citations:** For each verdict, the top 2 evidence chunks with page references
- **GFR 2017 Compliance Statement:** Standard boilerplate text
- **Audit Trail:** All officer overrides with timestamps

#### [MODIFY] `backend/routers/reports.py`
- Wire `GET /api/report/{tender_id}` to `generate_audit_report()`
- Return as `application/pdf` blob response

---

#### Gap 3C — Bias Detection Dashboard

**What exists:** `GET /api/admin/bias-dashboard` is called by the frontend but the endpoint returns nothing.

**What the checklist requires:** A dashboard tracking per-officer and per-bidder override rates, flagging anomalies.

#### [MODIFY] `backend/routers/reports.py`
- Implement `GET /api/admin/bias-dashboard`
- Compute per-officer override rate; flag if any officer is > 2× the average
- Compute per-bidder-state pass rate; flag significant disparities

#### [MODIFY] `frontend/src/pages/AdminDashboard.jsx`
- Wire up the existing `getBiasReport()` API call
- Render officer override rate table with threshold warning badges
- Render bidder pass-rate bar chart grouped by state/category

---

### Phase 4 Gaps

---

#### Gap 4A — Correction Validation Gate

**What exists:** The `Correction` model and `corrections` table exist. The `Corrections.jsx` page exists in the frontend. But there is no approve/reject mechanism.

#### [MODIFY] `backend/routers/reports.py`
- Implement `POST /api/corrections/{id}/validate` — set `is_validated = True`
- Flag outlier corrections that contradict ≥80% of peer corrections for the same criterion type

#### [MODIFY] `frontend/src/pages/Corrections.jsx`
- Add "Validate" / "Reject" buttons per correction row
- Show an outlier warning badge on flagged corrections

---

#### Gap 4B — Active Learning Retraining Script

**What exists:** Nothing.

#### [NEW] `backend/ml/retrain_pipeline.py`
- Query all `corrections WHERE is_validated = True AND created_at > last_retrain_date`
- Build training dataset from correction data
- Fine-tune LegalBERT checkpoint (only runs when 200+ corrections accumulate)
- Evaluate F1 on held-out set — only deploy if F1 improves
- Log retraining run to `audit_log`

---

#### Gap 4C — Docker Compose + Deployment

**What exists:** No Docker files anywhere in the project.

#### [NEW] `Dockerfile.backend`
- Python 3.11-slim base, install requirements, expose port 8000

#### [NEW] `Dockerfile.frontend`
- Node 20-alpine, build Vite bundle, serve with `nginx`

#### [NEW] `docker-compose.yml`
- Services: `backend`, `frontend`, `db` (PostgreSQL)
- `uploads/` volume for persistent file storage
- `.env.example` with all required variables documented

---

## Verification Plan

### Automated Checks
```bash
# Backend health check
curl http://localhost:8000/api/health

# Run unit tests (after writing them)
cd backend && python -m pytest tests/ -v --cov=services --cov-report=term

# Frontend lint
cd frontend && npm run lint
```

### Manual Verification Gates

| Gate | Test | Target |
|---|---|---|
| Phase 1 OCR | Upload 1 real CRPF PDF (typed), check criteria are extracted | ≥ 5 meaningful criteria extracted |
| Phase 1 LegalBERT | Evaluate on 5 held-out annotated tenders | F1 ≥ 0.75 |
| Phase 2 Verdicts | 3 CRPF officers review 20 verdicts independently | ≥ 80% agreement |
| Phase 3 PDF Viewer | Open a bid, click a bbox | Correct verdict panel opens |
| Phase 3 Collusion | Test on 50 past tenders with known collusion labels | Precision ≥ 85% |
| Phase 4 E2E | 1 tender + 10 bids, full pipeline | Completes in < 2 hours |

---

## Recommended Execution Order

```
Week 1 (Now — Highest Impact):
  1. Fix upload validation (Blocker)            — 1 day
  2. Add FAISS/sentence-transformers to layer3  — 2 days
  3. Add PDF.js viewer with bbox overlays       — 3 days

Week 2:
  4. Build ReportLab audit report               — 2 days
  5. Complete Collusion Detection (4 detectors) — 2 days
  6. Wire Bias Detection Dashboard              — 1 day

Week 3:
  7. Collect + annotate CRPF tenders (stakeholder task)
  8. Write LegalBERT training script            — 2 days
  9. Add PaddleOCR integration                  — 2 days

Week 4+:
  10. Docker Compose setup                      — 1 day
  11. Correction validation gate UI             — 1 day
  12. Active Learning pipeline                  — 3 days
      (after 200+ corrections accumulate in prod)
```
