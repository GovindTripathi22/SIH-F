# SIH26124 Prototype Audit Report

**Evaluator Role:** Skeptical SIH Judge + Senior Software Architect  
**Date:** 2026-09-08  
**Project:** UrbanPulse - AI-Powered Mobile Urban Intelligence Platform  
**Problem Statement ID:** SIH26124  
**Organization:** Bharat Electronics Limited (BEL)

---

## Executive Summary

UrbanPulse attempts to solve urban infrastructure monitoring by transforming public buses into mobile sensor networks. The system demonstrates a complete pipeline from edge detection to authority action, with emphasis on multi-pass verification and explainable priority scoring.

**Overall Assessment:** Strong architectural vision with working prototype, but several areas require validation with real-world data and deployment testing.

---

## 1. PROBLEM FIT

### Does it solve the stated problem?

**✅ YES - Partially**

**Strengths:**
- Correctly identifies the core opportunity: existing bus fleet as distributed sensors
- Addresses the full pipeline: detection → validation → verification → action
- Focuses on explainability and trust (critical for government adoption)
- Multi-pass verification is genuinely novel for this use case

**Concerns:**
- No real-world validation with actual bus deployments
- CV engine uses browser-based image processing, not production ML models
- GPS accuracy in urban environments not tested
- Authority workflow not validated with actual municipal users

**Score: 7/10**

---

## 2. NOVELTY

### Is the novelty more than "AI pothole detection"?

**✅ YES - Significant Novelty**

**Novel Elements:**
1. **Multi-pass verification across fleet** - Not just single-vehicle detection
2. **Explainable priority engine** - Transparent scoring with human-readable reasons
3. **Temporal validation** - Filters false positives through persistence checking
4. **Edge-first architecture** - 99.9% bandwidth reduction through event-only transmission
5. **Evidence chain** - Complete audit trail from detection to action

**What's NOT Novel:**
- Pothole detection itself (well-studied problem)
- Basic GIS mapping (standard)
- Dashboard UI (conventional)

**Score: 8/10**

---

## 3. TECHNICAL DEPTH

### Is there real edge AI, geospatial processing, event aggregation and verification?

**⚠️ PARTIAL - Architecture is solid, implementation needs production hardening**

**Edge AI:**
- ✅ Real image processing pipeline (grayscale → blur → threshold → connected components)
- ✅ Configurable confidence thresholds
- ✅ Frame sampling for performance
- ❌ Not using deep learning (YOLO/TensorFlow) - lower accuracy
- ❌ No model training or validation on real datasets

**Geospatial Processing:**
- ✅ PostGIS integration with spatial indexes
- ✅ ST_DWithin for radius queries
- ✅ Grid-based clustering
- ✅ Heatmap visualization
- ⚠️ No real-world testing with GPS noise

**Event Aggregation:**
- ✅ IoU-based temporal tracking
- ✅ Multi-frame persistence validation
- ✅ Confidence averaging
- ✅ Track lifecycle management
- ⚠️ No validation against ground truth

**Verification:**
- ✅ Multi-pass logic implemented
- ✅ Spatial-temporal matching
- ✅ Bus diversity scoring
- ❌ No accuracy metrics reported

**Score: 6/10**

---

## 4. FEASIBILITY

### Could the system realistically be deployed?

**⚠️ PARTIALLY - Architecture is feasible, implementation needs work**

**Feasible Aspects:**
- Edge-first architecture reduces bandwidth costs dramatically
- Event-based transmission is practical
- PostGIS is production-ready
- FastAPI backend is scalable
- React frontend is maintainable

**Challenges:**
- Browser-based CV not suitable for production (need YOLO on edge devices)
- GPS accuracy in urban canyons not addressed
- No OTA update mechanism for edge models
- Power consumption on edge devices not measured
- No redundancy/failover architecture

**Deployment Requirements:**
- Jetson Nano or similar edge device (not laptop)
- 4G/5G connectivity on buses
- PostgreSQL/PostGIS server
- Authority training program

**Score: 6/10**

---

## 5. PRACTICALITY

### Does the authority receive something actionable?

**✅ YES - Clear value proposition**

**Actionable Outputs:**
- Prioritized issue list with explanations
- Evidence package (observations, confidence, bus IDs)
- GIS map with severity visualization
- Status tracking (DETECTED → RESOLVED)
- Audit trail for accountability

**Practical Benefits:**
- Reduces manual inspection costs
- Faster issue identification
- Data-driven maintenance scheduling
- Transparent decision-making

**Concerns:**
- No integration with existing municipal systems (GIS, CMMS)
- No mobile app for field teams
- No cost-benefit analysis
- No pilot deployment results

**Score: 8/10**

---

## 6. SCALABILITY

### Can the architecture support more buses?

**✅ YES - Designed for scale**

**Scalable Elements:**
- Event-based transmission (not raw video)
- Async FastAPI backend
- PostGIS spatial indexes
- Edge processing reduces central load
- Stateless API design

