"""
LAYER 4: Verdict Engine
Evaluates evidence against each criterion using the 3-axis framework.
Produces PASS/FAIL/REVIEW verdicts with full reasoning and counterfactual guidance.
Uses Claude Sonnet 4 API if available, otherwise falls back to rule-based logic.
"""
import os
import re
import logging
import json
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

# ─── 3-Axis Thresholds ────────────────────────────────────────────────────────
PASS_THRESHOLD = 80.0   # All axes must be ≥ 80 to PASS
FAIL_VETO = 20.0        # Any axis < 20 → automatic FAIL
REVIEW_MIN = 50.0       # Axes in 50-79 range → REVIEW


def compute_axis1_evidence_quality(
    chain: List[Dict],
    avg_ocr_confidence: float,
    chain_completeness: float,
) -> float:
    """
    Axis 1: Evidence Quality (0–100)
    Measures: OCR legibility, document completeness, structure quality.
    """
    if not chain:
        return 10.0  # Nearly no evidence

    score = 0.0

    # OCR confidence (40%)
    ocr_score = avg_ocr_confidence * 100
    score += ocr_score * 0.40

    # Chain completeness (35%)
    score += chain_completeness * 100 * 0.35

    # Document count quality (25%) — sweet spot is 2–4 docs
    doc_count = len(chain)
    if doc_count == 0:
        doc_quality = 0
    elif doc_count == 1:
        doc_quality = 50
    elif 2 <= doc_count <= 4:
        doc_quality = 100
    else:
        doc_quality = 80  # More docs is OK but a bit noisy

    score += doc_quality * 0.25

    return round(min(score, 100.0), 1)


def compute_axis2_semantic_match(
    criterion: Dict,
    chain: List[Dict],
    chain_confidence: float,
) -> float:
    """
    Axis 2: Semantic Match (0–100)
    Measures: Does the evidence actually address the criterion?
    """
    if not chain:
        return 5.0

    criterion_text = (criterion.get("description", "") + " " + criterion.get("name", "")).lower()
    evidence_type = criterion.get("evidence_type", "").lower()

    # Base score from chain confidence
    base = chain_confidence * 100

    # Boost if evidence type keywords match the chain content
    boost = 0.0
    for step in chain:
        step_text = step["text"].lower()
        # Check if evidence type description appears in chunk
        ev_words = re.findall(r'\b\w{4,}\b', evidence_type)
        for word in ev_words:
            if word in step_text:
                boost += 5
        boost = min(boost, 20)

    # Penalty if chain has very low individual confidences
    low_conf_steps = sum(1 for s in chain if s["confidence"] < 0.3)
    penalty = low_conf_steps * 10

    score = base + boost - penalty
    return round(min(max(score, 0.0), 100.0), 1)


def compute_axis3_threshold_compliance(
    criterion: Dict,
    values_found: Dict,
) -> float:
    """
    Axis 3: Threshold Compliance (0–100)
    Measures: Does the bidder's value meet the threshold requirement?
    """
    threshold_value = criterion.get("threshold_value")
    threshold_unit = criterion.get("threshold_unit", "")

    # No threshold specified — compliance is binary (evidence present or not)
    if threshold_value is None:
        return 90.0 if values_found else 40.0

    # Financial threshold check
    if "crore" in str(threshold_unit).lower() or "lakh" in str(threshold_unit).lower():
        bidder_value = values_found.get("financial_value_crore")
        if bidder_value is None:
            return 20.0  # No value found — cannot verify

        # Normalize threshold to crore
        req_value = threshold_value
        if "lakh" in str(threshold_unit).lower():
            req_value = threshold_value / 100

        if bidder_value >= req_value:
            # Exceeds threshold — how much?
            ratio = bidder_value / req_value
            if ratio >= 2.0:
                return 100.0
            elif ratio >= 1.5:
                return 95.0
            else:
                return 88.0
        elif bidder_value >= req_value * 0.9:
            return 45.0  # Close but below threshold → REVIEW
        elif bidder_value >= req_value * 0.7:
            return 25.0  # Significantly below → borderline FAIL
        else:
            return 5.0  # Far below → FAIL

    # Year/experience threshold check
    if "year" in str(threshold_unit).lower():
        year_span = values_found.get("year_span")
        if year_span is None:
            return 20.0  # Cannot verify
        if year_span >= threshold_value:
            return 95.0
        elif year_span >= threshold_value * 0.8:
            return 50.0
        else:
            return 15.0

    # Project count threshold
    if "project" in str(threshold_unit).lower():
        count = values_found.get("project_count")
        if count is None:
            return 20.0
        if count >= threshold_value:
            return 95.0
        elif count >= threshold_value * 0.7:
            return 45.0
        else:
            return 10.0

    return 70.0  # Default if we can't precisely verify


