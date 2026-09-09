# Model Card: YOLOv8n-RDD2022-UrbanPulse

> **Authoritative Evidence Reference:** [docs/MODEL_EVIDENCE.md](./docs/MODEL_EVIDENCE.md)

## Model Details

- **Model Name:** YOLOv8n-RDD2022-UrbanPulse
- **Version:** 1.0.0
- **Model Type:** Deep Learning Object Detection (Anchor-Free Decoupled Head)
- **Architecture:** YOLOv8 Nano (Modified CSPDarknet53 backbone, PANet neck)
- **Framework:** PyTorch / Ultralytics 8.x (ONNX exportable)
- **Weights File:** `backend/rdd_yolov8n.pt`
- **File Size:** 5.93 MB (6,218,410 bytes)
- **Training Provenance:** Pretrained on Road Damage Dataset 2022 (RDD2022)
- **Input Resolution:** 640 × 640 × 3 (RGB)
- **Inference Precision:** FP32 (CPU) / FP16 & INT8 (TensorRT / Edge TPU compatible)

---

## Intended Use & Target Tasks

UrbanPulse deploys this model on municipal public transport fleets to passively scan urban roadways and detect physical road surface distresses without manual human inspection surveys.

### Direct Semantic Classes (16 Classes)
1. `pothole`: Road surface depressions, asphalt loss craters.
2. `road_crack`: Longitudinal and transverse linear cracks.
3. `road_patch`: Degraded bituminous patches or road subsidence.
4. `unpaved_subsidence`: Unsurfaced road shoulder deterioration.
5. `manhole_defect`: Sunken, displaced, or damaged utility manhole covers.
6. `drainage_defect`: Broken, silted, or collapsed stormwater drainage grates.
*(Auxiliary classes: `speed_bump`, `road_sign`, `traffic_light`, `guardrail`, `pedestrian_crossing`, `road_marking`, `vehicle`, `motorcycle`, `construction`, `number_plate`)*

---

## Benchmark Performance & Measured Latency

Empirically measured on CPU workstation using Ultralytics PyTorch 2.6 (see [docs/MODEL_EVIDENCE.md](./docs/MODEL_EVIDENCE.md)):

| Metric | Measured Value | Target Threshold | Status |
| :--- | :--- | :--- | :--- |
| **Mean CPU Latency** | **28.3 ms** | $< 80.0\text{ ms}$ | **PASSED (Real-Time)** |
| **P95 Latency** | **33.2 ms** | $< 120.0\text{ ms}$ | **PASSED** |
| **Frame Throughput** | **35.4 FPS** | $> 15.0\text{ FPS}$ | **PASSED** |
| **Memory Footprint** | **184 MB RSS** | $< 500\text{ MB}$ | **PASSED** |
| **Weights Size** | **5.93 MB** | $< 25.0\text{ MB}$ | **PASSED** |
| **Published RDD2022 mAP@0.5** | **0.584** (Macro benchmark) | Reference Baseline | **BASELINE** |

---

## Camera Health & Optical Pre-Flight Integration

To prevent degraded video frames from corrupting municipal datasets, all frames undergo automated pre-flight diagnostics in `backend/app/services/camera_health_service.py` before inference:
- **Lens Blur / Focus:** Laplacian variance threshold ($\sigma^2 < 30.0$ marks blurred lens).
- **Exposure / Night:** Mean pixel brightness ($< 25.0$ marks severe under-exposure; $> 230.0$ marks sensor blowout).
- **Physical Obstruction:** Black/uniform pixel ratio ($> 75\%$ marks lens blocked or cable disconnected).

---

## Edge Privacy Redaction Integration

Under India's **Digital Personal Data Protection (DPDP) Act 2023**, transit video captured from public roads cannot expose citizen faces or motor vehicle registration plates.
- **Implementation:** Pre-inference Haar Cascade detection (`haarcascade_frontalface_default.xml`, `haarcascade_russian_plate_number.xml`).
- **Redaction Mode:** Irreversible Gaussian Blur ($ksize = 31 \times 31, \sigma = 10.0$) applied directly to the in-memory frame buffer before feature extraction and before storage.

---

## Limitations & Failure Modes

1. **Puddle Reflections:** Still water reflecting blue skies can occasionally attenuate crack edge contrast.
2. **Unpaved Gravel Roads:** Unsurfaced rural paths lack defined pavement boundaries, causing intermittent texture misclassifications.
3. **Severe Night Glare:** Direct high-beam headlights facing the transit camera can cause temporary lens flare blooming.
4. **Vibration Blur:** Extreme bus chassis vibration on severe speed bumps can trigger temporary `BLURRED` camera health states, causing detections to be tagged with lower validation confidence until bus stabilizes.
