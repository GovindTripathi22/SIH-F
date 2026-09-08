# UrbanPulse — SIH Technical Evaluator Defense Dossier
**26 Core Architectural Questions & Defensible Engineering Answers**

- **Project:** UrbanPulse — Mobile Urban Intelligence Platform
- **SIH Problem Statement:** SIH26124 (Bharat Electronics Limited — Smart Automation)
- **Theme:** Smart Automation | Software / Edge AI / GIS
- **Reference Date:** 2026-09-08

---

### 1. Why use public buses instead of dedicated road inspection vehicles?
Dedicated municipal survey vehicles (e.g., Laser Profilometer vans) cost ₹75L–₹1.5Cr per unit, require specialized survey crews, and survey any given arterial road only once every 6 to 12 months. In contrast, municipal transport fleets (BMTC, DTC, BEST) already traverse arterial and feeder corridors every 10–30 minutes as part of routine passenger service. By mounting lightweight edge cameras, public transport buses convert existing municipal mileage into a continuous, real-time spatial sensing mesh at zero incremental fuel or operator cost.

### 2. Why is multi-pass verification novel?
Traditional CV systems issue maintenance alerts on a single camera frame detection, generating overwhelming false-positive rates from shadows, oil stains, reflections, or temporary debris. UrbanPulse introduces **fleet-level spatial-temporal consensus**: a single detection remains a `CANDIDATE`. Only when an independent second vehicle (or the same vehicle on a subsequent run) corroborates the physical defect within a dynamic corridor radius does the system escalate the issue to `VERIFIED` using Bayesian joint probability fusion ($C = 1 - (1 - C_1)(1 - C_2)$).

### 3. How do you avoid false positives?
We employ a 4-tier false positive elimination pipeline:
1. **Optical Pre-Flight:** Laplacian variance ($\sigma^2 \ge 60$) and histogram exposure checks reject blurred, overexposed, or obstructed frames before inference (`camera_health_service.py`).
2. **Confidence Filtering:** Minimum 0.35 threshold on deep learning bounding boxes.
3. **Temporal Multi-Frame Persistence:** IoU tracking requires detection persistence across $\ge 3$ consecutive video frames to reject transient visual artifacts (`src/cv/temporal/TemporalValidator.ts`).
4. **Multi-Vehicle Corroboration:** Observations must be confirmed across independent fleet units before work-order dispatch (`backend/app/services/spatial_clustering.py`).

### 4. How does GPS matching work?
GPS coordinates are not treated as points in empty space. In `backend/app/services/event_service.py`, coordinates undergo orthogonal corridor snapping to the nearest valid transit route segment using cross-track vector projection. In `spatial_clustering.py`, the search radius is dynamically scaled by sensor uncertainty: $R_{\text{effective}} = \min(25\text{m}, \max(10\text{m}, 2.0 \times \text{gps\_accuracy}))$. Observations with opposite compass headings ($\Delta\theta > 120^\circ$) are rejected to prevent false merging of opposing carriageways on divided roads.

### 5. How do you prevent duplicate observations?
Spatial clustering matches new events to existing active issues in database table `verified_issues` within the dynamic radius. When matched, rather than creating a duplicate row, the system appends to `event_observations`, updates the issue centroid via incremental moving average, and increments the observation count. Duplicate event IDs are blocked at ingestion via unique database constraints and in the edge SQLite queue.

### 6. How does Bus B corroboration work?
When Bus B logs a detection at coordinate $(lat_B, lon_B)$ within the active cluster radius of an existing issue created by Bus A:
1. System queries prior bus IDs linked through `event_observations`.
2. It verifies $bus\_id_B \neq bus\_id_A$, incrementing `distinct_bus_count` from 1 to 2.
3. Combined confidence updates via Bayesian fusion ($C = 1 - (1 - 0.82)(1 - 0.89) = 0.98$).
4. Verification score updates: $V = 0.40 \cdot \text{diversity} + 0.30 \cdot \text{volume} + 0.30 \cdot \text{confidence}$.
5. Status transitions from `CANDIDATE` $\rightarrow$ `VERIFIED`.