**Scalability Limits:**
- Single PostgreSQL instance (need read replicas)
- No message queue (need Kafka/RabbitMQ for high throughput)
- No caching layer (need Redis)
- No horizontal scaling strategy documented

**Estimated Capacity:**
- Current: ~100 buses (based on architecture)
- With optimization: ~1000 buses
- With distributed architecture: ~10,000 buses

**Score: 7/10**

---

## 7. USER EXPERIENCE

### Can an authority understand the result quickly?

**✅ YES - Clear visual hierarchy**

**UX Strengths:**
- Command dashboard with priority-based layout
- Color-coded severity (red → green)
- Evidence chain visualization
- Filtering and search capabilities
- Status indicators (LIVE/DELAYED/OFFLINE)

**UX Concerns:**
- No onboarding or training materials
- No mobile-responsive design for field use
- Complex filtering may overwhelm non-technical users
- No customization per user role

**Score: 7/10**

---

## 8. RELIABILITY

### What happens when AI/GPS/network fails?

**✅ YES - Comprehensive failure handling**

**Failure Scenarios Handled:**
- ✅ Low confidence detection → rejected
- ✅ Noisy GPS → flagged for review
- ✅ Network loss → buffered and synced
- ✅ Duplicate events → deduplicated
- ✅ False positives → temporal validation
- ✅ Insufficient evidence → marked unverified
- ✅ Server failure → retry with backoff

**Reliability Gaps:**
- No chaos testing results
- No SLA definitions
- No disaster recovery plan
- No monitoring/alerting system

**Score: 8/10**

---

## 9. PRIVACY

### Is public-space visual data handled responsibly?

**✅ YES - Privacy-by-design**

**Privacy Controls:**
- ✅ No passenger analytics
- ✅ Face blurring (configurable)
- ✅ ANPR as advanced module (not core)
- ✅ Minimal raw video storage (24h on edge)
- ✅ Configurable retention policies
- ✅ No PII in event metadata

**Privacy Concerns:**
- No privacy impact assessment documented
- No data protection officer role defined
- No citizen consent mechanism
- No data breach response plan

**Score: 8/10**

---

## 10. EVIDENCE

### Can every major result be traced to an event?

**✅ YES - Complete audit trail**

**Evidence Chain:**
```
Raw Detection → Temporal Validation → Geotagged Event → 
Multi-Pass Verification → Priority Calculation → Issue Creation → 
Status Changes → Resolution
```

**Traceability:**
- Every issue links to observations
- Every observation links to bus/timestamp
- Every status change logged with user attribution
- Priority scores include factor breakdown

**Score: 9/10**

---

## 11. PROTOTYPE CONSISTENCY

### Does the actual UI match the claimed functionality?

**⚠️ MOSTLY - Some gaps between claims and implementation**

**Consistent:**
- ✅ GIS map with filtering works as described
- ✅ Evidence panel shows full chain
- ✅ Priority engine produces explainable scores
- ✅ Failure scenarios handled correctly
- ✅ Demo mode shows real workflow

**Inconsistent:**
- ❌ CV engine claims "AI detection" but uses image processing
- ❌ Backend API documented but not fully integrated with frontend
- ❌ Traffic analytics based on simulated data
- ❌ Edge metrics are estimates, not measurements

**Score: 6/10**

---

## Five Strongest Features

1. **Multi-Pass Verification System** - Genuinely novel approach to reducing false positives through fleet-wide confirmation
2. **Explainable Priority Engine** - Transparent scoring with human-readable reasons builds trust
3. **Edge-First Architecture** - 99.9% bandwidth reduction makes deployment economically viable
4. **Complete Evidence Chain** - Full audit trail from detection to resolution
5. **Comprehensive Failure Handling** - System behaves intelligently under adverse conditions

---

## Five Weakest Areas

1. **Computer Vision Engine** - Browser-based image processing, not production ML (YOLO)
2. **No Real-World Validation** - All testing on simulated/synthetic data
3. **Backend Integration** - FastAPI built but not fully connected to frontend
4. **Edge Deployment** - No actual edge device testing (Jetson/RPi)
5. **Performance Metrics** - Claims made without measurement infrastructure

---

## Five Likely Judge Questions

1. **"What is the detection accuracy on real road data?"**
   - *Current Answer:* Unknown - no real-world testing
   - *Needed:* Validation dataset with ground truth, precision/recall metrics

2. **"How does GPS error affect issue location accuracy?"**
   - *Current Answer:* Architecture handles it, but not tested
   - *Needed:* Urban canyon testing, GPS error characterization

3. **"What is the total cost of deployment for 100 buses?"**
   - *Current Answer:* Not calculated
   - *Needed:* Hardware costs, connectivity, maintenance, personnel

4. **"How do you handle model updates on edge devices?"**
   - *Current Answer:* Not implemented
   - *Needed:* OTA update mechanism, version management

5. **"What happens when 50 buses detect the same issue simultaneously?"**
   - *Current Answer:* Architecture should handle it
   - *Needed:* Load testing, stress testing results

---

## Five Technical Risks

