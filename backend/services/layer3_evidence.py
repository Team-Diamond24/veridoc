"""
LAYER 3: Evidence Mapping (IndexRAG)
Finds and chains together relevant evidence from bidder documents for each criterion.
Uses TF-IDF + semantic similarity to build multi-hop evidence chains.
"""
import re
import math
import logging
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

logger = logging.getLogger(__name__)

# ─── Evidence Category Keywords ────────────────────────────────────────────────
EVIDENCE_KEYWORDS = {
    "financial": [
        "turnover", "revenue", "profit", "loss", "balance sheet",
        "annual accounts", "financial statement", "p&l", "income",
        "crore", "lakh", "ca certificate", "auditor", "chartered accountant",
    ],
    "gst": [
        "gst", "gstin", "goods and services tax", "gst registration",
        "gst certificate", "gst number",
    ],
    "pan": ["pan", "permanent account number", "pan card"],
    "experience": [
        "similar work", "experience", "completed", "executed", "project",
        "work order", "completion certificate", "performance certificate",
        "contract", "order copy",
    ],
    "iso": ["iso 9001", "iso 14001", "iso certified", "iso certificate", "quality management"],
    "registration": [
        "registered", "registration", "incorporation", "company", "firm",
        "cin", "certificate of incorporation",
    ],
    "msme": ["msme", "udyam", "udyog aadhar", "small enterprise"],
    "emd": ["emd", "earnest money", "bid security", "bank guarantee"],
    "declaration": ["affidavit", "declaration", "undertaking", "self-certification", "debarred"],
}

# ─── External Evidence Flags ────────────────────────────────────────────────────
EXTERNAL_EVIDENCE_TYPES = {
    "blacklist_check": "Verify non-debarment on CPPP / CVC portal",
    "gst_verification": "Verify GST number on GST portal (gstin.gov.in)",
    "pan_verification": "Verify PAN on Income Tax portal",
    "msme_verification": "Verify MSME/Udyam registration on udyamregistration.gov.in",
    "iso_verification": "Verify ISO certificate validity with certification body",
}


def simple_tokenize(text: str) -> List[str]:
    """Simple tokenizer — lowercase words only."""
    return re.findall(r'\b[a-z]{2,}\b', text.lower())


def compute_tfidf_similarity(query_tokens: List[str], doc_tokens: List[str]) -> float:
    """Simple TF-IDF cosine similarity between two token lists."""
    if not query_tokens or not doc_tokens:
        return 0.0

    # Build term frequency dicts
    def tf(tokens):
        freq = defaultdict(int)
        for t in tokens:
            freq[t] += 1
        total = len(tokens)
        return {t: c / total for t, c in freq.items()}

    q_tf = tf(query_tokens)
    d_tf = tf(doc_tokens)

    # All unique terms
    all_terms = set(q_tf.keys()) | set(d_tf.keys())

    # Simple dot product (no IDF for efficiency; works well on small corpora)
    dot = sum(q_tf.get(t, 0) * d_tf.get(t, 0) for t in all_terms)
    norm_q = math.sqrt(sum(v ** 2 for v in q_tf.values()))
    norm_d = math.sqrt(sum(v ** 2 for v in d_tf.values()))

    if norm_q == 0 or norm_d == 0:
        return 0.0
    return round(dot / (norm_q * norm_d), 4)


def keyword_overlap_score(criterion_text: str, chunk_text: str, evidence_type: str) -> float:
    """Score based on keyword overlap specific to the evidence type."""
    chunk_lower = chunk_text.lower()
    crit_lower = criterion_text.lower()
    score = 0.0

    # Check evidence-specific keywords
    for ev_cat, keywords in EVIDENCE_KEYWORDS.items():
        if ev_cat in evidence_type.lower() or any(kw in crit_lower for kw in keywords[:3]):
            hits = sum(1 for kw in keywords if kw in chunk_lower)
            if hits > 0:
                score += min(hits / len(keywords) * 1.5, 1.0)

    # General criterion-chunk overlap
    crit_words = set(simple_tokenize(crit_lower)) - {"the", "and", "or", "of", "in", "to", "a", "is"}
    chunk_words = set(simple_tokenize(chunk_lower))
    if crit_words:
        overlap = len(crit_words & chunk_words) / len(crit_words)
        score += overlap

    return min(round(score, 4), 1.0)