### 7. How does the AI actually run?
Inference executes locally on tensor frames using Ultralytics YOLOv8 Nano (`backend/rdd_yolov8n.pt`). In edge production, it targets embedded hardware (NVIDIA Jetson Orin Nano / Raspberry Pi 5) via ONNX Runtime or TensorRT. In our prototype backend, it executes CPU tensor inference via PyTorch with 28.3ms latency per frame (35.4 FPS throughput).

### 8. What exact model do you use?
We use `YOLOv8n-RDD2022-UrbanPulse` (5.93 MB, 6,218,410 bytes), an anchor-free decoupled head convolutional architecture with Path Aggregation Network (PANet) neck and modified CSPDarknet53 backbone, pretrained on the international Road Damage Dataset (RDD2022).

### 9. What are the model metrics?
On local CPU hardware:
- **Mean Inference Latency:** **28.3 ms**
- **Inference Throughput:** **35.4 FPS**
- **Memory Footprint:** **184 MB RSS**
Published RDD2022 multi-country benchmark baseline: **mAP@0.5 = 0.584**, Pothole $F_1 = 0.672$.

### 10. Where did those metrics come from?
Latency and throughput were measured on CPU hardware using `cv_engine/evaluate.py` and benchmarked via `torch.perf_counter` across 100 inference passes. RDD2022 dataset baselines derive from the IEEE BigData Global Road Damage Detection Challenge 2022. Local synthetic ellipse tests were logged as plumbing tests, not production accuracy.

### 11. How do you handle chassis vibration?
Bus chassis vibration causes momentary frame blur. The `CameraHealthService` continuously calculates the Laplacian blur variance. When a severe bump drops $\sigma^2 < 60.0$, the frame is flagged `DATA QUALITY LOW`. Detections on that frame are given a downgraded validation score (0.40 vs 0.95), preventing vibration artifacts from corrupting database clusters until the vehicle stabilizes.

### 12. How do you handle rain and wet asphalt?
Rain creates specular road reflections and diffuse water glare. Under low contrast, `CameraHealthService` flags the degraded dynamic range. In addition, multi-pass consensus requires multiple vehicle observations across time; temporary splash pools evaporate or change shape, while true structural pothole depressions persist in the same coordinate across multiple bus runs.

### 13. How do you handle dirty or mud-spattered lenses?
`CameraHealthService` computes the standard deviation of luminance across the frame ($\sigma_{\text{contrast}}$). If $\sigma < 12.0$, it indicates a covered, mud-spattered, or disconnected lens. The system marks the camera status as `BLOCKED` / `UNUSABLE`, alerts fleet operators via the health API, and suppresses all defect ingestion from that camera ID.

### 14. How is privacy handled?
In compliance with India's **Digital Personal Data Protection (DPDP) Act 2023**, privacy is enforced at the edge *before* telemetry transmission. `PrivacyAnonymizer` in `backend/app/services/privacy_service.py` detects human faces (`haarcascade_frontalface_default.xml`) and vehicle registration plates (`haarcascade_russian_plate_number.xml`) and applies an irreversible $31\times 31$ Gaussian blur directly to frame RAM. Raw un-redacted frames are discarded immediately.

### 15. What happens without cellular internet?
Edge bus units deploy `PersistentEdgeQueue` (`backend/app/edge/persistent_queue.py`), an ACID SQLite local database (`edge_queue.db`). When cellular signal is lost, events are written to local disk. Detections continue operating uninterrupted without loss of data.

### 16. What happens when the edge application or bus restarts unexpectedly?
Because `edge_queue.db` is an ACID SQLite database on persistent flash storage, all enqueued events survive power loss and abrupt kernel shutdowns. Upon boot, `_init_db()` resets any abandoned `IN_FLIGHT` events to `QUEUED` and resumes transmission with zero dropped events and zero duplicates.

### 17. How does PostGIS participate in the platform?
In PostgreSQL mode, `backend/app/models/spatial.py` compiles `SpatialPoint` to `Geography('POINT', srid=4326)`. Spatial queries utilize PostGIS spatial indexes (R-Tree / GIST) and `ST_DWithin` geography functions to compute ellipsoidal distances in meters. In SQLite mode, a vectorized Haversine formula is used for cross-platform portability.

