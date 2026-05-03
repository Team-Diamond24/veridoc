"""
LAYER 2: Obligation Extraction
Reads the tender document text and extracts structured eligibility criteria.
Uses NLP pattern matching + spaCy to identify obligations, thresholds, and evidence types.
"""
import re
import logging
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# ─── Modal Language Patterns ──────────────────────────────────────────────────
MANDATORY_PATTERNS = [
    r'\b(must|shall|required|mandatory|essential|compulsory|prerequisite|necessary)\b',
    r'\b(should be|is required|are required|will be required)\b',
    r'\beligibility criterion\b',
    r'\bminimum requirement\b',
]

CONDITIONAL_PATTERNS = [
    r'\b(if applicable|where applicable|as applicable|subject to|conditional)\b',
    r'\b(if bidder|when applicable|in case of)\b',
]

OPTIONAL_PATTERNS = [
    r'\b(may|preferred|desirable|advantageous|optional|bonus|additional marks)\b',
]

# ─── Threshold Patterns ───────────────────────────────────────────────────────
FINANCIAL_PATTERNS = [
    r'(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)\s*(crore|lakh|thousand|cr\.?|lac)',
    r'(\d+(?:\.\d+)?)\s*(crore|lakh|thousand|cr\.?|lac)\s*(?:rupees?|inr|rs\.?)',
    r'minimum\s+(?:annual\s+)?turnover\s+(?:of\s+)?(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)',
]

YEAR_PATTERNS = [
    r'(?:last|past|preceding|previous)\s+(\d+)\s+(?:financial\s+)?years?',
    r'(\d+)\s+years?\s+(?:of\s+)?experience',
    r'at\s+least\s+(\d+)\s+(?:financial\s+)?years?',
]

COUNT_PATTERNS = [
    r'at\s+least\s+(\d+)\s+(?:similar\s+)?(?:projects?|works?|orders?|contracts?)',
    r'minimum\s+(\d+)\s+(?:similar\s+)?(?:projects?|works?|orders?|contracts?)',
    r'(\d+)\s+or\s+more\s+(?:similar\s+)?(?:projects?|works?)',
]

# ─── Evidence Type Patterns ───────────────────────────────────────────────────
EVIDENCE_PATTERNS = {
    "gst_certificate": r'\b(gst|gstin|goods\s+and\s+services\s+tax)\b',
    "pan_card": r'\b(pan|permanent\s+account\s+number)\b',
    "financial_statement": r'\b(balance\s+sheet|profit\s+and\s+loss|p&l|annual\s+report|audited\s+accounts?|ca\s+certificate|chartered\s+accountant)\b',
    "experience_certificate": r'\b(completion\s+certificate|work\s+order|experience\s+certificate|performance\s+certificate)\b',
    "iso_certificate": r'\b(iso\s*9001|iso\s*14001|iso\s*27001|iso\s+certified|iso\s+certification)\b',
    "registration_document": r'\b(registration\s+certificate|company\s+registration|incorporation|cin|llpin)\b',
    "msme_certificate": r'\b(msme|udyam|udyog\s+aadhar|small\s+enterprise)\b',
    "turnover_certificate": r'\b(turnover|annual\s+revenue|gross\s+receipts)\b',
    "emd_document": r'\b(emd|earnest\s+money|bid\s+security|bank\s+guarantee)\b',
    "affidavit": r'\b(affidavit|undertaking|declaration|self.?certification)\b',
}

# ─── Criterion Categories ─────────────────────────────────────────────────────
CRITERION_KEYWORDS = {
    "Financial Eligibility": [
        r'turnover', r'financial\s+capacity', r'net\s+worth', r'paid.up\s+capital',
        r'annual\s+revenue', r'solvency'
    ],
    "Technical Eligibility": [
        r'technical\s+(?:qualification|eligibility|experience|capacity)',
        r'similar\s+(?:work|project|order)', r'iso\s+certified', r'quality\s+management'
    ],
    "GST & Tax Compliance": [
        r'gst(?:in)?', r'goods\s+and\s+services\s+tax', r'tax\s+(?:registration|compliance)'
    ],
    "Registration & Legal": [
        r'registered\s+(?:with|under|firm)', r'incorporation', r'constitution',
        r'legal\s+entity', r'pan\s+card', r'debarred', r'blacklisted'
    ],
    "Experience & Credentials": [
        r'years?\s+of\s+experience', r'similar\s+projects?', r'past\s+performance',
        r'credential', r'track\s+record'
    ],
    "EMD & Security": [
        r'earnest\s+money', r'emd', r'bid\s+security', r'bank\s+guarantee',
        r'performance\s+(?:security|guarantee)'
    ],
    "Certification & Compliance": [
        r'iso\s+\d{4,5}', r'certification', r'compliance\s+(?:with|to)',
        r'msme|udyam', r'make\s+in\s+india'
    ],
}


