# UrbanPulse — Comprehensive System Status & Capability Reality
**Authoritative Single Source of Truth for Subsystem Maturity & Proof**

- **Project:** UrbanPulse — Mobile Urban Intelligence Platform
- **SIH Problem Statement:** SIH26124 (Bharat Electronics Limited — Smart Automation)
- **Document Version:** 1.0.0
- **Audited On:** 2026-09-08
- **Classification:** Functional Prototype with Verified End-to-End Integration

---

## 1. Current Version
- **Release:** v1.0.0-SIH-REMEDIATED
- **Frontend Version:** React 18.2 + Vite 6.4 + Tailwind CSS + Leaflet GIS
- **Backend Version:** FastAPI 0.109.0 + SQLAlchemy 2.0 + GeoAlchemy2 0.14
- **AI Inference Engine:** Ultralytics YOLOv8 8.3 + PyTorch 2.6
- **Persistence Engine:** SQLite 3 (Edge Queue & Local DB) / PostgreSQL 15 + PostGIS (Cloud Option)

---

## 2. What is Fully Working (VERIFIED)

| Subsystem | Verified Functionality | Executing Proof |
| :--- | :--- | :--- |
| **YOLOv8 Edge AI** | Real deep learning inference using `backend/rdd_yolov8n.pt` (5.93 MB, 16 classes). Measured latency 28.3ms CPU (35.4 FPS). Direct class indexing without modulo. | `backend/tests/test_api.py::test_cv_model_info` |
| **Optical Pre-Flight** | Laplacian variance blur analysis ($\sigma^2 < 60$), brightness balance ($45 \le \bar{Y} \le 220$), lens obstruction check ($\sigma < 12$). | `backend/tests/test_privacy_and_health.py` (3 tests) |
| **Privacy Redaction** | Real-time Haar face and vehicle license plate localization with irreversible $31\times 31$ Gaussian blur. | `backend/tests/test_privacy_and_health.py::test_privacy_anonymizer_blur_execution` |
| **Persistent Edge Queue** | Durable SQLite FIFO buffer (`edge_queue.db`) that survives network severance, power interruptions, and process crashes with zero event loss. | `backend/tests/test_edge_queue_resilience.py::test_edge_queue_lifecycle` |
| **Heading-Aware Clustering** | Compass heading delta check ($\Delta\theta > 120^\circ$ rejection) prevents merging opposing carriageways; dynamic GPS uncertainty radius ($2.0 \times \text{gps\_accuracy} \in [10\text{m}, 25\text{m}]$). | `backend/tests/test_spatial_clustering.py::test_opposite_carriageway_heading_separation` |
| **Fleet Multi-Pass Consensus** | Distinct bus tracking, Bayesian joint confidence escalation ($C = 1 - (1 - C_1)(1 - C_2)$), progression from `CANDIDATE` to `VERIFIED`. | `backend/tests/test_spatial_clustering.py::test_multipass_two_bus_verification_escalation` |
| **Explainable Priority Engine** | Formula-based score factoring severity, observation recurrence, bus diversity, defect persistence, and road hierarchy. | `backend/tests/test_api.py::test_get_issues` |
| **Closed-Loop Work Orders** | Automated BBMP-format PDF generation with embedded geocodes, severity ratings, audit trail hash, and maintenance lifecycle dispatch. | `backend/tests/test_work_orders.py::test_work_order_pdf_generation` |
| **Automated Clean-Pass Resolution** | $\ge 2$ consecutive clean passes by fleet buses reporting zero distress automatically promotes repaired issues to `RESOLUTION_VERIFIED`. | `backend/tests/test_work_orders.py::test_automated_clean_pass_resolution_verification` |
| **Post-Repair Defect Re-Opening** | If a defect is re-detected at a previously repaired coordinate, status automatically resets to `REPAIR_FAILED` / `REOPENED`. | `backend/tests/test_work_orders.py::test_reopen_on_new_defect_after_repair` |
| **Enterprise Security & RBAC** | Sliding-window IP rate limiting (100 req/60s), Bcrypt passwords, HMAC-SHA256 JWTs, 6 municipal roles enforced on backend. | `backend/tests/test_auth_rbac.py`, `backend/tests/test_security_redteam.py` |
| **Live Database Analytics API** | Dialect-aware aggregation (`date_trunc` on PostgreSQL, `strftime` on SQLite) via `/api/v1/analytics/overview`. | `backend/tests/test_api.py::test_analytics_endpoints` |

---

## 3. What is Partially Working (PARTIAL)

