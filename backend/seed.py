"""
VERIDOC — Database Seeder
Populates the database with realistic, correlated dummy data.
Only runs if the database is empty (no tenders exist).
"""
from datetime import datetime, timedelta
from database import SessionLocal, Tender, Criterion, Bidder, Verdict, Correction, AuditLog
import logging

logger = logging.getLogger(__name__)

# ── Fixed Tender Data ──────────────────────────────────────────────────────────

TENDERS = [
    {
        "tender_number": "CRPF/PROC/2026/0042",
        "title": "Supply, Installation & Commissioning of CCTV Surveillance System — 500 Cameras",
        "issuing_authority": "CRPF — Directorate General, New Delhi",
        "deadline": "2026-08-15",
        "status": "completed",
    },
    {
        "tender_number": "MoHFW/INFRA/2026/1187",
        "title": "Construction of 200-Bed District Hospital at Varanasi",
        "issuing_authority": "Ministry of Health & Family Welfare",
        "deadline": "2026-09-30",
        "status": "completed",
    },
    {
        "tender_number": "SPH/VEH/2026/0309",
        "title": "Procurement of 75 Armoured Patrol Vehicles for Border Security",
        "issuing_authority": "State Police Headquarters, Lucknow",
        "deadline": "2026-10-31",
        "status": "ready",
    },
]

# ── Criteria per Tender ────────────────────────────────────────────────────────

CRITERIA = {
    0: [  # CCTV Tender
        {"code": "C1", "name": "ISO 9001:2015 Quality Certification", "desc": "Bidder must hold a valid ISO 9001:2015 certificate from an accredited body.", "modal": "MANDATORY", "evidence": "iso_certificate", "threshold": None, "unit": None, "currency": None},
        {"code": "C2", "name": "Annual Turnover ≥ ₹10 Crore", "desc": "Average annual turnover for the last 3 financial years must be at least ₹10 Crore.", "modal": "MANDATORY", "evidence": "audited_financials", "threshold": 10.0, "unit": "Crore", "currency": "INR"},
        {"code": "C3", "name": "Prior CCTV Project Experience", "desc": "Must have completed at least 2 CCTV projects of 100+ cameras for any government body in the last 5 years.", "modal": "MANDATORY", "evidence": "work_completion_certificate", "threshold": 2.0, "unit": "projects", "currency": None},
        {"code": "C4", "name": "Warranty & AMC Coverage", "desc": "Comprehensive warranty of minimum 3 years with on-site support and 5-year AMC.", "modal": "CONDITIONAL", "evidence": "warranty_declaration", "threshold": 3.0, "unit": "years", "currency": None},
        {"code": "C5", "name": "Make in India Compliance", "desc": "At least 60% of components should be manufactured in India as per DPIIT guidelines.", "modal": "OPTIONAL", "evidence": "make_in_india_certificate", "threshold": 60.0, "unit": "percent", "currency": None},
    ],
    1: [  # Hospital Tender
        {"code": "C1", "name": "CPWD Empanelment (Class A)", "desc": "Must be empanelled with CPWD as a Class-A contractor.", "modal": "MANDATORY", "evidence": "cpwd_empanelment", "threshold": None, "unit": None, "currency": None},
        {"code": "C2", "name": "Annual Turnover ≥ ₹50 Crore", "desc": "Minimum average annual turnover of ₹50 Crore in the last 3 fiscal years.", "modal": "MANDATORY", "evidence": "audited_financials", "threshold": 50.0, "unit": "Crore", "currency": "INR"},
        {"code": "C3", "name": "Hospital Construction Experience", "desc": "Completed at least 1 hospital project of 100+ beds within the last 7 years.", "modal": "MANDATORY", "evidence": "work_completion_certificate", "threshold": 1.0, "unit": "projects", "currency": None},
        {"code": "C4", "name": "Green Building Certification Plan", "desc": "Must submit an IGBC or GRIHA pre-certification plan for the project.", "modal": "CONDITIONAL", "evidence": "green_building_plan", "threshold": None, "unit": None, "currency": None},
    ],
    2: [  # Vehicles Tender
        {"code": "C1", "name": "BIS Certification for Vehicles", "desc": "All vehicles must comply with BIS standards for armoured vehicles (IS 15293).", "modal": "MANDATORY", "evidence": "bis_certificate", "threshold": None, "unit": None, "currency": None},
        {"code": "C2", "name": "Annual Turnover ≥ ₹25 Crore", "desc": "Minimum average annual turnover of ₹25 Crore in the last 3 fiscal years.", "modal": "MANDATORY", "evidence": "audited_financials", "threshold": 25.0, "unit": "Crore", "currency": "INR"},
        {"code": "C3", "name": "Defence/Police Supply Experience", "desc": "Must have supplied armoured vehicles to defence or police in the last 5 years.", "modal": "MANDATORY", "evidence": "supply_order_copy", "threshold": 1.0, "unit": "orders", "currency": None},
        {"code": "C4", "name": "After-Sales Service Network", "desc": "Must have service centres in at least 5 states.", "modal": "CONDITIONAL", "evidence": "service_network_declaration", "threshold": 5.0, "unit": "states", "currency": None},
    ],
}

