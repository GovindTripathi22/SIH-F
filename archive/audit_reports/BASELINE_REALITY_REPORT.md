# UrbanPulse — Phase 0 Baseline Reality Report

**Execution Timestamp:** 2026-09-08T19:25:00+05:30  
**Evaluator:** UrbanPulse Lead Systems Architect & Red-Team Evaluator  
**Problem Statement:** SIH26124 (BEL — Mobile Urban Intelligence via Public Fleet)  
**Initial Baseline Score:** 69.5 / 100 (Level 3 Prototype)

---

## 1. Executive Summary & Core Verdict

A comprehensive empirical inspection of the UrbanPulse codebase was executed before making code modifications. The platform possesses strong foundational software engineering (a working FastAPI backend, JWT authentication, sliding-window rate limiting, SQLite persistent edge queue, ReportLab PDF work order generation, Leaflet map views, and an automated verification script). 

However, critical technical weaknesses and dishonest approximations directly threaten SIH technical credibility:
1. **P0 AI Defect Invalidation:** The primary computer vision engine (`backend/app/services/cv_service.py`) claimed to execute a YOLOv8 road defect detector, but was actually executing standard generic COCO 80-class weights (`yolov8n.pt`). Line 122 performed modulo remapping `class_label = ROAD_DEFECT_CLASSES.get(cls_id % len(ROAD_DEFECT_CLASSES), "pothole")`, which mapped COCO class 0 (`person`) to `pothole`, and COCO class 29 (`frisbee`) to `manhole_defect`. Furthermore, `cv_engine/evaluate.py` contained hardcoded `else: tp += 1` branches that fabricated evaluation scores.
2. **P1 Spatial False Merging:** `MultiPassVerificationEngine` merged detections within a fixed 20-meter radius regardless of vehicle heading or carriageway separation, risking erroneous consolidation of opposite-direction road observations.
3. **P1 Analytics Crash on SQLite:** `/api/v1/analytics/traffic` crashed with HTTP 500 on the local SQLite deployment due to PostgreSQL-specific functions (`date_trunc`, `extract('epoch')`), preventing frontend analytics integration.
4. **P1 Frontend Analytics Disconnection:** `src/components/AnalyticsPanel.tsx` bypassed the backend API entirely, deriving charts from static mock arrays in `src/data.ts`.
5. **P1 Closed-Loop Repair Verification Incomplete:** While state transitions to `RESOLUTION_VERIFIED` existed, automated multi-pass verification of clean transit runs (confirming absence of defects post-repair across distinct bus passes) was not formalized.

---

## 2. Subsystem Reality Matrix (Phase 0 Audit)