def detect_modal(text: str) -> str:
    """Determine if a criterion is MANDATORY, CONDITIONAL, or OPTIONAL."""
    text_lower = text.lower()
    for pattern in MANDATORY_PATTERNS:
        if re.search(pattern, text_lower):
            return "MANDATORY"
    for pattern in CONDITIONAL_PATTERNS:
        if re.search(pattern, text_lower):
            return "CONDITIONAL"
    for pattern in OPTIONAL_PATTERNS:
        if re.search(pattern, text_lower):
            return "OPTIONAL"
    return "MANDATORY"  # Default to mandatory for tender criteria


def extract_threshold(text: str) -> Dict[str, Any]:
    """Extract numerical thresholds from criterion text."""
    text_lower = text.lower()

    # Financial thresholds
    for pattern in FINANCIAL_PATTERNS:
        match = re.search(pattern, text_lower)
        if match:
            groups = match.groups()
            value_str = groups[0] if groups[0] else groups[-1]
            unit_str = groups[1] if len(groups) > 1 else "crore"
            try:
                value = float(value_str)
                unit = unit_str.replace('cr.', 'crore').replace('lac', 'lakh')
                return {
                    "value": value,
                    "unit": unit,
                    "currency": "INR",
                    "type": "financial"
                }
            except (ValueError, IndexError):
                pass

    # Year thresholds
    for pattern in YEAR_PATTERNS:
        match = re.search(pattern, text_lower)
        if match:
            try:
                return {
                    "value": int(match.group(1)),
                    "unit": "years",
                    "currency": None,
                    "type": "temporal"
                }
            except (ValueError, IndexError):
                pass

    # Count thresholds (projects, works)
    for pattern in COUNT_PATTERNS:
        match = re.search(pattern, text_lower)
        if match:
            try:
                return {
                    "value": int(match.group(1)),
                    "unit": "projects",
                    "currency": None,
                    "type": "count"
                }
            except (ValueError, IndexError):
                pass

    return {"value": None, "unit": None, "currency": None, "type": None}


def extract_evidence_types(text: str) -> str:
    """Identify what type of evidence is required."""
    text_lower = text.lower()
    found_types = []
    for evidence_type, pattern in EVIDENCE_PATTERNS.items():
        if re.search(pattern, text_lower):
            found_types.append(evidence_type)
    return ", ".join(found_types) if found_types else "supporting_document"


def classify_criterion(text: str) -> str:
    """Classify criterion into category."""
    text_lower = text.lower()
    for category, patterns in CRITERION_KEYWORDS.items():
        for pattern in patterns:
            if re.search(pattern, text_lower):
                return category
    return "General Eligibility"


def split_into_criteria_blocks(text: str) -> List[str]:
    """
    Split full tender text into individual criterion blocks.
    Looks for numbered lists, bullet points, section headers.
    """
    # Clean text
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'\t', ' ', text)

    # Patterns that indicate a new criterion starts
    criterion_patterns = [
        # Numbered: "1.", "1)", "(1)", "i.", "a."
        r'(?:^|\n)\s*(?:\d{1,2}\.|\d{1,2}\)|\(\d{1,2}\)|[ivxlcdm]+\.|[a-z]\.)(?:\s+)',
        # Bullet points
        r'(?:^|\n)\s*(?:•|◦|▪|▸|→|-|–)\s+',
        # "Criterion X:" headers
        r'(?:^|\n)\s*(?:criterion|requirement|condition|clause)\s*\d*\s*[:.]',
    ]

    blocks = []
    # Try to split by numbered items first
    numbered_split = re.split(r'\n(?=\s*(?:\d{1,2}[.)]\s|[a-z][.)]\s|\([a-z0-9]+\)\s))', text)

    if len(numbered_split) > 2:
        blocks = [b.strip() for b in numbered_split if len(b.strip()) > 30]
    else:
        # Fall back to paragraph splitting
        paragraphs = re.split(r'\n{2,}', text)
        blocks = [p.strip() for p in paragraphs if len(p.strip()) > 30]

    # Filter: keep only blocks that look like eligibility criteria
    eligibility_keywords = [
        'must', 'shall', 'required', 'mandatory', 'turnover', 'experience',
        'registered', 'gst', 'pan', 'certificate', 'qualification', 'eligible',
        'bidder', 'applicant', 'firm', 'company', 'years', 'crore', 'lakh',
        'similar work', 'iso', 'compliance', 'emd', 'bank guarantee'
    ]
    filtered = []
    for block in blocks:
        block_lower = block.lower()
        if any(kw in block_lower for kw in eligibility_keywords):
            filtered.append(block)

    # If filtering removed too much, return original blocks
    return filtered if len(filtered) >= 2 else blocks[:20]