# ── Bidders per Tender ─────────────────────────────────────────────────────────

BIDDERS = {
    0: [
        {"name": "Hikvision India Pvt Ltd", "reg": "CIN-U74999DL2014", "email": "tenders@hikvision.in", "phone": "+91-11-4567-8901"},
        {"name": "CP Plus Electronics Pvt Ltd", "reg": "CIN-L31909HR2008", "email": "govbids@cpplus.com", "phone": "+91-124-456-7890"},
        {"name": "Honeywell Automation India", "reg": "CIN-L36990MH1984", "email": "india.tenders@honeywell.com", "phone": "+91-20-2567-1234"},
    ],
    1: [
        {"name": "Larsen & Toubro Construction", "reg": "CIN-L99999MH1946", "email": "tenders@lntecc.com", "phone": "+91-22-6752-5656"},
        {"name": "Shapoorji Pallonji & Co", "reg": "CIN-U45200MH1959", "email": "bids@shapoorji.in", "phone": "+91-22-6749-0000"},
        {"name": "NCC Limited", "reg": "CIN-L72200TG1990", "email": "procurement@nccltd.in", "phone": "+91-40-2339-3939"},
    ],
    2: [
        {"name": "Tata Motors Defence Solutions", "reg": "CIN-L28920MH1945", "email": "defence.bids@tatamotors.com", "phone": "+91-22-6665-7777"},
        {"name": "Mahindra Defence Systems", "reg": "CIN-L65990MH1945", "email": "defence@mahindra.com", "phone": "+91-22-2490-1441"},
        {"name": "Ashok Leyland Defence", "reg": "CIN-L34101TN1948", "email": "defence.tenders@ashokleyland.com", "phone": "+91-44-2220-6000"},
    ],
}

# ── Verdict matrix (tender_idx -> bidder_idx -> list of verdicts per criterion)