| Component | File / Location | Claimed Behavior | Actual Behavior | Execution Path | Status | Evidence | Identified Defect | Priority |
|---|---|---|---|---|---|---|---|---|
| **YOLOv8 Edge AI** | `backend/app/services/cv_service.py` | Genuine road defect detection (potholes, cracks) via YOLOv8n | Loads COCO 80-class weights; remaps detections via `cls_id % 6` | `FastAPI -> /api/v1/cv/detect -> RoadDefectYOLOEngine -> YOLO(yolov8n.pt)` | **BROKEN / DISHONEST** | Class inspection shows `{0: 'person', 29: 'frisbee', ...}`. Ellipse test yielded class 29 (`frisbee`) mapped to defect. | Dishonest class remapping; COCO model used for road defects. | **P0** |
| **CV Evaluation Harness** | `cv_engine/evaluate.py` | Rigorous mAP, Precision, Recall benchmark on road conditions | Artificially increments `tp += 1` on missing detections; hardcodes `mAP@0.5: 0.842` | `cv_engine/evaluate.py -> MODEL_EVALUATION.md` | **SIMULATED / DISHONEST** | Lines 136-137: `else: tp += 1 # Recorded detection`. | Fake evaluation metrics; dishonest claim of 84.2% mAP. | **P0** |
| **Edge Anonymization** | `backend/app/services/privacy_service.py` | Irreversible blurring of human faces and license plates | Genuine Haar Cascades with Gaussian blurring | `cv_service.py -> PrivacyAnonymizer.anonymize_frame` | **REAL** | OpenCV `CascadeClassifier` executes blur with kernel size proportional to face/plate width. | Documented as "DPDP compliant" without legal audit qualification. | **P2** |
| **Camera Health Optics** | `backend/app/services/camera_health_service.py` | Detection of blur, exposure faults, and lens obstruction | Real Laplacian variance, brightness mean, and contrast std | `cv_service.py -> CameraHealthService.evaluate_frame_quality` | **REAL** | Frame with blocked/dark surface returns `data_quality: 'UNUSABLE'`, setting `validation_score: 0.40`. | Works as intended. | **P3** |
| **Durable Edge Queue** | `backend/app/edge/persistent_queue.py` | Zero event loss during network failure; survives power off | SQLite FIFO queue with ACID transactions, atomic ACK, and crash recovery | `PersistentEdgeQueue.enqueue -> SQLite disk table` | **REAL** | Survived simulated process crash and power-cycle test in `test_edge_queue_resilience.py`. | Works as intended. | **P3** |
| **Spatial Clustering** | `backend/app/services/spatial_clustering.py` | Multi-pass fleet verification combining multi-bus passes | Bounding-box + Haversine distance clustering; Bayesian confidence update | `EventService.create_event -> MultiPassVerificationEngine.ingest_event_into_cluster` | **PARTIAL** | Upgrades CANDIDATE to VERIFIED after 2 buses. However, merges opposite lanes (no heading check). | Lacks vehicle heading or lane discriminator; risk of false merging. | **P1** |
| **GPS Map Snapping** | `backend/app/services/gps_service.py` | GPS validation, outlier rejection, corridor snapping | Validates coordinates, rejects Null Island (0,0), calculates vector cross-track projection | `GPSService.snap_to_route_segment` | **REAL** | Vector projection and Haversine math validated. | Not actively chained during ingestion for raw events. | **P2** |
| **Municipal PDF Generation** | `backend/app/services/work_order_service.py` | Formal PDF dispatch order for civic road maintenance | ReportLab document generation with audit trail and multi-pass stats | `POST /api/v1/work-orders/pdf -> WorkOrderService.generate_pdf_work_order` | **REAL** | Returns valid `%PDF-` binary with BBMP header and cryptographic layout (3.5 KB). | Functional. | **P3** |
| **Closed-Loop Lifecycle** | `backend/app/services/work_order_service.py` | Maintenance tracking: CANDIDATE -> VERIFIED -> IN_PROGRESS -> REPAIRED -> RESOLUTION_VERIFIED | State machine enforces valid municipal transitions; logs audit history | `POST /api/v1/work-orders/lifecycle` | **PARTIAL** | Status transitions work; however, automated multi-pass clean observation confirmation is missing. | Does not automatically verify repair through repeated clean transit runs. | **P1** |
| **Explainable Priority** | `backend/app/services/priority_engine.py` | Multi-factor explainable scoring with human-readable rationale | Configurable weights (confidence, diversity, recurrence, age, severity) | `PriorityEngine.calculate_priority` | **REAL** | Returns structured breakdown with human-readable reasons list. | Disconnected from `spatial_clustering.py` inline priority calculation. | **P2** |
| **Authentication & RBAC** | `backend/app/core/security.py` | JWT tokens with role-based permissions (ADMIN, PWD, FIELD, VIEWER) | Bcrypt password hashing, HS256 signed JWTs, role dependency guards | `FastAPI Depends(require_roles(...))` | **REAL** | 4 tests in `test_auth_rbac.py` pass; rejects unauthorized state transitions. | Functional. | **P3** |
| **API Rate Limiting** | `backend/app/middleware/rate_limit.py` | Sliding window rate limiting to thwart DoS & telemetry flooding | Sliding window in-memory tracking by client IP; returns HTTP 429 | `RateLimitMiddleware.dispatch` | **REAL** | Tested and verified in red-team security tests. | Functional. | **P3** |
| **Database & Migrations** | `backend/app/database.py`, `backend/migrations/` | PostGIS spatial database with SQLite fallback | Dual mode: PostGIS WKT/geometry when on PostgreSQL, bounding box on SQLite | `database.py -> init_db()` | **REAL** | Automatic schema initialization with demo seeds. | Functional. | **P3** |
| **Traffic Analytics API** | `backend/app/api/analytics.py` | Hourly telemetry aggregation and traffic congestion indices | Queries fail with HTTP 500 on SQLite due to `date_trunc` and `extract` calls | `GET /api/v1/analytics/traffic` | **BROKEN** | Verified HTTP 500 error when called against SQLite. | SQLite incompatible SQL functions. | **P1** |
| **Frontend Live Integration** | `src/App.tsx`, `src/api/client.ts` | React UI reads directly from backend API | Periodic polling (6000ms) syncs `/api/v1/issues` and `/api/v1/fleet/buses` | `App.tsx -> apiClient.getIssues() -> setIssues()` | **REAL** | UI updates when backend responds; shows green "POSTGIS LIVE BACKEND" badge. | Analytics tab remains hardcoded to mock arrays. | **P2** |
| **Frontend Analytics Panel** | `src/components/AnalyticsPanel.tsx` | Live fleet metrics and defect distribution charts | Imports `simulatedEvents` from `src/data.ts`; completely static | Client-side render only | **MOCK** | Line 2 imports `simulatedEvents`; no API fetch executed. | Production view displaying fake simulated charts. | **P1** |
| **Temporal Video Validation** | `src/cv/temporal/TemporalValidator.ts` | Multi-frame IoU tracking and persistence filtering | Pure TypeScript IoU tracking, Kalman/displacement filter, candidate generator | Client-side Canvas execution | **REAL** | Tracks bounding boxes across frames; filters transient false positives. | Functional. | **P3** |
| **End-to-End Test Suite** | `scripts/e2e_verify.py` | Automated 9-step integration verification | Tests health, Bus A ingestion, candidate clustering, Bus B consensus, PDF generation, lifecycle, CV, queue | Python script running against `http://127.0.0.1:8001` | **REAL** | All 9 steps passed 100% in 2.2s. | Step 8 previously passed only due to modulo remapping of synthetic shape. | **P1** |
| **Pytest Backend Suite** | `backend/tests/` | Unit and integration test coverage | 30 test cases across auth, edge queue, failures, privacy, spatial, and work orders | `pytest backend/tests/` | **REAL** | 30 passed in 12.5s. | Passes, but does not test real road defect model accuracy. | **P2** |

---

## 3. Environment & Build Baseline Audit

1. **Python Environment:**
   - Python version: 3.12.10 (win32)
   - Packages: FastAPI, SQLAlchemy, Ultralytics (YOLOv8), OpenCV, PyTorch, ReportLab, Bcrypt, PyJWT/Jose, Pydantic v2.
   - Status: All dependencies satisfied.
2. **Frontend Environment:**
   - Node.js / Vite v6.4.3 / TypeScript v5.7.0
   - `npm run typecheck`: **0 errors (Exit code 0)**
   - `npm run build`: **Built in 5.29s (Exit code 0)**
3. **Backend Server Status:**
   - Active on `http://127.0.0.1:8001`.
   - `/health` endpoint responds with status `healthy`, database status `ONLINE`, and verified issues loaded.

---

## 4. Phase 0 Audit Conclusion

UrbanPulse has high engineering rigor in its scaffolding, but was severely compromised by **fake road defect AI** and **hardcoded analytics**. Remediating the AI model with genuine road-defect weights (RDD2022 dataset), eliminating dishonest class mappings, fixing SQLite analytics queries, wiring frontend analytics to backend data, enhancing spatial clustering with heading constraints, and formalizing clean-pass repair verification are the immediate P0/P1 objectives.
