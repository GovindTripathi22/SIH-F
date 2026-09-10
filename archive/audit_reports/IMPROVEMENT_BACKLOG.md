# UrbanPulse Engineering Improvement Backlog

**Version:** 1.0.0  
**Generated:** 2026-09-08  
**Prioritization Formula:** Credibility Risk → Core Functionality → Safety/Privacy → Integration → Reliability → Performance → UX → Presentation.

---

## Priority Class: CRITICAL (Show-stoppers / Integrity Risks)

### CRIT-01: Heuristic Canvas Thresholding Misrepresented as YOLO AI Detection
- **Issue:** Detection path in `src/cv/RoadDefectDetector.ts` uses 2D canvas pixel luminance thresholding and connected components, yet documentation and UI claim YOLOv8 deep learning.
- **Root Cause:** Placeholder implementation was never swapped for a real deep-learning inference pipeline with weights.
- **File(s):** `src/cv/RoadDefectDetector.ts`, `backend/app/services/cv_service.py` (new), `backend/app/api/cv.py` (new), `src/components/CVDemo.tsx`.
- **Technical Fix:** Implement a real YOLOv8 detection engine in Python (`ultralytics`) with real road defect weights, ONNX export/runtime inference, bounding box extraction, confidence scores, real-time FPS calculation, and an API endpoint `POST /api/v1/cv/detect` allowing frames and videos to be processed with deep learning. Integrate client-side model runner / API mode so judges see genuine tensor inference.
- **Dependencies:** `torch`, `ultralytics`, `onnxruntime`, `opencv-python`.
- **Risk:** High (model loading or inference latency on weak CPU).
- **Test Required:** Run real inference on sample road video/frames, measure inference time (ms) and FPS, verify non-empty bounding boxes and class labels (`pothole`, `crack`).
- **Expected SIH Benefit:** Eliminates #1 credibility risk; delivers genuine deep-learning edge AI execution.

### CRIT-02: Backend Unrunnable Due to Missing Driver and Fixed PostgreSQL Requirement
- **Issue:** Backend fails to start with `ModuleNotFoundError: No module named 'psycopg2'`, and crashes if PostgreSQL is not running on port 5432.
- **Root Cause:** `database.py` and `config.py` hardcode a standard `postgresql://` URI without async driver specification and without fallback to an embedded database like SQLite/aiosqlite.
- **File(s):** `backend/app/config.py`, `backend/app/database.py`, `backend/app/models/event.py`, `backend/app/models/issue.py`.
- **Technical Fix:** Implement hybrid database architecture:
  1. Detect database URL; support `sqlite+aiosqlite:///./urbanpulse.db` out of the box when PostgreSQL is unavailable.
  2. Implement dialect-aware spatial columns (use GeoAlchemy2 Geography when PostgreSQL/PostGIS is present, and clean Float lat/lon + spatial math helpers when running SQLite).
  3. Ensure seamless database initialization, table creation, and seeding.
- **Dependencies:** `aiosqlite`, `sqlalchemy`, `shapely`.
- **Risk:** Dialect differences in spatial queries.
- **Test Required:** `pytest backend/tests/test_database.py`, verify table creation, event insertion, query execution.
- **Expected SIH Benefit:** Backend starts in seconds on any evaluator machine without external DB dependencies.

### CRIT-03: Frontend Disconnected from Backend API (Uses Static Client Mock Data)
- **Issue:** Dashboard UI directly reads from `src/data.ts` arrays (`simulatedEvents`, `simulatedBuses`). Changes made in UI or backend do not sync.
- **Root Cause:** API client was never wired into the React state management.
- **File(s):** `src/api/client.ts` (new), `src/App.tsx`, `src/components/CommandDashboard.tsx`, `src/components/GISIntelligenceLayer.tsx`, `src/components/EventList.tsx`.
- **Technical Fix:** Create a typed API client in `src/api/client.ts` with Axios/fetch methods for `getIssues`, `getEvents`, `postEvent`, `updateIssueStatus`, `getBuses`, `getAnalytics`, `getHealth`. Update `App.tsx` and main views to fetch from the backend API with graceful fallback to cached/demo data if offline, with live status indicators.
- **Dependencies:** Native `fetch` / typed TypeScript interfaces.
- **Risk:** Latency or network disruption causing empty UI state.
- **Test Required:** Network tab inspection, verified API requests, creation of a new event via API appearing in the dashboard.
- **Expected SIH Benefit:** Full end-to-end integration: React → FastAPI → Database → React.

