# UrbanPulse REST API Documentation

**Version:** 1.0.0  
**Base URL:** `http://127.0.0.1:8001/api/v1`  
**OpenAPI Spec:** Available interactively at `/docs` and `/redoc`

---

## 1. Authentication Endpoints

### `POST /api/v1/auth/login`
Authenticate a municipal user and receive a signed JWT bearer token.

- **Request Body (JSON):**
  ```json
  {
    "username": "admin@urbanpulse.gov.in",
    "password": "AdminPassword123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 28800,
    "user": {
      "username": "admin@urbanpulse.gov.in",
      "full_name": "Chief Municipal Administrator",
      "role": "ADMIN",
      "department": "BBMP Municipal Administration"
    }
  }
  ```

### `GET /api/v1/auth/me`
Retrieve currently authenticated user profile.
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** User details object.

---

## 2. Event Ingestion Endpoints

### `POST /api/v1/events`
Ingest edge detection events from transit fleet buses. Triggers spatial clustering and multi-pass verification.

- **Request Body (JSON):**
  ```json
  {
    "event_id": "evt-b102-4821a",
    "latitude": 12.935200,
    "longitude": 77.614500,
    "timestamp": "2026-09-08T12:00:00Z",
    "bus_id": "BUS-KA01-01",
    "route_id": "route-500D",
    "camera_id": "cam-front-01",
    "event_type": "pothole",
    "confidence": 0.88,
    "validation_score": 0.91,
    "gps_accuracy_meters": 2.1
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": 14,
    "event_id": "evt-b102-4821a",
    "latitude": 12.9352,
    "longitude": 77.6145,
    "timestamp": "2026-09-08T12:00:00Z",
    "bus_id": "BUS-KA01-01",
    "route_id": "route-500D",
    "event_type": "pothole",
    "confidence": 0.88,
    "validation_score": 0.91,
    "processed": true
  }
  ```

### `GET /api/v1/events`
List paginated raw detection events with optional filtering.
- **Query Parameters:** `page`, `page_size`, `event_type`, `bus_id`, `route_id`.

---

## 3. Verified Issues & Spatial Queries

### `GET /api/v1/issues`
Paginated list of consolidated municipal issues.
- **Query Parameters:** `page`, `page_size`, `event_type`, `severity`, `priority`, `status`.
- **Response (200 OK):**
  ```json
  {
    "items": [
      {
        "id": 1,
        "issue_id": "issue-01",
        "centroid_latitude": 12.9352,
        "centroid_longitude": 77.6145,
        "event_type": "pothole",
        "severity": "SAFETY_HAZARD",
        "priority": "CRITICAL",
        "status": "VERIFIED",
        "observation_count": 5,
        "distinct_bus_count": 3,
        "confidence": 0.96,
        "verification_score": 0.92,
        "priority_score": 88.5
      }
    ],
    "total": 11,
    "page": 1,
    "page_size": 20
  }
  ```

### `GET /api/v1/issues/nearby`
Perform spatial radius lookup using PostGIS `ST_DWithin` or SQLite spatial bounding-box + Haversine.
- **Query Parameters:** `latitude` (float), `longitude` (float), `radius_meters` (float, default 500), `limit` (int).

### `GET /api/v1/issues/{issue_id}`
Get comprehensive issue details including all underlying observations and status transition history.

### `PATCH /api/v1/issues/{issue_id}/status`
Update municipal issue status (`PENDING`, `IN_PROGRESS`, `REPAIRED`, `RESOLUTION_VERIFIED`, `REJECTED`).

---

## 4. Computer Vision Inference

### `POST /api/v1/cv/detect`
Run live YOLOv8 deep-learning tensor inference on an uploaded image frame.
- **Form Data:**
  - `file`: Image binary (JPEG / PNG)
  - `confidence_threshold`: Float (default `0.35`)
  - `apply_privacy`: Boolean (default `true`)
- **Response (200 OK):**
  ```json
  {
    "detections": [
      {
        "class": "pothole",
        "confidence": 0.84,
        "box": { "x1": 150.2, "y1": 210.0, "x2": 280.5, "y2": 310.2, "width": 130.3, "height": 100.2 }
      }
    ],
    "detection_count": 1,
    "inference_latency_ms": 61.8,
    "fps": 16.2,
    "validation_score": 0.95,
    "camera_health": {
      "status": "NORMAL",
      "data_quality": "HIGH",
      "blur_laplacian_variance": 142.5,
      "mean_brightness": 128.4
    },
    "privacy": {
      "faces_anonymized": 0,
      "plates_anonymized": 1,
      "total_redactions": 1
    },
    "evidence_frame_base64": "data:image/jpeg;base64,..."
  }
  ```

### `GET /api/v1/cv/model-info`
Returns genuine YOLOv8 model parameters, weights size, architecture, and supported defect classes.

---

## 5. Municipal Work Orders

### `GET /api/v1/work-orders/{issue_id}/pdf`
Stream a formal municipal PDF work order document formatted for public works field crews.
- **Response (200 OK):** `application/pdf` binary stream with `Content-Disposition: attachment; filename=work_order_{issue_id}.pdf`.

### `POST /api/v1/work-orders/lifecycle`
Advance issue through the closed-loop maintenance lifecycle with actor identity and notes.

---

## 6. System Observability

### `GET /health`
Subsystem healthcheck verifying backend, database, YOLOv8 model, privacy engine, and edge queue status.
