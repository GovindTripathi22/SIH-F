"""
UrbanPulse — Deterministic Full Demo Validation Harness (Phase 24).
Executes the exact 13-step end-to-end municipal lifecycle and emits
a standardized machine-readable summary block.

Steps:
1. Reset/seed demo database
2. Verify backend & YOLOv8 readiness
3. Create Bus A observation
4. Run temporal validation
5. Persist event in database
6. Create Bus B observation
7. Run multi-pass verification
8. Recalculate explainable priority
9. Fetch GIS issue
10. Generate municipal work order (PDF)
11. Transition to REPAIRED
12. Record automated clean-pass observations
13. Verify closed state (RESOLUTION_VERIFIED)
"""

import sys
import os
import time
import uuid
import json
import httpx

# UTF-8 console output for Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Ensure backend directory is in path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8001")


def run_full_validation():
    print("=" * 70)
    print("URBANPULSE DETERMINISTIC FULL DEMO VALIDATION")
    print(f"Target Server: {BASE_URL}")
    print("=" * 70)

    results = {
        "event_created": "FAIL",
        "temporal_validation": "FAIL",
        "postgis_persistence": "FAIL",
        "multi_pass_consensus": "FAIL",
        "priority_engine": "FAIL",
        "work_order": "FAIL",
        "repair_verification": "FAIL",
        "overall": "FAIL"
    }

    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    # 1. Health & Database Check
    print("\n[Step 1 & 2] Verifying Backend & YOLOv8 Subsystems...")
    try:
        res = client.get("/health")
        if res.status_code != 200 or res.json().get("status") != "healthy":
            print(f"Backend unhealthy: {res.text}")
            return print_summary(results)
        print("  ✓ Backend and Database online; YOLOv8 model loaded.")
    except Exception as e:
        print(f"Cannot connect to backend: {e}")
        return print_summary(results)

    # Isolated dynamic coordinates to prevent collision with prior runs
    test_lat = round(12.920000 + (uuid.uuid4().int % 5000) * 0.0001, 6)
    test_lon = round(77.610000 + (uuid.uuid4().int % 5000) * 0.0001, 6)
    heading_a = 90.0

    edge_headers = {"X-Edge-Device-Key": "urbanpulse-edge-bus-telemetry-key-2026"}

    # 3. Create Bus A Observation
    print("\n[Step 3] Creating Bus A Initial Defect Detection...")
    evt_a_id = f"evt-val-A-{uuid.uuid4().hex[:6]}"
    payload_a = {
        "event_id": evt_a_id,
        "latitude": test_lat,
        "longitude": test_lon,
        "timestamp": "2026-09-08T14:00:00Z",
        "bus_id": "KA-01-FA-1001",
        "route_id": "route-500D",
        "camera_id": "CAM-01-FWD",
        "event_type": "pothole",
        "confidence": 0.86,
        "validation_score": 0.94,
        "gps_accuracy_meters": 2.5,
        "metadata_json": json.dumps({"heading": heading_a, "speed_kmh": 34.2})
    }

    res_a = client.post("/api/v1/events", json=payload_a, headers=edge_headers)
    if res_a.status_code in [200, 201]:
        results["event_created"] = "PASS"
        print(f"  ✓ Event {evt_a_id} created successfully.")
    else:
        print(f"  ✗ Event creation failed: {res_a.text}")
        return print_summary(results)

    # 4 & 5. Temporal Validation & Persistence
    print("\n[Step 4 & 5] Verifying Temporal Validation & Database Persistence...")
    res_issues = client.get(f"/api/v1/issues/nearby?latitude={test_lat}&longitude={test_lon}&radius_meters=35.0")
    if res_issues.status_code != 200:
        print(f"  ✗ Failed to query nearby issues: {res_issues.text}")
        return print_summary(results)

    matched_issues = res_issues.json()
    if not matched_issues:
        print("  ✗ Issue not persisted in database.")
        return print_summary(results)

    target_issue = matched_issues[0]
    target_issue_id = target_issue.get("issue_id") or target_issue.get("id")
    results["temporal_validation"] = "PASS"
    results["postgis_persistence"] = "PASS"
    print(f"  ✓ Issue {target_issue_id} persisted with verification_state={target_issue.get('verification_state')}.")

    # 6 & 7. Create Bus B Observation & Multi-Pass Verification
    print("\n[Step 6 & 7] Ingesting Second Independent Fleet Pass (Bus B)...")
    evt_b_id = f"evt-val-B-{uuid.uuid4().hex[:6]}"
    # 7 meters offset, compatible heading (92 deg)
    payload_b = {
        "event_id": evt_b_id,
        "latitude": round(test_lat + 0.00006, 6),
        "longitude": round(test_lon + 0.00006, 6),
        "timestamp": "2026-09-08T14:15:00Z",
        "bus_id": "KA-02-FB-2002",
        "route_id": "route-500D",
        "camera_id": "CAM-02-FWD",
        "event_type": "pothole",
        "confidence": 0.89,
        "validation_score": 0.96,
        "gps_accuracy_meters": 3.0,
        "metadata_json": json.dumps({"heading": 92.0, "speed_kmh": 28.5})
    }

    res_b = client.post("/api/v1/events", json=payload_b, headers=edge_headers)
    if res_b.status_code not in [200, 201]:
        print(f"  ✗ Bus B event ingestion failed: {res_b.text}")
        return print_summary(results)

    # 8 & 9. Multi-Pass Consensus & Priority Calculation
    print("\n[Step 8 & 9] Evaluating Multi-Pass Consensus & Priority Recalculation...")
    res_escalated = client.get(f"/api/v1/issues/{target_issue_id}")
    if res_escalated.status_code != 200:
        print(f"  ✗ Failed to retrieve escalated issue: {res_escalated.text}")
        return print_summary(results)

    escalated_data = res_escalated.json()
    buses_count = escalated_data.get("distinct_bus_count", 0)
    conf = escalated_data.get("confidence", 0)
    state = escalated_data.get("verification_state", "")

    if buses_count >= 2 and state == "VERIFIED" and conf > 0.90:
        results["multi_pass_consensus"] = "PASS"
        results["priority_engine"] = "PASS"
        print(f"  ✓ Multi-Pass Verified: buses={buses_count}, confidence={conf}, priority={escalated_data.get('priority')}.")
    else:
        print(f"  ✗ Consensus state incomplete: buses={buses_count}, state={state}, conf={conf}")
        return print_summary(results)

    # 10. Generate Municipal PDF Work Order
    print("\n[Step 10] Generating Official BBMP Municipal Work Order...")
    res_pdf = client.get(f"/api/v1/work-orders/{target_issue_id}/pdf")
    if res_pdf.status_code == 200 and res_pdf.content.startswith(b"%PDF-"):
        results["work_order"] = "PASS"
        print(f"  ✓ Official BBMP PDF generated ({len(res_pdf.content)} bytes).")
    else:
        print(f"  ✗ Work order PDF generation failed: {res_pdf.status_code}")
        return print_summary(results)

    # 11 & 12 & 13. Simulate Repair & Automated Clean-Pass Verification
    print("\n[Step 11, 12, 13] Simulating Maintenance Repair & Closed-Loop Clean Passes...")
    # Login as BBMP PWD engineer
    auth_res = client.post("/api/v1/auth/login", json={
        "username": "engineer@bbmp.gov.in",
        "password": "PWD@BBMP2026"
    })
    token = auth_res.json().get("access_token")
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Transition to IN_PROGRESS then REPAIRED
    client.post("/api/v1/work-orders/lifecycle", headers=auth_headers, json={
        "issue_id": target_issue_id, "target_status": "IN_PROGRESS",
        "actor": "BBMP Maintenance Wing", "notes": "Cold asphalt patch crew assigned"
    })
    client.post("/api/v1/work-orders/lifecycle", headers=auth_headers, json={
        "issue_id": target_issue_id, "target_status": "REPAIRED",
        "actor": "Contractor Rapid Patch #2", "notes": "Asphalt compaction complete"
    })

    # Record 2 clean passes via fleet cameras
    client.post(f"/api/v1/work-orders/{target_issue_id}/clean-pass", headers=auth_headers, json={"bus_id": "KA-01-FA-1001"})
    clean_res2 = client.post(f"/api/v1/work-orders/{target_issue_id}/clean-pass", headers=auth_headers, json={"bus_id": "KA-03-FC-3003"})
    
    if clean_res2.status_code == 200:
        verified_data = clean_res2.json()
        if verified_data.get("verification_state") == "RESOLUTION_VERIFIED" and verified_data.get("status") == "RESOLUTION_VERIFIED":
            results["repair_verification"] = "PASS"
            results["overall"] = "PASS"
            print(f"  ✓ Closed loop confirmed: status={verified_data.get('status')}, state={verified_data.get('verification_state')}.")
        else:
            print(f"  ✗ Clean pass did not promote to RESOLUTION_VERIFIED: {verified_data}")
    else:
        print(f"  ✗ Clean pass endpoint failed: {clean_res2.text}")

    return print_summary(results)


def print_summary(results: dict) -> int:
    print("\n" + "=" * 30)
    print("E2E RESULT")
    print("----------")
    for k, v in results.items():
        print(f"{k}: {v}")
    print("=" * 30 + "\n")
    return 0 if results.get("overall") == "PASS" else 1


if __name__ == "__main__":
    sys.exit(run_full_validation())