### CRIT-04: Multi-Pass Verification Simulated on Client Rather Than PostGIS/Backend Logic
- **Issue:** Fleet multi-pass verification (merging observations from multiple buses) is executed via client-side simulated state rather than real spatial aggregation in the backend.
- **Root Cause:** Spatial matching logic was never implemented inside the backend event ingestion pipeline.
- **File(s):** `backend/app/services/event_service.py`, `backend/app/services/issue_service.py`, `backend/app/services/spatial_clustering.py` (new), `backend/app/api/events.py`.
- **Technical Fix:** Move spatial-temporal clustering into backend service. When `POST /api/v1/events` is invoked, query existing candidate/supported issues within configurable spatial radius (e.g. 15m) and temporal window. If match found, link observation, update distinct bus count, recalculate confidence and priority, and escalate verification state (`CANDIDATE` → `SUPPORTED` → `VERIFIED`). If no match, create new `CANDIDATE` issue.
- **Dependencies:** `shapely`, `haversine`, `sqlalchemy`.
- **Risk:** Boundary condition inaccuracies in distance calculations.
- **Test Required:** Inject Event 1 from Bus A, then Event 2 from Bus B at 8m distance; verify distinct bus count becomes 2 and status advances to `VERIFIED`.
- **Expected SIH Benefit:** Defensible multi-pass consensus backed by backend spatial algorithms.

---

## Priority Class: HIGH (Core Functionality & Safety/Privacy)

### HIGH-01: Privacy Anonymization Not Executing on Ingested Frames
- **Issue:** Documentation claims automatic blurring of faces and vehicle license plates to protect citizen privacy, but no blurring code executes.
- **Root Cause:** Privacy module was left as a schematic placeholder.
- **File(s):** `backend/app/services/privacy_service.py` (new), `src/cv/PrivacyFilter.ts` (new).
- **Technical Fix:** Implement real OpenCV-based face and license plate detection and Gaussian/pixelation anonymization filter. Apply before saving or transmitting evidence frames.
- **Dependencies:** `opencv-python`, `numpy`.
- **Risk:** Overhead on edge frame processing.
- **Test Required:** Run privacy filter on test image with human face / license plate; verify regions are blurred and irreversible.
- **Expected SIH Benefit:** Realizes true Privacy-by-Design defense for public transport cameras.

### HIGH-02: Missing Real Authentication and Role-Based Access Control (RBAC)
- **Issue:** Any unauthenticated client can post events or modify municipal issue statuses.
- **Root Cause:** FastAPI security dependencies (`OAuth2PasswordBearer`, JWT verification) were stubbed out without active route guards.
- **File(s):** `backend/app/core/security.py` (new), `backend/app/middleware/auth.py` (new), `backend/app/api/auth.py` (new).
- **Technical Fix:** Implement JWT authentication with password hashing (`bcrypt`), token generation, and role checks for:
  - `ADMIN`
  - `TRANSPORT_OPERATOR`
  - `TRAFFIC_AUTHORITY`
  - `PWD_ENGINEER`
  - `FIELD_ENGINEER`
  - `VIEWER`
  Protect `POST /events`, `PATCH /issues/{id}/status`, and administrative endpoints.
- **Dependencies:** `python-jose`, `passlib`, `bcrypt`.
- **Risk:** Token expiration interrupting UI sessions.
- **Test Required:** Attempt unauthorized `PATCH /issues/1/status` → HTTP 401/403. Pass valid bearer token → HTTP 200.
- **Expected SIH Benefit:** Concrete municipal-grade enterprise security defense.

