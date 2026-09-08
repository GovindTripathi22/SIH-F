"""
UrbanPulse — Deterministic End-to-End System Verification Harness (Phase 21).

Executes the complete hero workflow:
1. Subsystem Health Verification (FastAPI, YOLOv8, SQLite/PostGIS, Queue, Privacy)
2. Bus A Edge Detection Ingestion (Pothole at Bellandur Outer Ring Road)
3. Spatial Radius Query & Candidate Issue Verification
4. Bus B Second-Pass Detection Ingestion (~8m offset)
5. Multi-Pass Fleet Consensus & Bayesian Confidence Aggregation Verification
6. Municipal PDF Work Order Generation with Audit Trail
7. Closed-Loop Maintenance Lifecycle Progression (PENDING -> IN_PROGRESS -> REPAIRED -> RESOLUTION_VERIFIED)
8. Edge AI Tensor Inference & Privacy Anonymization Test
9. Edge Persistent Queue Resilience Test
"""

import sys
import os
import time
import uuid
import tempfile
import httpx
import cv2
import numpy as np

# Reconfigure standard output for UTF-8 compatibility on Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Ensure backend modules can be imported if needed
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8001")


def print_step(step_num: int, title: str):
    print(f"\n{'='*75}")
    print(f"  [STEP {step_num}] {title}")
    print(f"{'='*75}")


def assert_true(condition: bool, message: str):
    if not condition:
        print(f"\n[FAIL] {message}")
        sys.exit(1)
    print(f"  [PASS] {message}")


