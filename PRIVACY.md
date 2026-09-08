# Privacy Architecture & DPDP Act 2023 Compliance Specification

## Executive Summary

Public transit camera monitoring introduces significant civil liberty and data privacy concerns if unconstrained. UrbanPulse was engineered under a strict **Privacy-by-Design** mandate in compliance with **India's Digital Personal Data Protection (DPDP) Act, 2023** and international privacy guidelines (GDPR Art. 25).

UrbanPulse **does not** transmit, store, or stream raw public surveillance video. The system functions as an anonymous edge telemetry sensor: raw video frames are processed entirely in ephemeral edge RAM and discarded within 65 milliseconds.

---

## 5 Privacy-by-Design Architectural Tenets

```
   [ Road-Facing Camera ]
             │ (Raw Video Stream)
             ▼
   [ Ephemeral RAM Buffer ] ──► [ Haar Cascade Face & Plate Detect ]
             │                               │
             │                     (Apply Gaussian Blur 31x31)
             ▼                               ▼
   [ YOLOv8 Tensor Inference ] ──► [ Edge Redacted Thumbnail ]
             │                               │
             ▼                               ▼
   [ JSON Event Metadata ]        [ Anonymized Evidence (<50KB) ]
             │                               │
             └───────────────┬───────────────┘
                             │ (HTTPS / TLS 1.3)
                             ▼
                 [ Municipal Control Server ]
```

### 1. Zero Continuous Video Transmission
- Conventional CCTV architectures stream 4–8 Mbps raw video back to central control centers, exposing millions of citizens and private vehicles daily.
- UrbanPulse operates on **Zero Raw Streaming**: only structured JSON defect telemetry (0.305 kbps/bus) and occasional blurred thumbnail images are transmitted.
- **Bandwidth Reduction:** 99.995% reduction compared to raw 1080p video streams.

### 2. Automated Edge Anonymization (Prior to Transmission)
- Implemented in `backend/app/services/privacy_service.py` (`EdgePrivacyAnonymizer`).
- **Face Detection:** OpenCV Haar Cascade (`haarcascade_frontalface_default.xml`).
- **License Plate Detection:** OpenCV Haar Cascade (`haarcascade_russian_plate_number.xml`).
- **Redaction Transformation:** Irreversible Gaussian Blur ($ksize = 31 \times 31$, $\sigma = 10.0$) applied directly to the detection bounding box before any compression, storage, or transmission.

### 3. Ephemeral In-Memory Frame Discard
- Unredacted frames exist only as transient numpy arrays in volatile edge memory during tensor inference.
- Frames are never written to disk, local flash, or unencrypted caches.
- As soon as bounding boxes are extracted and the redacted audit thumbnail is created, the raw frame buffer is released for immediate garbage collection.

### 4. Narrow Road-Surface Optical Scoping
- Sensors are strictly downward/forward-facing mounted on the front windshield or bumper.
- Optical geometry is calibrated to prioritize the road surface (asphalt, lanes, curbs).
- Passenger interiors, bus cabins, sidewalks, and private building facades are outside the region of interest.

### 5. Role-Based Access Control & Immutable Audit Logging
- Municipal access to evidence thumbnails is strictly partitioned via JWT RBAC (`ADMIN`, `TRAFFIC_AUTHORITY`, `PWD_ENGINEER`).
- Every view and inspection action is recorded with actor ID and timestamp in `IssueStatusHistory`.

---

## Verification & Automated Testing

The automated test suite continuously validates privacy enforcement:
- **`backend/tests/test_privacy_and_health.py`:** Tests synthetic face and license plate patterns, verifying pixel variance is flattened and original details are rendered unrecoverable.
- **`scripts/e2e_verify.py`:** Step 8 validates that every edge inference payload returns `privacy_compliance: DPDP_2023_ALIGNMENT_ACTIVE`.