def extract_criteria_from_text(full_text: str, page_references: Optional[List[int]] = None) -> List[Dict[str, Any]]:
    """
    Main function: Extract all eligibility criteria from tender text.
    Returns list of structured criterion dicts.
    """
    if not full_text or len(full_text.strip()) < 50:
        return []

    # Split into candidate blocks
    blocks = split_into_criteria_blocks(full_text)

    criteria = []
    criterion_counter = 1

    for block in blocks:
        if len(block.strip()) < 20:
            continue

        # Clean up the block
        clean_block = re.sub(r'\s+', ' ', block).strip()
        clean_block = re.sub(r'^[\d\.\)\(a-z]+\s+', '', clean_block)  # Remove leading numbering

        # Extract components
        modal = detect_modal(clean_block)
        threshold = extract_threshold(clean_block)
        evidence_type = extract_evidence_types(clean_block)
        category = classify_criterion(clean_block)

        # Generate a concise name
        name = _generate_criterion_name(clean_block, category, criterion_counter)

        # Temporal info
        temporal = None
        for pattern in YEAR_PATTERNS:
            match = re.search(pattern, clean_block.lower())
            if match:
                temporal = {"period": int(match.group(1)), "unit": "years"}
                break

        criteria.append({
            "criterion_code": f"CRIT-{criterion_counter:03d}",
            "name": name,
            "description": clean_block[:500],
            "modal_type": modal,
            "threshold_value": threshold.get("value"),
            "threshold_unit": threshold.get("unit"),
            "threshold_currency": threshold.get("currency"),
            "temporal_period": temporal["period"] if temporal else None,
            "temporal_unit": temporal["unit"] if temporal else None,
            "evidence_type": evidence_type,
            "dependencies": [],
            "page_references": page_references or [1],
            "raw_text": clean_block[:1000],
        })
        criterion_counter += 1

    # Build dependency graph (simple: GST → GST Certificate → GST History chain)
    criteria = _build_dependency_graph(criteria)

    return criteria


def _generate_criterion_name(text: str, category: str, counter: int) -> str:
    """Generate a concise criterion name from the block text."""
    text_lower = text.lower()

    # Specific name patterns
    if re.search(r'turnover|annual\s+revenue', text_lower):
        threshold = extract_threshold(text)
        if threshold.get("value"):
            return f"Minimum Annual Turnover (₹{threshold['value']} {threshold.get('unit', 'crore')})"
        return "Minimum Annual Turnover"

    if re.search(r'gst(?:in)?', text_lower):
        return "GST Registration"

    if re.search(r'similar\s+work|similar\s+project', text_lower):
        threshold = extract_threshold(text)
        if threshold.get("value"):
            return f"Similar Work Experience ({int(threshold['value'])}+ projects)"
        return "Similar Work Experience"

    if re.search(r'years?\s+of\s+experience|experience\s+of\s+\d+\s+years?', text_lower):
        threshold = extract_threshold(text)
        if threshold.get("value"):
            return f"Minimum Experience ({int(threshold['value'])} years)"
        return "Minimum Experience"

    if re.search(r'iso\s*9001', text_lower):
        return "ISO 9001 Certification"

    if re.search(r'pan\b', text_lower):
        return "PAN Registration"

    if re.search(r'emd|earnest\s+money', text_lower):
        return "Earnest Money Deposit (EMD)"

    if re.search(r'bank\s+guarantee', text_lower):
        return "Bank Guarantee"

    if re.search(r'msme|udyam', text_lower):
        return "MSME Registration"

    if re.search(r'blacklist|debar', text_lower):
        return "Non-Debarment Declaration"

    if re.search(r'incorporation|registered\s+(?:firm|company)', text_lower):
        return "Company Registration"

    # Fallback: use category + counter
    return f"{category} Criterion {counter}"


def _build_dependency_graph(criteria: List[Dict]) -> List[Dict]:
    """Add simple dependency relationships between criteria."""
    # Example: If GST Registration exists, GST Certificate depends on it
    code_map = {c["criterion_code"]: c for c in criteria}
    names_lower = {c["criterion_code"]: c["name"].lower() for c in criteria}

    for crit in criteria:
        name_lower = crit["name"].lower()
        # GST History depends on GST Registration
        if "gst" in name_lower and "history" in name_lower:
            for code, name in names_lower.items():
                if "gst registration" in name and code != crit["criterion_code"]:
                    crit["dependencies"] = [code]
                    break

    return criteria