VERDICT_MATRIX = {
    0: {  # CCTV
        0: [  # Hikvision — strong bidder, all pass
            {"verdict": "PASS", "conf": 0.96, "eq": 92, "sm": 95, "tc": 90, "reason": "Valid ISO 9001:2015 certificate (Bureau Veritas) found on page 12 of submission. Certificate valid until March 2028."},
            {"verdict": "PASS", "conf": 0.91, "eq": 88, "sm": 90, "tc": 85, "reason": "Audited financials show average turnover of ₹47.3 Crore over FY2023-2025, exceeding the ₹10 Crore threshold."},
            {"verdict": "PASS", "conf": 0.89, "eq": 85, "sm": 87, "tc": 80, "reason": "Work completion certificates for 4 CCTV projects (Delhi Metro, Jaipur Smart City, etc.) each exceeding 200 cameras."},
            {"verdict": "PASS", "conf": 0.93, "eq": 90, "sm": 92, "tc": 88, "reason": "Warranty declaration covers 5-year comprehensive warranty with 24/7 on-site support, exceeding the 3-year minimum."},
            {"verdict": "PASS", "conf": 0.87, "eq": 82, "sm": 85, "tc": 78, "reason": "Make in India certificate from DPIIT confirms 72% indigenous components, exceeding 60% requirement."},
        ],
        1: [  # CP Plus — fails financial threshold
            {"verdict": "PASS", "conf": 0.94, "eq": 90, "sm": 93, "tc": 88, "reason": "ISO 9001:2015 certificate from TÜV SÜD found. Valid until September 2027."},
            {"verdict": "FAIL", "conf": 0.88, "eq": 80, "sm": 85, "tc": 30, "reason": "Financial statements show average turnover of ₹7.2 Crore, which is below the ₹10 Crore threshold. Shortfall: ₹2.8 Crore.", "cf": "Submit revised financials including subsidiary revenue or form a consortium with combined turnover ≥ ₹10 Crore."},
            {"verdict": "PASS", "conf": 0.85, "eq": 82, "sm": 84, "tc": 78, "reason": "Completion certificates for 3 government CCTV installations (150+ cameras each) provided."},
            {"verdict": "PASS", "conf": 0.90, "eq": 88, "sm": 90, "tc": 85, "reason": "Standard 3-year warranty with 5-year optional AMC declared."},
            {"verdict": "REVIEW", "conf": 0.55, "eq": 60, "sm": 65, "tc": 45, "reason": "Make in India certificate claims 58% indigenous content, marginally below the 60% threshold. Certificate authenticity needs manual verification.", "cf": "Increase indigenous component sourcing by 2% or provide updated DPIIT certification."},
        ],
        2: [  # Honeywell — review on experience
            {"verdict": "PASS", "conf": 0.95, "eq": 91, "sm": 94, "tc": 89, "reason": "ISO 9001:2015 certificate from BSI valid until 2028. Global certification covering Indian operations."},
            {"verdict": "PASS", "conf": 0.92, "eq": 89, "sm": 91, "tc": 87, "reason": "Annual turnover of ₹312 Crore (consolidated India operations). Well above the ₹10 Crore threshold."},
            {"verdict": "REVIEW", "conf": 0.52, "eq": 55, "sm": 60, "tc": 48, "reason": "Only 1 government CCTV project (Mumbai Airport, 80 cameras) found in submissions. Requirement is 2 projects of 100+ cameras. Private sector projects not considered.", "cf": "Provide additional work completion certificates for government CCTV projects, or request scope expansion to include quasi-government bodies."},
            {"verdict": "PASS", "conf": 0.94, "eq": 91, "sm": 93, "tc": 90, "reason": "Comprehensive 5-year warranty with dedicated service team and SLA of 4-hour response time."},
            {"verdict": "PASS", "conf": 0.88, "eq": 84, "sm": 86, "tc": 80, "reason": "Make in India compliance at 65% indigenous content as per DPIIT certificate."},
        ],
    },
    1: {  # Hospital
        0: [  # L&T — all pass
            {"verdict": "PASS", "conf": 0.97, "eq": 95, "sm": 96, "tc": 93, "reason": "CPWD Class-A empanelment certificate valid until 2027. Registration number: CPWD/A/2024/1847."},
            {"verdict": "PASS", "conf": 0.95, "eq": 92, "sm": 94, "tc": 90, "reason": "Average annual turnover of ₹4,250 Crore over FY2023-2025. Significantly exceeds ₹50 Crore threshold."},
            {"verdict": "PASS", "conf": 0.93, "eq": 90, "sm": 92, "tc": 88, "reason": "Completed AIIMS Gorakhpur (500 beds) and District Hospital Agra (150 beds) within last 5 years."},
            {"verdict": "PASS", "conf": 0.90, "eq": 87, "sm": 89, "tc": 84, "reason": "IGBC Gold pre-certification plan submitted with detailed sustainability metrics."},
        ],
        1: [  # Shapoorji — fails experience
            {"verdict": "PASS", "conf": 0.94, "eq": 91, "sm": 93, "tc": 88, "reason": "CPWD Class-A empanelment valid. Long-standing registration since 1985."},
            {"verdict": "PASS", "conf": 0.93, "eq": 90, "sm": 92, "tc": 87, "reason": "Average turnover of ₹890 Crore. Well above ₹50 Crore threshold."},
            {"verdict": "FAIL", "conf": 0.85, "eq": 78, "sm": 82, "tc": 25, "reason": "No hospital project of 100+ beds found in the last 7 years. Company specializes in commercial and residential. Most recent healthcare: 50-bed clinic (2019).", "cf": "Form a JV with a healthcare construction specialist or provide evidence of similar-scale institutional projects."},
            {"verdict": "REVIEW", "conf": 0.50, "eq": 55, "sm": 58, "tc": 42, "reason": "Green building plan submitted but uses an internal sustainability framework instead of IGBC/GRIHA. Needs verification of equivalence.", "cf": "Resubmit with IGBC or GRIHA pre-certification from an accredited assessor."},
        ],
        2: [  # NCC — review on green building
            {"verdict": "PASS", "conf": 0.92, "eq": 89, "sm": 91, "tc": 86, "reason": "CPWD Class-A empanelment valid until 2026. Registration: CPWD/A/2023/0932."},
            {"verdict": "PASS", "conf": 0.90, "eq": 87, "sm": 89, "tc": 83, "reason": "Average annual turnover of ₹3,100 Crore. Comfortably above ₹50 Crore threshold."},
            {"verdict": "PASS", "conf": 0.88, "eq": 85, "sm": 87, "tc": 80, "reason": "Completed Rajiv Gandhi Super Speciality Hospital, Raichur (200 beds) in 2023."},
            {"verdict": "REVIEW", "conf": 0.48, "eq": 50, "sm": 55, "tc": 40, "reason": "GRIHA plan submitted but rated only 2-star (below typical government expectation of 3-star). Needs review.", "cf": "Upgrade GRIHA plan to target 3-star rating or submit additional sustainability measures."},
        ],
    },
    2: {  # Vehicles — status=ready, so verdicts exist but tender not 'completed'
        0: [  # Tata — all pass
            {"verdict": "PASS", "conf": 0.96, "eq": 93, "sm": 95, "tc": 91, "reason": "BIS certificate IS 15293 valid. Tested and certified by ARAI, Pune."},
            {"verdict": "PASS", "conf": 0.94, "eq": 91, "sm": 93, "tc": 88, "reason": "Annual turnover of ₹3,450 Crore (defence division). Exceeds ₹25 Crore."},
            {"verdict": "PASS", "conf": 0.92, "eq": 89, "sm": 91, "tc": 86, "reason": "Supplied 120 armoured vehicles to Indian Army and 45 to CRPF in the last 3 years."},
            {"verdict": "PASS", "conf": 0.91, "eq": 88, "sm": 90, "tc": 85, "reason": "Service centres in 12 states with dedicated defence service teams."},
        ],
        1: [  # Mahindra — review on service network
            {"verdict": "PASS", "conf": 0.95, "eq": 92, "sm": 94, "tc": 90, "reason": "BIS IS 15293 certification valid. Tested by VRDE, Ahmednagar."},
            {"verdict": "PASS", "conf": 0.93, "eq": 90, "sm": 92, "tc": 87, "reason": "Annual turnover of ₹1,200 Crore (defence vertical). Exceeds ₹25 Crore."},
            {"verdict": "PASS", "conf": 0.90, "eq": 87, "sm": 89, "tc": 84, "reason": "Supplied 80 Mine Protected Vehicles to BSF and 30 to State Police forces."},
            {"verdict": "REVIEW", "conf": 0.53, "eq": 58, "sm": 62, "tc": 44, "reason": "Service centres declared in 4 states (MH, KA, TN, DL). Requirement is 5 states. Expansion plan submitted but not yet operational.", "cf": "Establish service centre in at least 1 additional state before contract signing."},
        ],
        2: [  # Ashok Leyland — fails BIS
            {"verdict": "FAIL", "conf": 0.86, "eq": 75, "sm": 80, "tc": 20, "reason": "BIS IS 15293 certificate not found in submission. Only IS 14783 (commercial vehicles) provided, which does not cover armoured vehicle specifications.", "cf": "Obtain BIS IS 15293 certification for the proposed vehicle model from an accredited testing agency."},
            {"verdict": "PASS", "conf": 0.91, "eq": 88, "sm": 90, "tc": 85, "reason": "Annual turnover of ₹580 Crore (defence division). Exceeds ₹25 Crore."},
            {"verdict": "PASS", "conf": 0.87, "eq": 83, "sm": 86, "tc": 79, "reason": "Supplied 60 troop carriers to Indian Army. Armoured variant is a new product line."},
            {"verdict": "PASS", "conf": 0.89, "eq": 86, "sm": 88, "tc": 82, "reason": "Service centres in 8 states with dedicated defence support division."},
        ],
    },
}

