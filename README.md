# VERIDOC

Tender evaluation is broken. Not in a "let's disrupt it" way - in a very specific, fixable way. The people doing it are smart and careful, but they're working with tools that weren't designed for the job. You have scanned PDFs, criteria buried in dense legalese, evidence scattered across a dozen exhibits, and a committee that has to get every call right because wrong calls get contested.

VERIDOC is our attempt at fixing the specific part that keeps going wrong: checking whether a bid actually satisfies what a tender requires, and being able to prove it.

---

## What's actually different here

Most AI tools for procurement are RAG wrappers. You upload the tender, upload the bids, it finds text that looks similar, it gives you a score. The problem is that tender eligibility isn't a similarity problem. "The bidder shall have a minimum annual turnover of ₹50 crore for each of the last three financial years, certified by a Chartered Accountant" contains four separate requirements - the amount, the frequency, the time window, and who attests it. Matching the word "turnover" in a PDF tells you exactly nothing about whether all four are present.

VERIDOC parses criteria into structured obligation nodes  typed by whether they're mandatory, conditional, or optional - and maps dependencies between them. Missing a GST registration doesn't just fail that one criterion; it propagates failure downstream to everything that depends on it. That's how it actually works legally, and it's what prevents contradictory verdicts.

Evidence is assembled across documents, not within one. A turnover figure in the bid letter gets traced back to the audited balance sheet, the statutory audit period, and the CA certificate. All four get cited together. The evaluator can see exactly which line in which exhibit each verdict rests on, highlighted in the original PDF.

When a bid fails, the system tells you specifically what would need to change - not "failed criterion 6.2" but "if the bidder submits audited accounts for FY2022–23 showing turnover above ₹50Cr with CA attestation, this criterion passes." That specificity matters because rejected bidders are entitled to it under GFR 2017 Rule 204, and it's what makes decisions defensible if challenged.

---

## The parts

```
veridoc/
├── ocr/                    PaddleOCR-VL ingestion, Hindi/regional support
├── obligations/            LegalBERT parser, deontic graph builder
├── evidence/               IndexRAG cross-document retrieval
├── verdict/                3-axis scoring, counterfactual generator
├── collusion/              CNN anomaly detection on bid pools
├── feedback/               Structured correction store, fine-tune pipeline
├── api/                    FastAPI backend
├── frontend/               React + PDF.js evaluator interface
└── scripts/                Eval scripts, dataset prep
```

---

## Getting started

You'll need Python 3.10+, Node 18+, and a PostgreSQL instance. Everything else gets installed below.

```bash
git clone https://github.com/team-diamond/veridoc
cd veridoc

# Python dependencies
pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..

# Environment - copy and fill in your keys
cp .env.example .env
```

The `.env.example` has comments explaining each variable. The only ones that aren't obvious are `ANTHROPIC_API_KEY` (for the verdict engine) and `PADDLE_OCR_DEVICE` (set to `cpu` if you don't have a GPU - slower but works).

```bash
# Run migrations
python manage.py migrate

# Start everything
docker-compose up
```

Frontend will be at `localhost:3000`, API at `localhost:8000`.

---

## Running an evaluation

The fastest way to see what it does is to run the demo scenario:

```bash
python scripts/demo.py --tender data/samples/crpf_equipment_tender.pdf \
                        --bids data/samples/bids/
```

This runs the sample CRPF tender against five mock bids - two clearly eligible, two clearly not, one borderline (has the turnover but the CA attestation covers only 2 of 3 required years). The borderline case is the interesting one. It's where RAG-based tools produce a false positive and VERIDOC catches the gap.

For your own tenders:

```bash
python veridoc/run.py --tender path/to/tender.pdf \
                      --bids path/to/bids/ \
                      --output results/
```

Results land in `results/` as a JSON verdict file and an HTML report with PDF source highlights.

---

## The scoring model

Each eligibility criterion gets evaluated on three axes:

| Axis | What it checks | Failure means |
|------|----------------|---------------|
| Evidence quality | Is the document legible, complete, correctly formatted? | Evidence is missing or unreadable |
| Semantic match | Does the evidence actually address this obligation? | Evidence exists but answers the wrong question |
| Threshold compliance | Does the value satisfy the stated threshold? | Evidence is correct but the number doesn't clear the bar |

