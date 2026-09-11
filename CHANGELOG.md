# Changelog

All notable changes to the UrbanPulse platform are documented in this file.

## [v1.1.0-enhancement-pass] - September 2026

### Security, Integrity & Backend Foundations
- **Cookie-Based Browser Authentication**: Replaced frontend JWT localStorage storage with httpOnly, SameSite="lax", Secure-in-production `access_token` session cookies. Bearer token authentication remains intact for mobile and edge probe units.
- **Double-Submit CSRF Protection**: Added CSRF cookie generation and `X-CSRF-Token` header verification using `secrets.compare_digest()` for all state-changing HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`).
- **Demo Credential Hygiene**: Removed embedded production passwords from `backend/app/core/security.py`, `src/components/RoleSwitcher.tsx`, and `mobile/src/screens/LoginScreen.tsx`. Scrubbed demo passwords from `GET /api/v1/auth/demo-accounts` in production environments; quick role switching is strictly restricted to development/test fixtures (`import.meta.env.DEV` and `__DEV__`).
- **Alembic Database Migrations**: Replaced legacy `create_all` and inline `ALTER TABLE` DDL with dialect-aware async Alembic migrations (`backend/alembic/versions/0001_initial_schema.py`). Supports both SQLite and PostgreSQL/PostGIS with batch rendering and thread pool execution.
- **Idempotent Database Seeding**: Updated `seed_initial_data()` to be strictly idempotent without overwriting existing records, preserving the single Amravati factory source.
- **WebSocket Cookie Authentication & Client Delivery**: Added cookie fallback authentication to `/ws/live-feed`. Implemented comprehensive `ConnectionManager.can_deliver()` unit test matrix and client disconnect isolation tests.

### Web & Mobile Experience
- **Shared Design Tokens**: Created unified design token foundations in `src/theme/tokens.ts` and mirrored React Native tokens in `mobile/src/theme/tokens.ts` (dark surfaces `#0a0f1d`, `#0e1321`, `#161b2a`, cyan primary action `#06b6d4`, `#0891b2`, semantic severity indicators, and 44x44pt touch targets).
- **Command Dashboard Hero Signal**: Refactored `CommandDashboard.tsx` to elevate "Verified Issues Requiring Action" as the single prominent hero signal while demoting competing secondary statistics.
- **Intentional UI States**: Added explicit loading, empty, offline, and retry view states across `CommandDashboard.tsx`, `MapView.tsx`, `HistoryScreen.tsx`, and `LoginScreen.tsx`.
- **Camera HUD Enhancements**: Added top and bottom translucent gradient scrims, high-contrast label pills, severity-consistent bounding boxes, and achieved capture rate displays (`Achieved: X.X fps | Interval: X.Xs`) in `CVDemo.tsx` and `LiveScanScreen.tsx`.

### Mobile Resilience & Real-Time Delivery
- **Queue Ceiling & Evidence Preservation**: Enforced a strict 500-entry SQLite ceiling in `mobile/src/services/offlineQueue.ts` with prominent "Queue Full (500/500)" UI warnings in `LiveScanScreen.tsx` and `HistoryScreen.tsx` without dropping existing captured evidence.
- **Capture Pacing Hysteresis**: Replaced `setInterval` in `LiveScanScreen.tsx` with chained `setTimeout` scheduling inside frame `finally` blocks. Maintained a 5-frame rolling latency buffer that backs off interval from 1.0s to 1.5s after 5 consecutive slow frames and restores 1.0s after 10 consecutive fast frames.
- **iOS Viewfinder Flash**: Implemented non-audio translucent white viewfinder flash animation upon capture on iOS (`Platform.OS === 'ios'`).
- **Route Corridor Default**: Stored configured route corridor in `MobileAPI` and defaulted `subscribeLiveFeed` to the configured route when corridor is omitted.

