# UrbanPulse — System Status & Verification Truth Matrix
**Problem Statement**: SIH26124 | Bharat Electronics Limited (BEL)  
**Platform**: UrbanPulse — AI-Powered Mobile Urban Intelligence Platform  
**Repository**: [GovindTripathi22/SIH-F](https://github.com/GovindTripathi22/SIH-F)  
**Last Audited**: September 2026 | Comprehensive Enhancement Pass Certified  

---

## 1. Executive Status Dashboard

UrbanPulse uses public transit fleets (buses) as continuous mobile edge sensing probes to detect road distress (potholes, cracks, surface corruption), corroborate observations across multiple vehicle passes, compute explainable priority scores, and dispatch official municipal work orders.

| Subsystem | Execution Path | Operational Status | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Edge Computer Vision** | `models/sabiq_yolo.pt` (44.0MB primary) & `models/rdd_yolov8n.pt` (6.21MB canonical edge) | ✅ **OPERATIONAL** | Real deep learning inference; ~28ms CPU latency (~35 FPS). Zero modulo remapping. |
| **Video & Stream Pipeline** | `src/components/CVDemo.tsx` | ✅ **OPERATIONAL** | Real-time letterbox overlay, frame scrubbing, 640px clamped canvas capture, gradient scrims & achieved rate HUD. |
| **Privacy Anonymization** | `backend/app/services/privacy_service.py` | ✅ **OPERATIONAL** | Haar cascade edge redaction (DPDP Act 2023) for faces and license plates prior to transmission. |
| **Camera Health Pre-Flight** | `backend/app/services/camera_health_service.py` | ✅ **OPERATIONAL** | Laplacian variance blur detection & luminance checks; flags degraded/low-light feeds. |
| **Fleet Spatial Clustering** | `backend/app/services/spatial_clustering.py` | ✅ **OPERATIONAL** | Dynamic Haversine/PostGIS clustering (15m radius, 45° heading separation, 72h window). |
| **Database Migrations** | `backend/alembic/` | ✅ **OPERATIONAL** | Async Alembic migrations (`0001_initial_schema.py`) replacing legacy inline DDL/create_all. |
| **Security & Auth Foundation** | `backend/app/core/security.py`, `backend/app/api/auth.py`, `src/components/RoleSwitcher.tsx` | ✅ **HARDENED** | HttpOnly SameSite session cookies + Double-Submit CSRF, zero password leaks in client bundles, dev-only role switcher. |
| **Real-Time WebSocket Feed** | `backend/app/api/websocket.py` | ✅ **OPERATIONAL** | Cookie/Bearer auth fallback, role/corridor subscription delivery matrix with client isolation. |
| **Closed-Loop Work Orders** | `backend/app/services/work_order_service.py` | ✅ **OPERATIONAL** | Consolidated ReportLab PDF work order generation and automated clean-pass resolution. |
| **Edge Resilience & Pacing** | `mobile/src/services/offlineQueue.ts`, `LiveScanScreen.tsx` | ✅ **OPERATIONAL** | 500-entry SQLite queue ceiling with automatic loop recovery, 5-frame latency hysteresis (1.0s ↔ 1.5s), timeout-chained scheduling, iOS flash. |
| **Frontend Command Deck** | `src/components/CommandDashboard.tsx` | ✅ **OPERATIONAL** | Hero metric "Verified Issues Requiring Action", Leaflet GIS matrix, intentional states (loading/offline/empty/RBAC-denied), LIVE fallback banner guardrail. |

---

## 2. Operational Modes & Truth-in-Reporting

The frontend operates in three clearly defined modes:

1. **LIVE MODE**:
   - Directly synchronizes with the FastAPI backend via REST and authenticated WebSockets.
   - **Truth-in-Reporting Guardrail**: If the backend is unreachable or disconnected, an explicit high-visibility warning banner alerts the user and displays cached demonstration data. It **never** silently disguises fake or cached data as live telemetry.
2. **DEMO MODE**:
   - Provides an interactive guided walkthrough demonstrating the full lifecycle from bus detection to PDF dispatch and repair verification.
3. **OFFLINE MODE**:
   - Demonstrates edge disconnection, local SQLite queue buffering (capped at 500 entries), and automatic synchronization upon network restoration.

---

## 3. Verified Automated Test Matrix

All 49 backend Pytest tests and 17 web client tests run and pass without mocks in production paths (66 total tests):

### Backend Pytest Suite (49 passed, 0 failed):
```bash
python -m pytest backend/tests/ -v
# 49 passed in 37.76s
```
- **Health Check & Model Metadata**: `test_api.py::test_health_check`, `test_cv_model_info`
- **Cookie Auth & Double-Submit CSRF**: `test_auth_rbac.py` (cookie session, double-submit CSRF enforcement, session clearing on logout, production demo password scrubbing)
- **WebSocket Delivery Matrix**: `test_websocket_feed.py` (role filtering, corridor subscriptions, unit matrix delivery, two-client isolation, cookie authentication)
- **Security Red-Team**: `test_security_redteam.py` (XSS, SQL injection, role escalation, oversized payload)
- **Spatial Consensus**: `test_spatial_clustering.py` (Bayesian corroboration, heading separation, corridor snapping)
- **Work Orders & PDF**: `test_work_orders.py` (ReportLab PDF generation, lifecycle transitions, automated clean pass)
- **Privacy & Camera Health**: `test_privacy_and_health.py` (face/plate redaction, blur/low-light flags)
- **Offline Resilience**: `test_edge_queue_resilience.py` (crash recovery, deduplication)

### Frontend Unit Suite (17 passed, 0 failed):
```bash
npm test
# 17 passed in 0.49s (node:test runner)
```
- **Storage Hygiene**: Validates legacy localStorage token purge on initialization.
- **CSRF Protection**: Verifies `credentials: 'same-origin'` and `X-CSRF-Token` attached to all state-changing requests.
- **Timeout Handling**: Validates `AbortController` triggers cleanly upon reaching timeout limits.
- **Authentication**: Validates in-memory session tracking and clean cookie session logout.
- **Error Semantics**: Validates accurate extraction of backend error `detail` strings.
- **Health Verification**: Validates health metadata parsing and graceful fallback on connection failure.
- **WebSocket Connectivity**: Validates protocol generation (`ws`/`wss`) and query parameter token propagation.
- **Data Ingestion & Mapping**: Validates `getIssues`, `getBuses`, and normalization to `RoadEvent` schema.
- **Edge Inference Submissions**: Validates `detectFrame` and `detectAndIngest` multi-part form submissions.
- **PDF Download Path**: Validates consolidated `requestRaw` pipeline returning valid PDF Blobs.
- **Work Order Lifecycle**: Validates authenticated issue status progression with user attribution.
- **Analytics Overview**: Validates analytics aggregation and resilient offline fallback synthesis.
- **Truth-in-Reporting Regression**: Enforces explicit fallback banner triggering when in LIVE mode with backend offline.

---

## 4. Historical Audit Reports Archive

All intermediate internal milestone audit reports from earlier development iterations are cataloged in:
[archive/audit_reports/](./archive/audit_reports/)