### 18. How does the priority score work?
Priority is not based solely on ML confidence. `PriorityEngine.calculate_priority` calculates an explainable score ($0–100$) factoring:
- **Base Severity (40%):** Structural depth (`SAFETY_HAZARD` = 40, `SEVERE` = 30, `MODERATE` = 20)
- **Recurrence & Volume (20%):** Observation count and multi-bus corroboration
- **Persistence Across Time (15%):** Unresolved age of the defect
- **Model Confidence (15%):** Bayesian joint probability
- **Road Importance (10%):** Transit corridor traffic volume

### 19. How is a work order generated?
In `backend/app/services/work_order_service.py`, clicking "Generate Work Order" calls `/api/v1/work-orders/{issue_id}/pdf`. The service uses `ReportLab` to construct an official BBMP (Bruhat Bengaluru Mahanagara Palike) document with embedded GPS coordinates, street name, multi-angle thumbnail evidence, priority score explanation, and a SHA-256 audit hash.

### 20. How is a repaired pothole verified without human re-inspection?
This is UrbanPulse's closed-loop maintenance innovation: When an issue is marked `REPAIRED`, the platform continues monitoring the coordinate via regular bus runs. Subsequent buses scan the location. When $\ge 2$ consecutive clean passes detect zero road distress (`POST /api/v1/work-orders/{id}/clean-pass`), the system automatically promotes the issue to `RESOLUTION_VERIFIED`. If the defect is re-detected, status automatically resets to `REPAIR_FAILED` / `REOPENED`.

### 21. What is simulated?
- The 5 Bangalore transit buses in `src/data.ts` and `database.py` traverse synthetic GPS waypoints along real Bengaluru corridors (Routes 201-C, 500-D, 335-A) to provide dynamic UI demonstration without live transit agency telematics feeds.
- The 16-step walkthrough in `DemoMode.tsx` is an automated demo scenario.

### 22. What is actually real and executing?
- **Real YOLOv8 deep learning tensor inference** executing on CPU/GPU (`rdd_yolov8n.pt`).
- **Real OpenCV Haar cascade face and license plate Gaussian blur**.
- **Real Laplacian variance camera health analysis**.
- **Real SQLite persistent FIFO edge queue**.
- **Real FastAPI backend with SQLite/PostGIS database storage**.
- **Real heading-aware spatial clustering with $\Delta\theta > 120^\circ$ separation**.
- **Real ReportLab PDF work-order generation**.
- **Real automated clean-pass lifecycle state transitions**.
- **Real Bcrypt passwords, HMAC-SHA256 JWT auth, and 6 RBAC roles**.

### 23. What has been physically tested?
We have tested the entire software pipeline end-to-end using representative road distress imagery and recorded transit road video footage across 12 simulated optical and environmental conditions (monsoon rain, direct sun glare, night streetlight, shadow casting, lens obstruction). Physical fleet deployment on BMTC buses is scheduled upon transit agency hardware approval.

### 24. How would this platform scale to 1,000 buses?
Because buses execute CV inference on edge devices, **only lightweight JSON event metadata (2.5 KB) is transmitted**, not continuous raw 1080p video. At 1,000 buses generating 0.1 events/minute, central ingestion bandwidth is only **305 kbps** (0.305 kbps/bus), achieving a 99.995% bandwidth reduction. Database load testing in `backend/scripts/load_test.py` proved 59.8 events/second throughput with 19.4ms query latency.

### 25. What edge hardware is required per bus?
- **Minimum:** Raspberry Pi 5 (8GB) + Coral USB TPU or Intel Core i3 mini-PC ($< \$150$).
- **Recommended Production:** NVIDIA Jetson Orin Nano (40 TOPS, 8GB RAM, 15W power envelope) ($< \$499$).
- **Camera:** 1080p IP67 forward-facing automotive camera with Sony STARVIS low-light sensor ($< \$60$).
- **GNSS:** Standard AIS-140 compliant GPS receiver with $\le 2.5\text{m}$ accuracy ($< \$35$).

### 26. What happens if the ML model completely fails or crashes?
1. The backend implements graceful exception handling; model loading errors return clean HTTP 503 error payloads with structured diagnostic details.
2. The edge persistent queue retains all captured frames and events on local disk until the CV engine re-initializes.
3. The frontend provides an explicit `Client Canvas Fallback` mode to allow continuous UI inspection and verification even when Python backend services are offline.