### Client Hygiene & Automated Testing
- **Consolidated Web API Client**: Refactored `src/api/client.ts` to route all requests (including PDF work order downloads) through a unified `requestRaw` helper with timeout handling, credentials, and CSRF token propagation.
- **Web Client Unit Test Suite**: Added 17 automated tests in `src/api/__tests__/client.test.mjs` executed via `node:test` runner (`npm test`), covering storage hygiene, CSRF injection, timeout aborts, auth flows, all migrated API endpoints, data normalization, and a truth-in-reporting regression test verifying explicit LIVE fallback banner triggering.
- **Production Bundle Hygiene**: Completely eliminated hardcoded demo passwords from frontend and mobile bundles; dynamically fetches dev credentials only when `import.meta.env.DEV` or `__DEV__` is active.
- **Active Model Verification**: Documented `models/sabiq_yolo.pt` (44.0MB) as the specialized road defect detection model and `models/rdd_yolov8n.pt` (6.21MB) as the canonical edge model.
- **Mobile Queue Loop Recovery**: Fixed capture loop to chain next interval tick even on 500/500 queue full condition so buffering resumes automatically after replay.

---

## [v1.0.0-hardened] - September 2026

### Security & Authentication Hardening
- **Secrets Management**: Removed hardcoded production fallback keys in `backend/app/config.py`. Added fail-fast environment validation (`validate_production_secrets`) that aborts startup if default secrets are used in production.
- **Timing Attack Mitigation**: Replaced standard string equality comparison for `X-Edge-Device-Key` with constant-time `secrets.compare_digest()` in `backend/app/core/security.py`.
- **Memory Leak Fix in Rate Limiter**: Added idle client IP eviction and sliding window purge (`_cleanup_expired`) in `RateLimitMiddleware` to prevent unbounded memory growth over long-running sessions.
- **Token Security**: Replaced persistent `localStorage` with `sessionStorage` in `src/api/client.ts` to reduce XSS token exposure window.

### Data Integrity & Truth-in-Reporting
- **Unambiguous LIVE Mode Failures**: Added high-visibility warning banners in `src/App.tsx` when the backend is unreachable, explicitly notifying operators when fallback demonstration data is being rendered rather than silently disguising it as live telemetry.
- **Truthful Observation Attribution**: Eliminated synthetic vehicle registration numbers (`BUS-KA01-001`, `002`) in `src/api/client.ts`. Replaced with honest fleet observation indices or verified probe identifiers.
- **Deduplicated Seed Data**: Extracted shared factory functions `get_amravati_buses()` and `get_amravati_issues()` in `backend/app/database.py`, eliminating duplicate hardcoded seed arrays.
- **Migration Error Handling**: Replaced bare `except Exception: pass` in `backend/app/database.py` with targeted exception inspection and logging.

### Computer Vision & Model Optimization
- **Active Production Model**: Loaded `models/sabiq_yolo.pt` (42 MB) trained on real-world asphalt distress (`Pothole`, `crack`, `other corruption`).
- **Binary Weight Cleanup**: Removed duplicate weights `backend/rdd_yolov8n.pt` and obsolete generic COCO model `backend/yolov8n.pt`, consolidating all weights into canonical `models/`.
- **Video Detection Pipeline**: Implemented real-time video defect detection with interactive controls (play/pause, seek scrubber, frame-stepping, loop toggle) and clamped 640px canvas capture (<5ms overhead).

### Code Quality & Performance
- **Unified API Client**: Created a shared `request()` helper in `src/api/client.ts` with consistent timeout handling via `AbortSignal.timeout()`.
- **React Memoization**: Replaced inline IIFE calculations with `useMemo` in `src/App.tsx` for `activeIssues` and `activeBuses`.
- **Tab-Aware Polling**: Configured live telemetry polling to pause automatically when the browser tab is hidden (`document.hidden`).
- **Package Metadata**: Renamed project in `package.json` to `urbanpulse`.
- **Documentation Consolidation**: Archived 32 redundant internal milestone markdown files into `archive/audit_reports/` and consolidated system truth into `STATUS.md` and `CHANGELOG.md`.