### HIGH-03: Edge Offline Resilience Only In-Memory (Lost on Refresh/Power Loss)
- **Issue:** `src/cv/ConnectivityResilience.ts` buffers events in a JavaScript array. A browser reload or device reboot loses all queued events.
- **Root Cause:** No persistent storage (IndexedDB on web, SQLite on edge device).
- **File(s):** `src/cv/PersistentEdgeQueue.ts` (new), `backend/app/edge/persistent_queue.py` (new).
- **Technical Fix:** Implement persistent FIFO queue using SQLite for Python edge daemon and IndexedDB / LocalStorage for browser demo. Support automatic exponential backoff retry upon network restoration, atomic ACK marking, and duplicate suppression.
- **Dependencies:** `sqlite3`, browser `indexedDB`.
- **Risk:** Queue bloat during prolonged disconnections.
- **Test Required:** Disconnect network, generate 10 events, restart queue engine, reconnect, verify all 10 events transmitted without loss or duplication.
- **Expected SIH Benefit:** Real industrial-grade edge resilience demonstration.

### HIGH-04: Closed-Loop Maintenance Lifecycle & Work Order Generation Missing
- **Issue:** System stops at "detected issue". There is no actionable work order generation or post-repair verification lifecycle.
- **Root Cause:** Workflow stopped at detection.
- **File(s):** `backend/app/services/work_order_service.py` (new), `backend/app/api/work_orders.py` (new), `src/components/WorkOrderModal.tsx` (new).
- **Technical Fix:** Build full closed-loop lifecycle:
  `DETECTED` → `VERIFIED` → `PRIORITY` → `ASSIGN` → `WORK_ORDER_GENERATED` → `IN_PROGRESS` → `REPAIRED` → `REOBSERVED` → `RESOLUTION_VERIFIED`.
  Add "GENERATE WORK ORDER" button generating a formal municipal PDF work order (using ReportLab) and downloadable JSON/CSV.
- **Dependencies:** `reportlab`.
- **Risk:** PDF layout rendering discrepancies across OSes.
- **Test Required:** Request work order generation for verified issue → download valid PDF with issue ID, coordinates, severity, map snippet, QR code, and signature fields.
- **Expected SIH Benefit:** Solves actual BEL / municipal problem statement: actionable maintenance closure.

---

## Priority Class: MEDIUM (Reliability, Scalability & Robustness)

### MED-01: No GPS Noise Handling, Outlier Rejection, or Map Snapping
- **Issue:** System trusts raw GPS coordinates blindly; urban canyons produce 10-30m drift.
- **File(s):** `backend/app/services/gps_service.py` (new).
- **Technical Fix:** Implement GPS quality assessment, Kalman/moving-average smoothing, outlier rejection ($>3\sigma$), and nearest road centerline snapping.
- **Test Required:** Inject jittered GPS tracks (5m, 10m, 20m, 30m error) and test cluster convergence.

### MED-02: Camera Degradation & Health Monitoring Unimplemented
- **Issue:** Blurred lenses, night darkness, or rain glares produce either false alarms or missed detections with no health warning.
- **File(s):** `backend/app/services/camera_health_service.py` (new), `src/cv/CameraHealth.ts` (new).
- **Technical Fix:** Implement real image quality metric: Laplacian variance for blur, histogram skew for under/over-exposure, obstruction mask detection. Set `data_quality: LOW` when degraded.
- **Test Required:** Test sharp vs blurred frames; verify camera health state shifts from `NORMAL` to `DEGRADED`.

### MED-03: Lack of Automated Test Suite and Verification Harness
- **Issue:** Zero test files in the codebase.
- **File(s):** `backend/tests/` (multiple test files), `scripts/e2e_verify.py` (new).
- **Technical Fix:** Write comprehensive Pytest suite for API, Auth, PostGIS/Spatial clustering, CV inference, and Failure recovery. Create deterministic end-to-end verification script.
- **Test Required:** Run `pytest backend/tests` and achieve 100% pass rate.

---

## Priority Class: LOW (Documentation & Presentation Polish)

### LOW-01: Scope Creep & Stale Claims in Documentation
- **Issue:** Documentation mentions unbuilt features like MQTT, Redis clusters, ANPR hit-and-run without active implementations.
- **File(s):** `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `DEPLOYMENT.md`, `MODEL_CARD.md`, `DATA_CARD.md`, `REFERENCES.md`.
- **Technical Fix:** Update all markdown documentation to accurately reflect actual running code, provide clear citations, and separate core MVP from future roadmap.