def make_verdict_decision(ax1: float, ax2: float, ax3: float) -> str:
    """
    The 3-axis decision tree.
    PASS: All ≥ 80
    FAIL: Any < 20 (veto)
    REVIEW: Borderline (any in 50–79, or mixed signals)
    """
    # Veto rule
    if ax1 < FAIL_VETO or ax2 < FAIL_VETO or ax3 < FAIL_VETO:
        return "FAIL"

    # Pass rule
    if ax1 >= PASS_THRESHOLD and ax2 >= PASS_THRESHOLD and ax3 >= PASS_THRESHOLD:
        return "PASS"

    # REVIEW: any axis in the uncertain zone
    if any(REVIEW_MIN <= ax < PASS_THRESHOLD for ax in [ax1, ax2, ax3]):
        return "REVIEW"

    # All in moderate zone (20–49) → FAIL
    return "FAIL"


def generate_reasoning(
    criterion: Dict,
    ax1: float,
    ax2: float,
    ax3: float,
    verdict: str,
    chain: List[Dict],
    values_found: Dict,
) -> str:
    """Generate human-readable reasoning for the verdict."""
    name = criterion.get("name", "criterion")
    threshold_value = criterion.get("threshold_value")
    threshold_unit = criterion.get("threshold_unit", "")
    threshold_currency = criterion.get("threshold_currency", "")

    parts = []

    # Verdict headline
    if verdict == "PASS":
        parts.append(f"✓ {name}: Bidder meets this requirement.")
    elif verdict == "FAIL":
        parts.append(f"✗ {name}: Bidder does not meet this requirement.")
    else:
        parts.append(f"⚠ {name}: Requires officer review — evidence is inconclusive.")

    # Axis-by-axis explanation
    parts.append(f"\nAxis 1 — Evidence Quality: {ax1:.0f}/100")
    if ax1 >= 80:
        parts.append("  → Documents are legible, complete, and well-structured.")
    elif ax1 >= 50:
        parts.append("  → Documents are readable but have some quality issues (partial pages, low OCR confidence).")
    elif ax1 >= 20:
        parts.append("  → Documents have significant quality issues. Manual review of originals recommended.")
    else:
        parts.append("  → Documents are unreadable or incomplete. Automatic veto applied.")

    parts.append(f"\nAxis 2 — Semantic Match: {ax2:.0f}/100")
    if ax2 >= 80:
        parts.append("  → Evidence clearly addresses this criterion (correct document type submitted).")
    elif ax2 >= 50:
        parts.append("  → Evidence partially addresses this criterion. Some relevant documents found.")
    elif ax2 >= 20:
        parts.append("  → Evidence only tangentially related to criterion requirement.")
    else:
        parts.append("  → Evidence does not address this criterion. Wrong document type or missing.")

    parts.append(f"\nAxis 3 — Threshold Compliance: {ax3:.0f}/100")
    if threshold_value and values_found:
        bidder_val = values_found.get("financial_value_crore")
        if bidder_val is not None:
            currency_sym = "₹" if threshold_currency == "INR" else ""
            parts.append(
                f"  → Bidder value: {currency_sym}{bidder_val:.1f} Crore | "
                f"Required: {currency_sym}{threshold_value} {threshold_unit}"
            )
    if ax3 >= 80:
        parts.append("  → Threshold requirement met or exceeded.")
    elif ax3 >= 50:
        parts.append("  → Threshold is borderline — close to required value but not confirmed.")
    elif ax3 >= 20:
        parts.append("  → Threshold requirement appears not met based on available evidence.")
    else:
        parts.append("  → No numerical evidence found to verify threshold compliance.")

    # Evidence summary
    if chain:
        parts.append(f"\nEvidence Sources ({len(chain)} document(s) reviewed):")
        for step in chain[:3]:
            parts.append(f"  • {step['source']} — \"{step['text'][:100]}...\"")

    return "\n".join(parts)