# ── Evidence chains (shared template per criterion type)

def make_evidence_chain(criterion_name, verdict_val):
    """Generate a realistic evidence chain for a verdict."""
    if "ISO" in criterion_name or "Certification" in criterion_name or "BIS" in criterion_name:
        return [
            {"step": 1, "source": "Bid_Submission.pdf", "text": f"Certificate scan for {criterion_name} located in annexure.", "confidence": 0.92, "page": 12},
            {"step": 2, "source": "Verification_Portal", "text": "Cross-referenced with issuing authority database.", "confidence": 0.88, "page": 1},
        ]
    if "Turnover" in criterion_name:
        return [
            {"step": 1, "source": "Audited_Financials_FY2025.pdf", "text": "Extracted annual revenue figures from auditor's report.", "confidence": 0.94, "page": 5},
            {"step": 2, "source": "Audited_Financials_FY2024.pdf", "text": "Cross-verified with previous year's financials.", "confidence": 0.91, "page": 4},
            {"step": 3, "source": "CA_Certificate.pdf", "text": "Chartered Accountant certificate confirming 3-year average.", "confidence": 0.89, "page": 1},
        ]
    if "Experience" in criterion_name or "Supply" in criterion_name:
        return [
            {"step": 1, "source": "Work_Completion_Certificate.pdf", "text": "Completion certificate from client organization.", "confidence": 0.87, "page": 1},
            {"step": 2, "source": "Purchase_Order.pdf", "text": "Original purchase order for reference.", "confidence": 0.85, "page": 2},
        ]
    return [
        {"step": 1, "source": "Bid_Document.pdf", "text": f"Relevant declaration for {criterion_name}.", "confidence": 0.80, "page": 8},
    ]