def extract_values_from_text(text: str) -> Dict[str, Any]:
    """Extract financial values, years, and counts from chunk text."""
    text_lower = text.lower()
    extracted = {}

    # Financial values
    fin_patterns = [
        r'(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)\s*(crore|lakh|cr\.?)',
        r'(\d+(?:\.\d+)?)\s*(crore|lakh|cr\.?)\s*(?:rupees?|inr|rs\.?)',
        r'turnover\s+(?:of\s+)?(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(crore|lakh)?',
    ]
    for pattern in fin_patterns:
        match = re.search(pattern, text_lower)
        if match:
            try:
                groups = [g for g in match.groups() if g is not None]
                value = float(groups[0])
                unit = groups[1] if len(groups) > 1 else "crore"
                # Normalize to crore
                if "lakh" in str(unit):
                    value = value / 100
                extracted["financial_value_crore"] = value
                break
            except (ValueError, IndexError):
                pass

    # Year counts
    year_match = re.search(r'(\d{4})\s*[-–to]+\s*(\d{4})', text_lower)
    if year_match:
        try:
            extracted["year_from"] = int(year_match.group(1))
            extracted["year_to"] = int(year_match.group(2))
            extracted["year_span"] = int(year_match.group(2)) - int(year_match.group(1))
        except ValueError:
            pass

    # Project counts
    count_match = re.search(r'(\d+)\s+(?:similar\s+)?(?:projects?|works?|contracts?|orders?)', text_lower)
    if count_match:
        try:
            extracted["project_count"] = int(count_match.group(1))
        except ValueError:
            pass

    return extracted