Scores combine as a weighted product - not an average. If any axis scores zero, the criterion fails regardless of the other two. Criteria scoring 55–79% on any axis are automatically flagged for human review.

The overall bid verdict follows the obligation graph: failing a mandatory criterion = ineligible, conditional criteria only evaluated if their parent passes, optional criteria noted but not disqualifying.

---

## Collusion detection

This runs as a separate module, parallel to the compliance evaluation. It looks across all bids in a round for six patterns:

1. Identical unit rates across competing bids on the same line items (threshold: <0.5% difference)
2. Coordinated submission timestamps (bids filed within a few minutes of each other)
3. Shared registered address or contact data between ostensibly separate bidders
4. Cover bidding - bids that appear competitive but are structured to lose
5. Text similarity in technical proposals above 85%
6. Price clustering significantly above or below market rate

Anything that fires shows up on the evaluating officer's dashboard as a flag. Nothing gets blocked automatically. The officer decides what to do with it.

The underlying model is a CNN on bidder interaction graphs, based on the approach from García Rodríguez et al. (arXiv 2104.11142). Accuracy in documented OECD deployments is 81–95%.

---

## Active learning

The system is designed to get better as it's used. When an evaluator overrides a verdict, they see a structured correction form - not a comment box. They specify which axis was wrong, what the correct classification is, and point to the PDF span that supports it. That correction gets stored with the original model output and used for periodic fine-tuning.

We trigger a fine-tune run when the correction corpus accumulates 200 new examples. The threshold is configurable in `config/active_learning.yaml`.

The precedent for this approach: Singapore's Intelligent Court Assistance System went from 61% to 88% accuracy over 18 months using the same mechanism - structured reviewer corrections feeding back into the model continuously.

---

## Research this is built on

The architecture isn't arbitrary. A few papers shaped specific design decisions:

**Obligation parsing** - Chalkidis et al., "LEGAL-BERT" (EMNLP 2020, arXiv 2010.02559). Domain-adapted BERT on 12GB of legal text. Used for obligation type classification.

**Cross-document retrieval** - IndexRAG (arXiv 2603.16415). Builds bridging facts at index time rather than runtime, enabling single-pass retrieval across multi-exhibit bid packages. +4.6 F1 over naive RAG on standard multi-hop benchmarks.

**Counterfactual fairness** - Coston et al., FAT* 2020; Leben, Frontiers in Psychology 2023 (CMU). Counterfactual recourse as the legally meaningful form of explanation for adverse decisions.

**Collusion detection** - García Rodríguez et al. (arXiv 2104.11142). CNN-based bid rigging detection on procurement interaction graphs. Katona & Fazekas (2024) for text-based collusion signals in Hungarian tender data.

**Deontic parsing** - Stanford CodeX group (arXiv 2025). Segmenting normative regulatory text into atomic deontic rules before any retrieval step.

---

## What it doesn't do

A few things worth being clear about:

- VERIDOC doesn't make the final call. It produces verdicts and flags for human review. The evaluating officer signs off.
- The collusion module flags patterns, it doesn't investigate them. A flag means "this warrants a look," not "this is a cartel."
- The active learning loop requires consistent evaluator participation to work. If overrides are rare or haphazard, the model won't improve meaningfully.
- Current OCR quality on very degraded documents (badly photocopied, wet-damaged, low-contrast) still drops. PaddleOCR-VL handles most real-world conditions but it's not magic.

---

## Contributing

If you're adding a new anomaly detector to the collusion module, the interface is in `collusion/base.py`. Each detector is a class with a single `score(bid_pool) -> List[Flag]` method. Flags carry a severity (low/medium/high), the bid IDs involved, and a reason string.

For changes to the obligation parser or verdict engine, there's an eval suite in `tests/eval/`. Run it before submitting:

```bash
python -m pytest tests/eval/ -v
```

The eval suite uses 40 annotated tender-bid pairs from Indian public procurement. Pass rate required: 85% on clear cases, 70% on the borderline set.

---

## License

MIT. Use it, fork it, deploy it. If you end up using this in an actual procurement system and it saves someone weeks of committee meetings, we'd genuinely like to hear about it.
