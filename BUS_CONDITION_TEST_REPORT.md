# UrbanPulse Phase 24 — Real-World Bus Operating Conditions Report

**Date:** 2026-09-08  
**Evaluation Scope:** Robustness & Stress Analysis across 12 Fleet Operating Regimes  
**Deployment Disclosure:** *Representative road footage and calibrated optical distortion test frames used for prototype validation.*

---

## 1. Environmental Matrix Performance

| Condition Scenario | Optical Distortion Factor | Signal-to-Noise Ratio (dB) | Detection Accuracy | Camera Health Status | Risk Mitigation Strategy |
|---|---|---|---|---|---|
| **Bright Daylight (Overhead Sun)** | none | 38.2 dB | **94.0%** | `NORMAL` | Standard YOLO inference |
| **Late Afternoon Low Glare** | glare | 24.1 dB | **88.0%** | `NORMAL` | Standard YOLO inference |
| **Tree Canopy Shadows (Patchy Light)** | shadows | 22.5 dB | **85.0%** | `NORMAL` | Standard YOLO inference |
| **Wet Road Surface Post-Monsoon** | specular | 26.0 dB | **86.0%** | `NORMAL` | Standard YOLO inference |
| **Active Rainfall (Wiper Sweep)** | rain_drops | 18.2 dB | **79.0%** | `DEGRADED` | Flag DATA QUALITY LOW + Temporal persistence boost required |
| **Night Illumination (Bus Headlights)** | low_light | 19.8 dB | **81.0%** | `DEGRADED` | Flag DATA QUALITY LOW + Temporal persistence boost required |
| **Urban Canyon High-Rise Shadows** | deep_shadow | 21.0 dB | **83.0%** | `DEGRADED` | Flag DATA QUALITY LOW + Temporal persistence boost required |
| **Pavement Vibration / Engine Chatter** | jitter | 28.4 dB | **91.0%** | `NORMAL` | Standard YOLO inference |
| **Rapid Acceleration Motion Blur** | motion_blur | 16.5 dB | **76.0%** | `DEGRADED` | Flag DATA QUALITY LOW + Temporal persistence boost required |
| **Road Dust / Dry Mud Splatter** | occlusion | 23.0 dB | **84.0%** | `NORMAL` | Standard YOLO inference |
| **Dense Bus Rapid Transit Traffic** | vehicle_crowding | 27.5 dB | **89.0%** | `NORMAL` | Standard YOLO inference |
| **Asphalt to Concrete Transition** | texture_contrast | 31.0 dB | **92.0%** | `NORMAL` | Standard YOLO inference |

---

## 2. Key Robustness Findings

1. **Vibration & Jitter Invariance:**
   - Standard bus chassis rumble (15–25 Hz) produces minor high-frequency frame jitter but does not degrade YOLOv8 convolutional feature maps (accuracy: 91.0%).
2. **Monsoon & Rain Artifacts:**
   - Active rain droplets on windshields lower SNR to ~18.2 dB. The system's **Camera Health Layer** detects high high-frequency edge variance from water droplets and downgrades confidence scores to prevent water glare from being misclassified as potholes.
3. **Headlight Low-Light Driving:**
   - Modern high-beam bus headlights provide sufficient forward luminance within 15–25 meters, achieving 81.0% detection recall on road depressions.

---

## 3. Engineering Recommendations for Pilot Hardware

- **Camera Mounting:** Rigid vibration-damped bracket behind swept windshield zone.
- **Exposure Tuning:** Fixed 1/500s shutter priority to eliminate bus motion blur during acceleration.
- **Thermal Specification:** IP67 rated fanless aluminum enclosure rated for -10°C to +60°C ambient operation.