def generate_counterfactual(
    criterion: Dict,
    verdict: str,
    ax1: float,
    ax2: float,
    ax3: float,
    values_found: Dict,
) -> Optional[str]:
    """Generate GFR 2017-compliant counterfactual guidance for FAIL/REVIEW verdicts."""
    if verdict == "PASS":
        return None

    name = criterion.get("name", "this criterion")
    evidence_type = criterion.get("evidence_type", "the required document")
    threshold_value = criterion.get("threshold_value")
    threshold_unit = criterion.get("threshold_unit", "")
    threshold_currency = criterion.get("threshold_currency", "")

    parts = ["To satisfy this criterion, the bidder should submit:"]

    if ax1 < REVIEW_MIN:
        parts.append(
            f"  1. Clearly legible, complete documents for '{name}'. "
            "Ensure all pages are included and scanned at minimum 300 DPI."
        )

    if ax2 < REVIEW_MIN:
        evidence_label = evidence_type.replace("_", " ").title()
        parts.append(
            f"  2. The correct document type: {evidence_label}. "
            "Ensure the document explicitly addresses the stated requirement."
        )

    if ax3 < REVIEW_MIN:
        if threshold_value:
            currency_sym = "₹" if threshold_currency == "INR" else ""
            parts.append(
                f"  3. Proof that the {threshold_unit} meets the minimum requirement of "
                f"{currency_sym}{threshold_value} {threshold_unit}. "
                "This must be attested by a Chartered Accountant (CA) for financial criteria."
            )
        else:
            parts.append(
                f"  3. Clear documentary evidence showing compliance with '{name}'."
            )

    parts.append("\n[Reference: GFR 2017 Rule 204 — Right to Recourse]")
    return "\n".join(parts)


def evaluate_verdict_rule_based(
    criterion: Dict,
    evidence_result: Dict,
) -> Dict[str, Any]:
    """
    Core rule-based verdict evaluation.
    Used when Claude API is not available.
    """
    chain = evidence_result.get("evidence_chain", [])
    chain_confidence = evidence_result.get("chain_confidence", 0.0)
    chain_completeness = evidence_result.get("chain_completeness", 0.0)
    values_found = evidence_result.get("values_found", {})

    # Average OCR confidence from chain
    ocr_confs = [s.get("confidence", 0.9) for s in chain]
    avg_ocr = sum(ocr_confs) / len(ocr_confs) if ocr_confs else 0.0

    # Compute 3 axes
    ax1 = compute_axis1_evidence_quality(chain, avg_ocr, chain_completeness)
    ax2 = compute_axis2_semantic_match(criterion, chain, chain_confidence)
    ax3 = compute_axis3_threshold_compliance(criterion, values_found)

    verdict = make_verdict_decision(ax1, ax2, ax3)
    reasoning = generate_reasoning(criterion, ax1, ax2, ax3, verdict, chain, values_found)
    counterfactual = generate_counterfactual(criterion, verdict, ax1, ax2, ax3, values_found)

    # PDF highlights from top chain evidence
    highlights = [
        {"page": step["page"], "bbox": step["bbox"]}
        for step in chain[:3]
        if step.get("bbox")
    ]

    # Overall confidence
    confidence = round((ax1 + ax2 + ax3) / 300, 3)

    return {
        "axis_evidence_quality": ax1,
        "axis_semantic_match": ax2,
        "axis_threshold_compliance": ax3,
        "verdict": verdict,
        "reasoning": reasoning,
        "evidence_chain": chain,
        "pdf_highlights": highlights,
        "counterfactual": counterfactual,
        "confidence": confidence,
    }


async def evaluate_verdict_with_claude(
    criterion: Dict,
    evidence_result: Dict,
) -> Dict[str, Any]:
    """
    Enhanced verdict using Claude Sonnet 4 API.
    Falls back to rule-based if API not available.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return evaluate_verdict_rule_based(criterion, evidence_result)

    try:
        import anthropic

        # First compute rule-based axes for structure
        rule_result = evaluate_verdict_rule_based(criterion, evidence_result)

        chain = evidence_result.get("evidence_chain", [])
        evidence_summary = "\n".join(
            f"- Step {s['step']}: [{s['source']}] {s['text'][:200]}"
            for s in chain[:4]
        )

        prompt = f"""You are VERIDOC, an AI system for evaluating government tender bid eligibility.

