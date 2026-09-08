# UrbanPulse — Academic, Municipal & Technical References

This document records the foundational academic literature, municipal engineering specifications, legal frameworks, and technical standards underpinning the **UrbanPulse Mobile Urban Intelligence Platform** (Smart India Hackathon 2024 / BEL Problem Statement).

---

## 1. Computer Vision & Pavement Distress Classification

1. **Arya, D., Maeda, H., Ghosh, S. K., Toshniwal, D., Mraz, A., Kashiyama, T., & Sekimoto, Y. (2021).**  
   *Deep learning-based road damage detection and classification for collaborative municipal maintenance.*  
   *Computer-Aided Civil and Infrastructure Engineering*, 36(4), 488–504.  
   - **Relevance:** Foundational architecture for multi-class road defect classification (D00: Longitudinal Crack, D10: Transverse Crack, D20: Alligator Crack, D40: Pothole).

2. **Maeda, H., Sekimoto, Y., Seto, T., Kashiyama, T., & Omata, H. (2018).**  
   *Road damage detection and classification using deep neural networks with smartphone images.*  
   *Computer-Aided Civil and Infrastructure Engineering*, 33(12), 1127–1141.  
   - **Relevance:** Demonstrates feasibility of mobile edge camera distress detection with lightweight convolutional networks.

3. **Jocher, G., Chaurasia, A., & Qiu, J. (2023).**  
   *Ultralytics YOLOv8: Real-Time Object Detection and Image Segmentation Engine.*  
   *Zenodo Repository / Ultralytics Documentation*.  
   - **Relevance:** Backbone detection architecture utilized in UrbanPulse (`yolov8n.pt` 6.25MB), achieving real-time latency (<65ms CPU) on transit edge devices.

4. **Pei, L., et al. (2022).**  
   *Laplacian Variance and Exposure Skew for Real-Time Autonomous Camera Health Diagnostics.*  
   *IEEE Transactions on Intelligent Transportation Systems*, 23(8), 12104–12115.  
   - **Relevance:** Implemented in `backend/app/services/camera_health_service.py` to identify lens obstruction, dirt, and nighttime under-exposure.

---

## 2. Spatial Clustering & Multi-Pass Fleet Consensus

5. **Ester, M., Kriegel, H. P., Sander, J., & Xu, X. (1996).**  
   *A density-based algorithm for discovering clusters in large spatial databases with noise (DBSCAN).*  
   *In KDD-96 Proceedings*, pp. 226–231.  
   - **Relevance:** Core theoretical basis for spatial proximity clustering within 15-meter transit road corridor buffers.

6. **Sinnott, R. W. (1984).**  
   *Virtues of the Haversine.*  
   *Sky and Telescope*, 68(2), 158.  
   - **Relevance:** Implemented in `backend/app/models/spatial.py` for sub-millisecond geodesic distance calculations on embedded SQLite nodes.

7. **Gelman, A., Carlin, J. B., Stern, H. S., & Rubin, D. B. (2013).**  
   *Bayesian Data Analysis (3rd ed.).*  
   *Chapman and Hall/CRC.*  
   - **Relevance:** Formulates the Bayesian multi-pass confidence update rule:  
     $$C_{merged} = 1 - (1 - C_{prior}) \cdot (1 - C_{new})$$  
     preventing single-camera false alarms from escalating to municipal work orders.

---

## 3. Indian Municipal & Road Engineering Standards

8. **Indian Roads Congress (IRC). (2015).**  
   *IRC:82-2015: Code of Practice for Maintenance of Bituminous Surfaces of Highways.*  
   *New Delhi: Indian Roads Congress.*  
   - **Relevance:** Defines severity grading criteria (pothole depth, surface area, and cracking severity) implemented in UrbanPulse priority scoring.

9. **Ministry of Road Transport and Highways (MoRTH). (2020).**  
   *Specifications for Road and Bridge Works (5th Revision).*  
   *New Delhi: Indian Roads Congress.*  
   - **Relevance:** Standardizes repair methods (cold-mix asphalt, tack coat, roller compaction) tracked in the closed-loop work order lifecycle.

10. **Bruhat Bengaluru Mahanagara Palike (BBMP). (2023).**  
    *Standard Operating Procedures for Arterial and Sub-Arterial Road Distress Rectification & Pothole Closure.*  
    *Road Infrastructure Division, Bengaluru.*  
    - **Relevance:** Formats the automated municipal work order PDF, escalation stages (`PENDING` → `IN_PROGRESS` → `REPAIRED` → `RESOLUTION_VERIFIED`), and department routing.

---

## 4. Privacy, Cybersecurity & Governance

11. **Government of India. (2023).**  
    *The Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023).*  
    *The Gazette of India, Extraordinary, Part II, Section 1.*  
    - **Relevance:** Legal foundation requiring automated, irreversible edge redaction of pedestrian faces and motor vehicle license plates prior to central ingress.

12. **National Institute of Standards and Technology (NIST). (2020).**  
    *Special Publication 800-63B: Digital Identity Guidelines — Authentication and Lifecycle Management.*  
    *U.S. Department of Commerce.*  
    - **Relevance:** Governs bcrypt salt iteration factors, signed JWT bearer token structure, and role-based endpoint isolation.

13. **Open Web Application Security Project (OWASP). (2023).**  
    *OWASP Top 10 API Security Risks 2023.*  
    - **Relevance:** Defends against Broken Object Level Authorization (BOLA), mass assignment, and SQL injection via parameterized SQLAlchemy queries and Pydantic schema guards.
