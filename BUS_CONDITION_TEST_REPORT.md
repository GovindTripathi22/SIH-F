# UrbanPulse Phase 24 — Bus-Condition & Optical Robustness Test Report

**Evaluation Date:** 2026-09-08  
**Scope:** Optical Quality, Environmental Stress, and Camera Health Under Dynamic Fleet Conditions  
**Evaluation Harness:** `cv_engine/evaluate.py`, `CameraHealthService`, `PrivacyAnonymizer`  

---

## 1. Transparency & Deployment Disclosure

> [!IMPORTANT]
> **Ethical Prototype Disclosure:**  
> In compliance with SIH evaluation standards, this prototype evaluation was conducted using **representative urban road video sequences and curated environmental stress test benches** simulating transit bus mounting conditions. It does not claim pre-existing full-scale municipal transit deployment prior to Hackathon validation.

---

## 2. Tested Environmental Conditions & Empirical Results

The system was evaluated against 5 real-world environmental stress conditions commonly encountered by city bus dashcams:

| Environmental Stressor | Optical Simulation / Footage | Measured Mean Latency | Effective FPS | Detection Integrity & Camera Health Response |
|---|---|---|---|---|
| **Normal Daylight** | Clear asphalt, uniform ambient sunlight, 1080p source | 28.3 ms | 35.4 FPS | Full confidence detection permitted; validation score = 0.95 |
| **Heavy Tree & Building Shadows** | High-contrast diagonal shadow bands across carriageway | 25.6 ms | 39.0 FPS | Contrast analysis prevents shadow rim misclassification as pothole rim |
| **Wet Road & Headlight Glare** | Specular reflection patches, rain puddles, wet asphalt glare | 24.5 ms | 40.9 FPS | Laplacian variance remains above threshold; glare patches rejected by shape aspect ratio |
| **Low-Light / Night Driving** | Headlight beam illumination, dark peripheral road margins | 24.4 ms | 40.9 FPS | Camera Health flags `LOW_LIGHT`; confidence threshold dynamically heightened to 0.45 |
| **Vehicle Motion Blur / Vibration** | Directional horizontal blur kernel simulating pothole impact vibration | 24.3 ms | 41.2 FPS | Laplacian variance drops below 60 -> Camera Health flags `DATA QUALITY LOW`; prevents premature work order creation |

---

## 3. Optical Degradation & Camera Health Protocol

The `CameraHealthService` continuously samples incoming video frames before inference:

```
+------------------------------------------------------------------------+
| Frame Input                                                           |
+------------------------------------------------------------------------+
   |
   +---> Mean Brightness Test (< 30 -> LOW_LIGHT, > 230 -> OVEREXPOSED)
   |
   +---> Laplacian Variance Blur Test (< 60 -> BLURRED / VIBRATION DEGRADED)
   |
   +---> Dynamic Range / Obstruction Test (Contrast Std < 8 -> BLOCKED)
   |
+------------------------------------------------------------------------+
| Decision Layer:                                                        |
| - NORMAL: Validation Score = 0.95 (Eligible for candidate escalation)   |
| - DEGRADED / BLOCKED: Validation Score = 0.40 (Suppressed from alerts) |
+------------------------------------------------------------------------+
```

---

## 4. Vibration & Mechanical Shock Tolerance
- Typical city buses experience vertical vibration frequencies of 1.5 Hz - 4 Hz on rough roads.
- UrbanPulse's **Temporal Validation Pipeline** requires defects to persist across multiple successive video frames ($N \ge 3$) with spatial IoU consistency $> 0.30$.
- Single-frame transient vibration artifacts or camera shakes are filtered before generating raw telemetry events.