def run_verification():
    print(f"\n===========================================================================")
    print(f"   URBANPULSE END-TO-END SYSTEM INTEGRATION HARNESS (Phase 21)")
    print(f"   Target URL: {BASE_URL}")
    print(f"===========================================================================")

    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    # -------------------------------------------------------------------------
    # STEP 1: Subsystem Health & Readiness Check
    # -------------------------------------------------------------------------
    print_step(1, "Subsystem Health & YOLOv8 Readiness Check")
    t0 = time.time()
    res = client.get("/health")
    latency = (time.time() - t0) * 1000
    assert_true(res.status_code == 200, f"/health responded with HTTP 200 in {latency:.1f}ms")

    data = res.json()
    assert_true(data["status"] == "healthy", "Overall status is 'healthy'")
    subsystems = data["subsystems"]
    assert_true(subsystems["backend"] == "ONLINE", "Backend subsystem is ONLINE")
    assert_true(subsystems["database"] == "ONLINE", "Database subsystem is ONLINE")
    assert_true(subsystems["cv_engine"] == "READY", "YOLOv8 Edge AI Engine is READY")
    assert_true(subsystems["privacy_engine"] == "ACTIVE", "Privacy Blurring Engine is ACTIVE")
    assert_true(subsystems["work_order_engine"] == "ACTIVE", "PDF Work Order Engine is ACTIVE")
    print(f"    Subsystem Stats: Verified Issues={subsystems['database_stats']['verified_issues']}, "
          f"Buses={subsystems['database_stats']['fleet_buses']}, "
          f"Weights={subsystems['cv_details']['weights_size_mb']}MB")

    # -------------------------------------------------------------------------
    # STEP 2: Bus A Initial Defect Detection
    # -------------------------------------------------------------------------
    print_step(2, "Bus A Initial Defect Detection (Bellandur Corridor)")
    # Use isolated dynamic coordinates per run to avoid collision with seeded or prior-run clusters
    offset = (uuid.uuid4().int % 10000) * 0.0001
    corridor_lat = round(12.800000 + offset, 6)
    corridor_lon = round(77.500000 + offset, 6)

    edge_headers = {"X-Edge-Device-Key": "urbanpulse-edge-bus-telemetry-key-2026"}

    event_a_id = f"evt-hero-busA-{uuid.uuid4().hex[:6]}"
    payload_a = {
        "event_id": event_a_id,
        "latitude": corridor_lat,
        "longitude": corridor_lon,
        "timestamp": "2026-09-08T13:00:00Z",
        "bus_id": "KA01-FA-1234",
        "route_id": "route-500D",
        "camera_id": "cam-front-01",
        "event_type": "pothole",
        "confidence": 0.82,
        "validation_score": 0.86,
        "gps_accuracy_meters": 2.1
    }

    t0 = time.time()
    res = client.post("/api/v1/events", json=payload_a, headers=edge_headers)
    latency = (time.time() - t0) * 1000
    assert_true(res.status_code == 201, f"Event A ingested successfully in {latency:.1f}ms (HTTP 201)")

    # -------------------------------------------------------------------------
    # STEP 3: Verify Spatial Clustering & Initial Candidate Issue
    # -------------------------------------------------------------------------
    print_step(3, "Spatial Radius Query & Candidate Verification")
    res = client.get(f"/api/v1/issues/nearby?latitude={corridor_lat}&longitude={corridor_lon}&radius_meters=30")
    assert_true(res.status_code == 200, "Nearby spatial query returned HTTP 200")
    nearby_issues = res.json()
    assert_true(len(nearby_issues) >= 1, f"Found {len(nearby_issues)} clustered issue(s) at location")

    target_issue = nearby_issues[0]
    target_issue_id = target_issue["issue_id"]
    print(f"    Target Issue ID: {target_issue_id}")
    assert_true(target_issue["observation_count"] >= 1, "Observation count initialized")
    assert_true(target_issue["distinct_bus_count"] == 1, "Distinct bus count is exactly 1 (Bus A only)")
    assert_true(target_issue.get("verification_state") == "CANDIDATE", "Verification state initialized to CANDIDATE")
    init_conf = target_issue["confidence"]
    print(f"    Pass 1: Observations={target_issue['observation_count']}, Buses={target_issue['distinct_bus_count']}, Confidence={init_conf:.2f}")

    # -------------------------------------------------------------------------
    # STEP 4: Bus B Second-Pass Detection (Multi-Pass Consensus)
    # -------------------------------------------------------------------------
    print_step(4, "Bus B Second-Pass Ingestion (Multi-Pass Consensus)")
    # Offset by ~7.8 meters along the corridor
    event_b_id = f"evt-hero-busB-{uuid.uuid4().hex[:6]}"
    payload_b = {
        "event_id": event_b_id,
        "latitude": corridor_lat + 0.00007,
        "longitude": corridor_lon,
        "timestamp": "2026-09-08T13:07:00Z",
        "bus_id": "KA01-FA-5678", # Independent bus!
        "route_id": "route-201C",
        "camera_id": "cam-front-02",
        "event_type": "pothole",
        "confidence": 0.89,
        "validation_score": 0.92,
        "gps_accuracy_meters": 2.4
    }

    t0 = time.time()
    res = client.post("/api/v1/events", json=payload_b, headers=edge_headers)
    latency = (time.time() - t0) * 1000
    assert_true(res.status_code == 201, f"Event B ingested successfully in {latency:.1f}ms (HTTP 201)")

    # -------------------------------------------------------------------------
    # STEP 5: Verify Multi-Pass Consensus & Bayesian Aggregation
    # -------------------------------------------------------------------------
    print_step(5, "Consensus State & Bayesian Confidence Verification")
    res = client.get(f"/api/v1/issues/{target_issue_id}")
    assert_true(res.status_code == 200, f"Retrieved issue {target_issue_id}")
    updated = res.json()

    assert_true(updated["distinct_bus_count"] >= 2, f"Distinct buses upgraded to {updated['distinct_bus_count']} (Fleet consensus achieved)")
    assert_true(updated["observation_count"] >= 2, f"Total observations increased to {updated['observation_count']}")
    assert_true(updated["confidence"] > init_conf, f"Confidence elevated via Bayesian fusion: {init_conf:.2f} -> {updated['confidence']:.2f}")
    assert_true(updated["verification_score"] >= 0.70, f"Verification score escalated to {updated['verification_score']:.3f} (Defensible threshold)")
    assert_true(updated.get("verification_state") == "VERIFIED", f"Verification state upgraded to {updated.get('verification_state')}")
    print(f"    Consensus Verified: Buses={updated['distinct_bus_count']}, Observations={updated['observation_count']}, Score={updated['verification_score']}")

    # -------------------------------------------------------------------------
    # STEP 6: Municipal PDF Work Order Generation
    # -------------------------------------------------------------------------
    print_step(6, "Municipal PDF Work Order Generation (BBMP Format)")
    t0 = time.time()
    res = client.get(f"/api/v1/work-orders/{target_issue_id}/pdf")
    latency = (time.time() - t0) * 1000
    assert_true(res.status_code == 200, f"PDF generated in {latency:.1f}ms (HTTP 200)")
    assert_true(res.headers.get("content-type") == "application/pdf", "Content-Type is application/pdf")

    pdf_bytes = res.content
    assert_true(len(pdf_bytes) > 1000, f"PDF binary size is defensible ({len(pdf_bytes)} bytes)")
    assert_true(pdf_bytes.startswith(b"%PDF-"), "File header matches valid PDF specification (%PDF-)")
    print(f"    Official PDF Work Order generated successfully ({len(pdf_bytes)} bytes)")

    # -------------------------------------------------------------------------
    # STEP 7: Closed-Loop Maintenance Lifecycle Transitions
    # -------------------------------------------------------------------------
    print_step(7, "Closed-Loop Maintenance Lifecycle Transitions (Authenticated)")
    # Authenticate as BBMP Road Maintenance Executive
    auth_res = client.post("/api/v1/auth/login", json={
        "username": "engineer@bbmp.gov.in",
        "password": "PWD@BBMP2026"
    })
    assert_true(auth_res.status_code == 200, "Authenticated as BBMP Road Maintenance Engineer")
    engineer_jwt = auth_res.json()["access_token"]
    eng_headers = {"Authorization": f"Bearer {engineer_jwt}"}

    # Transition 1: IN_PROGRESS
    res = client.post("/api/v1/work-orders/lifecycle", headers=eng_headers, json={
        "issue_id": target_issue_id,
        "target_status": "IN_PROGRESS",
        "actor": "BBMP Chief Road Engineer",
        "notes": "Crew dispatched with asphalt patching unit"
    })
    assert_true(res.status_code == 200, "Advanced status to IN_PROGRESS")

    # Transition 2: REPAIRED
    res = client.post("/api/v1/work-orders/lifecycle", headers=eng_headers, json={
        "issue_id": target_issue_id,
        "target_status": "REPAIRED",
        "actor": "Field Contractor Unit #4",
        "notes": "Cold-mix asphalt applied and roller compacted"
    })
    assert_true(res.status_code == 200, "Advanced status to REPAIRED")

    # Transition 3: RESOLUTION_VERIFIED
    res = client.post("/api/v1/work-orders/lifecycle", headers=eng_headers, json={
        "issue_id": target_issue_id,
        "target_status": "RESOLUTION_VERIFIED",
        "actor": "Quality Audit Officer",
        "notes": "Post-repair transit pass confirmed defect eliminated"
    })
    assert_true(res.status_code == 200, "Advanced status to RESOLUTION_VERIFIED")

    # Verify final issue state
    res = client.get(f"/api/v1/issues/{target_issue_id}")
    final_issue = res.json()
    assert_true(final_issue["status"] == "RESOLUTION_VERIFIED", "Issue closed loop complete: status == RESOLUTION_VERIFIED")
    assert_true(final_issue.get("verification_state") == "RESOLUTION_VERIFIED", "Verification state is RESOLUTION_VERIFIED")
    print(f"    Final Issue Status: {final_issue['status']} (verification_state={final_issue.get('verification_state')})")

    # -------------------------------------------------------------------------
    # STEP 8: Deep Learning YOLOv8 Inference & Privacy Anonymization
    # -------------------------------------------------------------------------
    print_step(8, "Deep Learning YOLOv8 Inference & Privacy Blurring")
    # Generate a realistic road test frame with an asphalt texture
    synthetic_frame = np.ones((480, 640, 3), dtype=np.uint8) * 80
    # Add a simulated dark pothole depression
    cv2.ellipse(synthetic_frame, (320, 300), (90, 45), 0, 0, 360, (30, 30, 30), -1)
    _, encoded_jpg = cv2.imencode('.jpg', synthetic_frame)

    t0 = time.time()
    files = {"file": ("test_road_frame.jpg", encoded_jpg.tobytes(), "image/jpeg")}
    res = client.post("/api/v1/cv/detect", files=files, data={"confidence_threshold": 0.30, "apply_privacy": True})
    latency = (time.time() - t0) * 1000
    assert_true(res.status_code == 200, f"YOLOv8 inference returned HTTP 200 in {latency:.1f}ms")

    cv_result = res.json()
    assert_true("inference_latency_ms" in cv_result, f"Measured inference time: {cv_result.get('inference_latency_ms')}ms")
    assert_true("camera_health" in cv_result, f"Camera health status: {cv_result.get('camera_health')}")
    assert_true("privacy" in cv_result, f"Privacy anonymization stats: {cv_result.get('privacy')}")
    print(f"    Edge AI Inference: Latency={cv_result.get('inference_latency_ms')}ms, FPS={cv_result.get('fps')}, Detections={len(cv_result.get('detections', []))}")

    # -------------------------------------------------------------------------
    # STEP 9: Edge Persistent Queue Resilience Test
    # -------------------------------------------------------------------------
    print_step(9, "Edge Persistent Queue Resilience (SQLite FIFO)")
    from app.edge.persistent_queue import PersistentEdgeQueue

    with tempfile.TemporaryDirectory() as temp_dir:
        db_path = os.path.join(temp_dir, "edge_queue_e2e.db")
        queue = PersistentEdgeQueue(db_path=db_path)

        # Enqueue offline detections
        evt1 = {
            "event_id": "edge-evt-001",
            "bus_id": "KA01-FA-9999",
            "route_id": "route-335E",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "event_type": "road_crack",
            "confidence": 0.88,
            "timestamp": "2026-09-08T13:15:00Z"
        }
        assert_true(queue.enqueue(evt1), "Enqueued edge event 1 successfully")

        # Simulate device power cycle by closing and reopening queue connection
        queue.close()
        queue2 = PersistentEdgeQueue(db_path=db_path)
        pending = queue2.get_pending(limit=10)
        assert_true(len(pending) == 1, f"Retrieved {len(pending)} persisted event after power cycle")
        assert_true(pending[0]["event_id"] == "edge-evt-001", "Event ID preserved exactly across restart")

        # Mark acknowledged
        queue2.mark_acknowledged("edge-evt-001")
        remaining = queue2.get_pending(limit=10)
        assert_true(len(remaining) == 0, "Queue correctly empty after atomic ACK")
        queue2.close()
        print("    Edge persistent storage verified durable against sudden disconnection and power cycle.")

    # -------------------------------------------------------------------------
    # COMPLETION
    # -------------------------------------------------------------------------
    print("\n" + "="*75)
    print("  [SUCCESS] ALL 9 END-TO-END SYSTEM INTEGRATION CHECKS PASSED PERFECTLY!")
    print("  UrbanPulse is verified functional across AI, GIS, Edge, Security, and Ops.")
    print("="*75 + "\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(run_verification())
    except Exception as ex:
        print(f"\n[ERROR] UNHANDLED EXCEPTION DURING E2E VERIFICATION: {ex}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