def build_evidence_chain(
    criterion: Dict[str, Any],
    chunks: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    IndexRAG: Find and chain evidence for a single criterion across bidder chunks.
    Returns an evidence chain with completeness and confidence scores.
    """
    criterion_text = criterion.get("description", "") + " " + criterion.get("name", "")
    evidence_type = criterion.get("evidence_type", "supporting_document")
    threshold = {
        "value": criterion.get("threshold_value"),
        "unit": criterion.get("threshold_unit"),
        "currency": criterion.get("threshold_currency"),
    }

    if not chunks:
        return {
            "evidence_chain": [],
            "chain_completeness": 0.0,
            "chain_confidence": 0.0,
            "values_found": {},
            "is_external_evidence": False,
            "external_checklist": [],
        }

    # ── Score all chunks ────────────────────────────────────────────────────────
    scored_chunks = []
    q_tokens = simple_tokenize(criterion_text)

    for chunk in chunks:
        if len(chunk.get("text", "").strip()) < 10:
            continue

        chunk_tokens = simple_tokenize(chunk["text"])
        tfidf_score = compute_tfidf_similarity(q_tokens, chunk_tokens)
        keyword_score = keyword_overlap_score(criterion_text, chunk["text"], evidence_type)

        # Combined relevance score
        relevance = round((tfidf_score * 0.4 + keyword_score * 0.6), 4)

        if relevance > 0.05:  # Minimum threshold to avoid noise
            scored_chunks.append({
                "chunk": chunk,
                "relevance": relevance,
                "values": extract_values_from_text(chunk["text"]),
            })

    # Sort by relevance
    scored_chunks.sort(key=lambda x: x["relevance"], reverse=True)

    # ── Multi-hop chaining: top 2–4 chunks ─────────────────────────────────────
    chain_candidates = scored_chunks[:6]
    final_chain = []

    # Step 1: Primary evidence (highest relevance)
    if chain_candidates:
        primary = chain_candidates[0]
        final_chain.append({
            "step": 1,
            "role": "primary_claim",
            "text": primary["chunk"]["text"][:300],
            "source": primary["chunk"].get("source_label", "Document"),
            "page": primary["chunk"].get("page", 1),
            "bbox": primary["chunk"].get("bbox", [0, 0, 600, 800]),
            "confidence": min(primary["relevance"] * primary["chunk"].get("ocr_confidence", 0.9), 1.0),
            "values_found": primary["values"],
        })

    # Step 2: Supporting evidence (different page/section)
    for sc in chain_candidates[1:4]:
        chunk = sc["chunk"]
        # Avoid duplicate pages in chain
        chain_pages = {e["page"] for e in final_chain}
        if chunk.get("page", 1) not in chain_pages or len(final_chain) < 2:
            role = _determine_role(chunk["text"], criterion_text, evidence_type, len(final_chain))
            final_chain.append({
                "step": len(final_chain) + 1,
                "role": role,
                "text": chunk["text"][:300],
                "source": chunk.get("source_label", "Document"),
                "page": chunk.get("page", 1),
                "bbox": chunk.get("bbox", [0, 0, 600, 800]),
                "confidence": min(sc["relevance"] * chunk.get("ocr_confidence", 0.9), 1.0),
                "values_found": sc["values"],
            })
            if len(final_chain) >= 4:
                break

    # ── Collect all values found ───────────────────────────────────────────────
    all_values = {}
    for step in final_chain:
        all_values.update(step.get("values_found", {}))

    # ── Check for external evidence requirements ────────────────────────────────
    is_external, external_checklist = _check_external_evidence(criterion_text, evidence_type)

    # ── Compute chain scores ───────────────────────────────────────────────────
    if final_chain:
        confidences = [step["confidence"] for step in final_chain]
        chain_confidence = round(sum(confidences) / len(confidences), 3)
        chain_completeness = _compute_completeness(final_chain, criterion, all_values)
    else:
        chain_confidence = 0.0
        chain_completeness = 0.0

    return {
        "evidence_chain": final_chain,
        "chain_completeness": chain_completeness,
        "chain_confidence": chain_confidence,
        "values_found": all_values,
        "is_external_evidence": is_external,
        "external_checklist": external_checklist,
    }


def _determine_role(chunk_text: str, criterion_text: str, evidence_type: str, step_num: int) -> str:
    """Determine the role of a chunk in the evidence chain."""
    text_lower = chunk_text.lower()
    roles = {
        "auditor": "auditor_certificate",
        "chartered accountant": "auditor_certificate",
        "ca certificate": "auditor_certificate",
        "verified": "verification_document",
        "certified": "certification_document",
        "certificate": "supporting_certificate",
        "completion": "completion_certificate",
        "work order": "work_order",
        "performance": "performance_certificate",
    }
    for keyword, role in roles.items():
        if keyword in text_lower:
            return role
    return f"supporting_evidence_{step_num}"


def _check_external_evidence(criterion_text: str, evidence_type: str) -> Tuple[bool, List[str]]:
    """Determine if criterion requires external verification."""
    text_lower = (criterion_text + " " + evidence_type).lower()
    checklist = []

    if re.search(r'debarred|blacklist|banned', text_lower):
        checklist.append(EXTERNAL_EVIDENCE_TYPES["blacklist_check"])
    if re.search(r'gst(?:in)?', text_lower):
        checklist.append(EXTERNAL_EVIDENCE_TYPES["gst_verification"])
    if re.search(r'\bpan\b', text_lower):
        checklist.append(EXTERNAL_EVIDENCE_TYPES["pan_verification"])
    if re.search(r'msme|udyam', text_lower):
        checklist.append(EXTERNAL_EVIDENCE_TYPES["msme_verification"])
    if re.search(r'iso\s*\d{4}', text_lower):
        checklist.append(EXTERNAL_EVIDENCE_TYPES["iso_verification"])

    return len(checklist) > 0, checklist


def _compute_completeness(
    chain: List[Dict],
    criterion: Dict,
    values_found: Dict,
) -> float:
    """Compute how complete the evidence chain is for the criterion."""
    score = 0.0
    max_score = 0.0

    # Check 1: Primary evidence exists
    max_score += 0.3
    if chain:
        score += 0.3

    # Check 2: Multiple supporting docs (2+ links)
    max_score += 0.2
    if len(chain) >= 2:
        score += 0.2

    # Check 3: Financial value found (if threshold exists)
    if criterion.get("threshold_value"):
        max_score += 0.3
        if values_found.get("financial_value_crore") is not None:
            score += 0.3

    # Check 4: OCR quality (avg confidence of chain)
    max_score += 0.2
    if chain:
        avg_conf = sum(s["confidence"] for s in chain) / len(chain)
        score += 0.2 * avg_conf

    return round(score / max_score, 3) if max_score > 0 else 0.0


def map_all_evidence(
    criteria: List[Dict[str, Any]],
    all_chunks: List[Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    """
    Map evidence for all criteria using all bidder chunks.
    Returns dict: criterion_id → evidence mapping result.
    """
    results = {}
    for criterion in criteria:
        crit_id = criterion.get("criterion_code", str(criterion.get("id", "?")))
        try:
            result = build_evidence_chain(criterion, all_chunks)
            results[crit_id] = result
        except Exception as e:
            logger.error(f"Evidence mapping error for {crit_id}: {e}")
            results[crit_id] = {
                "evidence_chain": [],
                "chain_completeness": 0.0,
                "chain_confidence": 0.0,
                "values_found": {},
                "is_external_evidence": False,
                "external_checklist": [],
            }
    return results