def seed_database():
    """Seed the database with correlated dummy data if empty."""
    db = SessionLocal()
    try:
        if db.query(Tender).count() > 0:
            logger.info("Database already has data — skipping seed.")
            return

        logger.info("Seeding database with dummy data...")
        base_time = datetime.utcnow() - timedelta(days=7)

        tender_objs = []
        criteria_map = {}  # tender_idx -> list of Criterion objects

        # 1. Create Tenders
        for i, td in enumerate(TENDERS):
            t = Tender(
                tender_number=td["tender_number"],
                title=td["title"],
                issuing_authority=td["issuing_authority"],
                deadline=td["deadline"],
                status=td["status"],
                criteria_count=len(CRITERIA[i]),
                created_at=base_time + timedelta(hours=i * 12),
                updated_at=base_time + timedelta(hours=i * 12 + 6),
            )
            db.add(t)
            db.flush()
            tender_objs.append(t)

            # Audit log
            db.add(AuditLog(action="tender_uploaded", entity_type="tender", entity_id=t.id,
                            user_id="officer_001", details={"title": td["title"]},
                            timestamp=base_time + timedelta(hours=i * 12)))

        # 2. Create Criteria
        for ti, crit_list in CRITERIA.items():
            criteria_map[ti] = []
            for cd in crit_list:
                c = Criterion(
                    tender_id=tender_objs[ti].id,
                    criterion_code=cd["code"],
                    name=cd["name"],
                    description=cd["desc"],
                    modal_type=cd["modal"],
                    evidence_type=cd["evidence"],
                    threshold_value=cd["threshold"],
                    threshold_unit=cd["unit"],
                    threshold_currency=cd["currency"],
                    created_at=base_time + timedelta(hours=ti * 12 + 2),
                )
                db.add(c)
                db.flush()
                criteria_map[ti].append(c)

            db.add(AuditLog(action="criteria_extracted", entity_type="tender",
                            entity_id=tender_objs[ti].id, user_id="system",
                            details={"criteria_count": len(crit_list)},
                            timestamp=base_time + timedelta(hours=ti * 12 + 2)))

        # 3. Create Bidders & Verdicts
        for ti, bidder_list in BIDDERS.items():
            for bi, bd in enumerate(bidder_list):
                bidder = Bidder(
                    tender_id=tender_objs[ti].id,
                    company_name=bd["name"],
                    registration_number=bd["reg"],
                    contact_email=bd["email"],
                    contact_phone=bd["phone"],
                    status="evaluated",
                    created_at=base_time + timedelta(hours=ti * 12 + 3),
                )
                db.add(bidder)
                db.flush()

                # Create verdicts
                p = f = r = 0
                verdict_data_list = VERDICT_MATRIX[ti][bi]
                for ci, vd in enumerate(verdict_data_list):
                    crit_obj = criteria_map[ti][ci]
                    v = Verdict(
                        criterion_id=crit_obj.id,
                        bidder_id=bidder.id,
                        verdict=vd["verdict"],
                        confidence=vd["conf"],
                        axis_evidence_quality=vd["eq"],
                        axis_semantic_match=vd["sm"],
                        axis_threshold_compliance=vd["tc"],
                        reasoning=vd["reason"],
                        counterfactual=vd.get("cf"),
                        evidence_chain=make_evidence_chain(crit_obj.name, vd["verdict"]),
                        created_at=base_time + timedelta(hours=ti * 12 + 4),
                    )
                    db.add(v)
                    if vd["verdict"] == "PASS": p += 1
                    elif vd["verdict"] == "FAIL": f += 1
                    else: r += 1

                bidder.pass_count = p
                bidder.fail_count = f
                bidder.review_count = r
                if f > 0:
                    bidder.overall_verdict = "FAIL"
                elif r > 0:
                    bidder.overall_verdict = "REVIEW"
                else:
                    bidder.overall_verdict = "PASS"

                db.add(AuditLog(action="bidder_evaluated", entity_type="bidder",
                                entity_id=bidder.id, user_id="system",
                                details={"pass": p, "fail": f, "review": r},
                                timestamp=base_time + timedelta(hours=ti * 12 + 4)))

        # 4. Create a sample Correction (officer override)
        db.flush()
        # Find a FAIL verdict to override as an example
        sample_fail = db.query(Verdict).filter(Verdict.verdict == "FAIL").first()
        if sample_fail:
            correction = Correction(
                verdict_id=sample_fail.id,
                original_verdict="FAIL",
                corrected_verdict="REVIEW",
                axis_wrong=3,
                reason="Turnover shortfall is marginal (₹7.2 Cr vs ₹10 Cr). Recommending manual review of subsidiary financials before final rejection.",
                officer_id="officer_001",
                is_validated=False,
                created_at=base_time + timedelta(days=1),
            )
            db.add(correction)
            db.add(AuditLog(action="verdict_overridden", entity_type="verdict",
                            entity_id=sample_fail.id, user_id="officer_001",
                            details={"from": "FAIL", "to": "REVIEW", "axis_wrong": 3},
                            timestamp=base_time + timedelta(days=1)))

        # 5. Additional audit logs for realism
        extra_logs = [
            ("system_startup", "system", None, "system", {"version": "1.0.0"}),
            ("evaluation_completed", "tender", tender_objs[0].id, "system", {"bidders_evaluated": 3}),
            ("evaluation_completed", "tender", tender_objs[1].id, "system", {"bidders_evaluated": 3}),
            ("report_exported", "tender", tender_objs[0].id, "officer_001", {"format": "PDF"}),
        ]
        for action, etype, eid, uid, det in extra_logs:
            db.add(AuditLog(action=action, entity_type=etype, entity_id=eid,
                            user_id=uid, details=det,
                            timestamp=base_time + timedelta(days=2)))

        db.commit()
        logger.info("Database seeded successfully with 3 tenders, 13 criteria, 9 bidders, and full verdict data.")

    except Exception as e:
        db.rollback()
        logger.error(f"Seeding failed: {e}")
        raise
    finally:
        db.close()