| Feature | Current State | Limitation / Next Step |
| :--- | :--- | :--- |
| **Route Corridor Snapping** | Orthogonal projection onto synthetic polyline segments in `event_service.py`. | Production deployment requires importing official BBMP/BMTC GIS road centerline shapefiles. |
| **Physical Fleet In-Situ Testing**| Validated with test footage and RDD2022 dataset under 12 simulated optical conditions. | Physical mounting on BMTC bus fleet requires municipal authority hardware procurement. |
| **PostGIS Geography Indexes** | Schema and dialect types configured for PostGIS `Geography(POINT, 4326)`; SQLite Haversine fallback active in local testing. | Live PostGIS requires external PostgreSQL 15 container with `postgis` extension enabled. |

---

## 4. Demo-Only Features (DEMO ONLY)

| Feature | Implementation Mode | Purpose |
| :--- | :--- | :--- |
| **Bangalore Seed Fleet (5 Buses)** | Seeded in `src/data.ts` and `database.py` traversing Routes 201-C, 500-D, 335-A. | Provides realistic GIS movement and spatial density during live demonstration without requiring live transit GPS streams. |
| **16-Step SIH Walkthrough Scenario** | Deterministic scripted progression in `src/components/DemoMode.tsx`. | Allows evaluators to witness the full 90-second detection-to-resolution lifecycle on demand. |

---

## 5. Planned Features (FUTURE ROADMAP)

- Integration with official Karnataka KSRTC / BMTC Intelligent Transport System (ITS) GPS feeds.
- Asphalt defect thermal imagery integration for subsurface void detection before surface collapse.
- 3D road surface reconstruction using stereo transit cameras for IRC-standard rut depth volumetric calculation.

---

## 6. Test Results Summary

```
====================== 34 passed, 18 warnings in 18.73s =======================
```
- **Backend Unit & Integration Tests:** 34 / 34 PASSED (`pytest backend/tests/ -v`)
- **End-to-End System Integration:** 9 / 9 PASSED (`python scripts/e2e_verify.py`)
- **Frontend TypeScript Typecheck:** 0 Errors (`npm run typecheck`)
- **Frontend Production Build:** Success in 8.45s (`npm run build`)

---

## 7. Model Results Summary

See [docs/MODEL_EVIDENCE.md](./MODEL_EVIDENCE.md) for full parameters.
- **Model Checkpoint:** `backend/rdd_yolov8n.pt` (5.93 MB)
- **Architecture:** YOLOv8 Nano (16 classes)
- **CPU Inference Latency:** 28.3 ms (35.4 FPS)
- **Published RDD2022 Benchmark mAP@0.5:** 0.584 (Macro average)
- **Local Synthetic Ellipse Tests:** Appropriately classified as plumbing smoke tests, not production accuracy proof.

---

## 8. Known Limitations

1. **Monochrome / Vector Smoke Testing:** Deep convolutional networks trained on genuine asphalt textures do not detect vector shapes rendered on blank canvas.
2. **Heavy Night Glare:** Direct high-beam headlights from oncoming traffic can temporarily trigger the `DEGRADED` camera health state, causing detections to be flagged with lower validation scores.
3. **Puddle Reflections:** Still water reflecting sky texture can attenuate longitudinal crack edge gradients until surface water clears.

---

## 9. Environment Requirements

- **Runtime:** Python 3.10 to 3.12, Node.js 18+
- **Python Dependencies:** Explicitly declared in `backend/requirements.txt` (`fastapi`, `uvicorn`, `sqlalchemy`, `ultralytics`, `opencv-python`, `torch`, `reportlab`, `psycopg2-binary`)
- **Node Dependencies:** `package.json` with React 18, Vite 6, Tailwind CSS, Leaflet

---

## 10. Demo Instructions & Quick Start

```bash
# 1. Start Backend Server (Port 8001)
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001

# 2. Start Frontend GIS Dashboard (Port 5173 with proxy to 8001)
npm run dev

# 3. Run Deterministic End-to-End Smoke Test
python scripts/run_full_demo_validation.py
```

---

## 11. Evidence Commands

To verify any subsystem independently:
- **Test All Backends:** `python -m pytest backend/tests/ -v`
- **Verify End-to-End Flow:** `python scripts/e2e_verify.py`
- **Verify Model Inference:** `python models/inference.py --model backend/rdd_yolov8n.pt`
- **Verify Edge Offline Queue:** `python -m pytest backend/tests/test_edge_queue_resilience.py -v`
- **Verify Heading Separation:** `python -m pytest backend/tests/test_spatial_clustering.py -v`
- **Verify Work Orders & Clean Passes:** `python -m pytest backend/tests/test_work_orders.py -v`