1. **CV Accuracy** - Image processing may have high false positive rate in real conditions
2. **GPS Reliability** - Urban environments degrade GPS significantly
3. **Edge Device Failure** - No redundancy if edge hardware fails
4. **Network Connectivity** - 4G/5G coverage gaps in some areas
5. **Authority Adoption** - No change management or training plan

---

## Three Things That Should Be Removed

1. **Traffic Analytics Module** - Not core to problem statement, adds complexity without validation
2. **ANPR/Hit-and-Run** - Advanced feature not needed for MVP, privacy concerns
3. **Cyberpunk UI Elements** - Distracts from professional authority dashboard

---

## Three Things That Should Be Strengthened

1. **Real-World Testing** - Deploy on 5-10 actual buses for 1 month
2. **ML Model Integration** - Replace image processing with YOLOv8
3. **Performance Measurement** - Instrument all components with real metrics

---

## Three Metrics That Should Be Measured Before SIH

1. **Detection Precision/Recall** - On labeled dataset of real road defects
2. **End-to-End Latency** - From detection to dashboard display
3. **Multi-Pass Verification Accuracy** - Correct merge rate vs false merges

---

## Fake/Unsupported Functionality

1. **CV Engine "AI Detection"** - Uses image processing, not deep learning
2. **Traffic Analytics** - Based on simulated vehicle_count, not real detections
3. **Edge Performance Metrics** - Estimated, not measured on actual hardware
4. **Backend API Integration** - Built but not fully connected to frontend
5. **Real-Time Updates** - WebSocket architecture designed but not implemented

---

## Unnecessary Architecture

1. **Message Queue (MQTT)** - Documented but not implemented, adds complexity
2. **Redis Caching** - Mentioned but not needed for current scale
3. **Docker Orchestration** - Over-engineering for prototype stage
4. **Multiple Database Replicas** - Not needed for <100 buses
5. **Advanced Analytics Pipeline** - Separate from core use case

---

## Single Strongest Demonstration Workflow

### The 90-Second Hero Scenario

**Setup:** Two buses on overlapping routes in Bengaluru

**Sequence:**
1. **0-10s:** Bus A detects pothole → AI validates → GPS tags → Event created
2. **10-20s:** Event appears on GIS map → Authority sees it → Priority: MEDIUM
3. **20-40s:** Bus B (different route) passes same location → Detects same pothole
4. **40-50s:** System matches observations → Multi-pass verification → Confidence increases
5. **50-60s:** Priority escalates to HIGH → Authority notified with evidence package
6. **60-80s:** Authority opens issue → Reviews evidence chain → Assigns to team
7. **80-90s:** Team dispatched → Status: IN_PROGRESS → Issue tracked

**What Judges See:**
- ✅ Real detection (not pre-recorded)
- ✅ Multi-pass verification in action
- ✅ Explainable priority escalation
- ✅ Complete evidence chain
- ✅ Authority workflow
- ✅ All metrics from actual system

**Fallback Plan:**
- If detection fails: Use test video with synthetic defects
- If network fails: Show offline buffering and sync
- If GPS fails: Show noisy GPS handling

---

## Final Recommendations

### Immediate (Before SIH Demo)

1. **Replace CV engine with YOLOv8** - Even if just ONNX Runtime Web
2. **Create labeled test dataset** - 100+ images with ground truth
3. **Measure actual metrics** - Precision, recall, latency, bandwidth
4. **Test on real edge device** - Jetson Nano minimum
5. **Prepare demo video** - Backup if live demo fails

### Short-Term (Post-SIH)

1. **Pilot deployment** - 10 buses for 3 months
2. **Authority training** - Workshops with municipal engineers
3. **Integration planning** - Connect to existing GIS/CMMS
4. **Cost-benefit analysis** - Compare to manual inspection
5. **Privacy impact assessment** - Legal review

### Long-Term (Production)

1. **Scale to 100+ buses** - With proper infrastructure
2. **Add more defect types** - Cracks, signs, waterlogging
3. **Predictive maintenance** - ML on historical data
4. **Citizen portal** - Public issue reporting
5. **Multi-city deployment** - Shared platform

---

## Overall Score: 7.0/10

**Strengths:**
- Novel multi-pass verification approach
- Strong architectural vision
- Comprehensive failure handling
- Clear value proposition for authorities

**Weaknesses:**
- No real-world validation
- CV engine not production-ready
- Performance metrics not measured
- Backend not fully integrated

**Verdict:** 
Strong prototype with genuine innovation in multi-pass verification and explainable priority. However, lacks real-world validation and production-ready ML integration. Suitable for SIH demonstration with clear disclosure of limitations. Recommended for pilot deployment with proper instrumentation and testing.

---

## Evaluator Signature

**Name:** [Skeptical SIH Judge]  
**Role:** Senior Software Architect  
**Date:** 2026-09-08  
**Confidence Level:** High (based on code review and documentation)

---

*This audit was conducted with the assumption that all claims in documentation are subject to verification. The evaluator recommends independent validation of all performance claims before production deployment.*
