# Changelog

All notable changes to the UrbanPulse platform are documented in this file.

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