CRITERION:
Name: {criterion.get('name')}
Description: {criterion.get('description', '')[:300]}
Modal Type: {criterion.get('modal_type', 'MANDATORY')}
Required Evidence: {criterion.get('evidence_type', 'N/A')}
Threshold: {criterion.get('threshold_value')} {criterion.get('threshold_unit', '')} {criterion.get('threshold_currency', '')}

EVIDENCE FOUND:
{evidence_summary if evidence_summary else "No relevant evidence found in bidder documents."}

PRE-COMPUTED SCORES (your analysis should validate or refine these):
- Axis 1 (Evidence Quality): {rule_result['axis_evidence_quality']}/100
- Axis 2 (Semantic Match): {rule_result['axis_semantic_match']}/100
- Axis 3 (Threshold Compliance): {rule_result['axis_threshold_compliance']}/100

Based on this, provide:
1. A refined verdict: PASS, FAIL, or REVIEW
2. Clear reasoning in 2-3 sentences
3. Counterfactual guidance if not PASS (what the bidder should submit to pass)

Respond in JSON format:
{{
  "verdict": "PASS|FAIL|REVIEW",
  "reasoning": "...",
  "counterfactual": "..." or null
}}"""

        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text
        # Parse JSON from response
        json_match = re.search(r'\{.*?\}', response_text, re.DOTALL)
        if json_match:
            claude_result = json.loads(json_match.group())
            rule_result["verdict"] = claude_result.get("verdict", rule_result["verdict"])
            if claude_result.get("reasoning"):
                rule_result["reasoning"] = claude_result["reasoning"]
            if claude_result.get("counterfactual"):
                rule_result["counterfactual"] = claude_result["counterfactual"]

        return rule_result

    except Exception as e:
        logger.warning(f"Claude API error, falling back to rule-based: {e}")
        return evaluate_verdict_rule_based(criterion, evidence_result)


def detect_collusion_flags(
    all_bidder_verdicts: Dict[str, List[Dict]],
    all_bidder_chunks: Dict[str, List[Dict]],
) -> List[Dict[str, Any]]:
    """
    Collusion detection: Check for suspicious patterns across bidders.
    Returns list of flags with descriptions.
    """
    flags = []

    # Flag 1: Identical or near-identical bid text
    bidder_texts = {}
    for bidder_id, chunks in all_bidder_chunks.items():
        combined = " ".join(c.get("text", "")[:100] for c in chunks[:5])
        bidder_texts[bidder_id] = combined.lower()

    bidder_ids = list(bidder_texts.keys())
    for i in range(len(bidder_ids)):
        for j in range(i + 1, len(bidder_ids)):
            b1, b2 = bidder_ids[i], bidder_ids[j]
            text1, text2 = bidder_texts[b1], bidder_texts[b2]
            if not text1 or not text2:
                continue

            # Simple overlap check
            words1 = set(text1.split())
            words2 = set(text2.split())
            if len(words1) < 10 or len(words2) < 10:
                continue
            overlap = len(words1 & words2) / min(len(words1), len(words2))

            if overlap > 0.85:
                flags.append({
                    "flag_type": "identical_bid_text",
                    "severity": "HIGH",
                    "bidders": [b1, b2],
                    "description": f"Bidders {b1} and {b2} have {overlap:.0%} identical bid text. Possible collusion or template sharing.",
                    "advisory": True,
                })

    # Flag 2: Suspiciously similar financial values
    bidder_financials = {}
    for bidder_id, chunks in all_bidder_chunks.items():
        from services.layer3_evidence import extract_values_from_text
        for chunk in chunks:
            vals = extract_values_from_text(chunk.get("text", ""))
            if vals.get("financial_value_crore"):
                bidder_financials[bidder_id] = vals["financial_value_crore"]
                break

    financial_values = list(bidder_financials.values())
    if len(financial_values) >= 2:
        unique_values = set(financial_values)
        if len(unique_values) < len(financial_values) * 0.5:
            flags.append({
                "flag_type": "similar_financial_values",
                "severity": "MEDIUM",
                "bidders": list(bidder_financials.keys()),
                "description": "Multiple bidders report suspiciously similar financial values. Verify independently.",
                "advisory": True,
            })

    return flags
