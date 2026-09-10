# UrbanPulse Phase 0 — Baseline Reproduction Report

**Date:** 2026-09-08  
**Project:** UrbanPulse — AI-Powered Mobile Urban Intelligence Platform (SIH26124)  
**Organization:** Bharat Electronics Limited (BEL)  
**Evaluator Baseline Score:** 69.5 / 100 (Level 3 — Functional Prototype)

---

## 1. System Status Audit

### FRONTEND STATUS: PARTIALLY WORKING (PROTOTYPE UI)
- **Framework:** React 18.2.0 + TypeScript 5.7.0 + Vite 6.4.3 + TailwindCSS 4.1.7.
- **Typecheck (`tsc --noEmit`):** PASS (0 errors).
- **Build (`vite build`):** PASS (production build in 5.25s).
- **Runtime:** Vite dev server running on `http://localhost:3000`.
- **Data Source:** Hardcoded mock arrays from `src/data.ts` (`simulatedEvents`, `simulatedBuses`).
- **Defect:** Frontend does not communicate with any live backend API. All state transitions, filtering, and priority scores reflect static in-memory objects.

### BACKEND STATUS: BROKEN / UNRUNNABLE
- **Framework:** FastAPI 0.141.1 + Pydantic 2.12.5 + SQLAlchemy 2.0.48.
- **Import Error:** `ModuleNotFoundError: No module named 'psycopg2'`.
- **Connection Config:** Hardcoded to `postgresql://postgres:postgres@localhost:5432/urbanpulse` without driver specification (`+asyncpg`) and without fallback.
- **Execution:** Backend process fails on startup.

### DATABASE STATUS: OFFLINE / UNREACHABLE
- **Target:** PostgreSQL + PostGIS on `localhost:5432`.
- **Port 5432 Test:** Failed (`TcpTestSucceeded = False`). No PostgreSQL instance is active on the machine.
- **Migrations:** Alembic configured for PostGIS, but cannot run without an active PostgreSQL service.
- **Defect:** No SQLite/embedded fallback is implemented, making local testing, evaluation, and CI impossible without an external DB daemon.

### COMPUTER VISION STATUS: HEURISTIC CANVAS ONLY (NO DEEP LEARNING)
- **Implementation:** `src/cv/RoadDefectDetector.ts`.
- **Method:** 2D Canvas pixel manipulation — grayscale conversion ($0.299R + 0.587G + 0.114B$), 3x3 Gaussian blur, adaptive thresholding ($C=10, \text{block}=25$), and connected component bounding box estimation.
- **Defect:** Misleadingly labeled in architecture as deep learning / YOLOv8. No real weights, no tensor operations, zero generalization to real road conditions, lighting shifts, or textures.

### API STATUS: UNTESTED / UNREACHABLE
- **Endpoints Defined:** `backend/app/api/` contains `events.py`, `issues.py`, `fleet.py`, `analytics.py`.
- **Status:** Uncallable due to backend startup failure.
- **Security:** Endpoints lack real authentication; no Bearer token validation or role-based access control (RBAC) middleware is enforced.

### INTEGRATION STATUS: DISCONNECTED
- **Frontend ↔ Backend:** 0% integration. Frontend does not invoke `fetch` or Axios against backend routes.
- **CV ↔ PostGIS:** 0% integration. Canvas detections remain inside the browser memory.

### SECURITY STATUS: VULNERABLE / INCOMPLETE
- **Auth:** No JWT validation on event ingestion or issue management.
- **Input Sanitization:** Relies solely on Pydantic schemas without rate limiting enforcement or role authorization.
- **Privacy:** Face and license plate blurring are documented as "privacy-by-design" but have 0 executable lines of blurring code.

### TEST STATUS: NO AUTOMATED TESTS
- **Test Suite:** 0 test files in repository.
- **Coverage:** 0%.
- **Verification:** Only manual browser viewing of mock UI.

---

## 2. Summary Baseline Matrix

| Component | Target Architecture | Baseline State | Health |
|---|---|---|---|
| Frontend UI | React Municipal Dashboard | Functional with mock data | ⚠️ Warning |
| Backend API | FastAPI + Uvicorn | Crashes on import (`psycopg2`) | ❌ Failed |
| Database | PostgreSQL + PostGIS | No server on port 5432 | ❌ Failed |
| CV Engine | YOLOv8 Road Defect Detector | Canvas threshold heuristic | ❌ Non-ML |
| Integration | Edge → API → DB → UI | 100% disconnected | ❌ Disconnected |
| Auth & RBAC | JWT + Multi-role RBAC | Unimplemented / Unenforced | ❌ Vulnerable |
| Privacy | Edge face/plate blurring | Documented claim only | ❌ Missing |
| Resilience | Durable SQLite edge queue | In-memory array (lost on crash) | ❌ Volatile |
| Test Suite | Pytest + End-to-End Suite | 0 tests exist | ❌ None |

---

## 3. Immediate Action Plan
Proceed to **Phase 1: Real Improvement Backlog** to prioritize engineering tasks from Critical to Low.
