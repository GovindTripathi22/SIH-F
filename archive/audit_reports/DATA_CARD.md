# Data Card: UrbanPulse Road Distress & Fleet Telemetry

## Dataset & Telemetry Specification

- **System:** UrbanPulse AI-Powered Mobile Urban Intelligence Platform
- **Format:** GeoJSON, JSON REST payloads, PostGIS Geography (EPSG:4326)
- **Primary Domain:** Municipal Pavement Management & Transit Fleet Telemetry
- **Coverage Region:** Bengaluru Metropolitan Transit Corridors (BMTC Outer Ring Road, Hosur Road, Whitefield, Old Airport Road)

---

## Data Schema & Fields

### 1. Ingested Detection Event (`POST /api/v1/events`)

| Field | Type | Description | Validation Constraints |
| :--- | :--- | :--- | :--- |
| `event_id` | String | Globally unique UUID identifier | Required, $\ge 3$ characters |
| `latitude` | Float | WGS84 Latitude | $[-90.0, 90.0]$, Null Island $(0,0)$ rejected |
| `longitude` | Float | WGS84 Longitude | $[-180.0, 180.0]$ |
| `timestamp` | Datetime | Detection timestamp (UTC) | ISO 8601 format |
| `bus_id` | String | Transit fleet bus identifier | Matches registered fleet vehicle |
| `route_id` | String | Transit line corridor ID | Configured municipal transit route |
| `camera_id` | String | Specific edge camera sensor ID | e.g. `cam-front-01` |
| `event_type` | Enum | Classification of distress | `pothole`, `road_crack`, `waterlogging`, etc. |
| `confidence` | Float | YOLOv8 model confidence | $[0.0, 1.0]$ |
| `validation_score`| Float | Multi-frame temporal validation | $[0.0, 1.0]$ |
| `gps_accuracy_meters` | Float | HDOP circular error estimate | Optional, $\ge 0.0$ |
| `frame_reference` | String | Local edge frame identifier | Optional |

### 2. Consolidated Municipal Issue (`VerifiedIssue`)

- **Spatial Aggregation:** DBSCAN-style distance threshold ($\le 15\text{ meters}$) across road corridors.
- **Centroid Calculation:** Running weighted centroid based on cumulative observation count.
- **Consensus Metrics:** `distinct_bus_count` (number of independent vehicles), `observation_count` (total passes).
- **Confidence Fusion:** Bayesian joint probability $C_{new} = 1 - (1 - C_{prior})(1 - C_{obs})$.
- **Closed-Loop Status:** `PENDING` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `REPAIRED` $\rightarrow$ `RESOLUTION_VERIFIED`.

---

## Provenance & Lineage

1. **Benchmark Distresses:** Derived from the international **RDD2022 (Road Damage Dataset)** with specific calibration for Indian road textures, asphalt patching, and monsoon waterlogging.
2. **Field Fleet Telemetry:** Synthetic and captured Bengaluru bus transit tracks matching real BMTC bus routes (Route 500D Outer Ring Road, Route 201C, Route 335E).
3. **Condition Matrix:** Tested across 12 distinct vehicular dynamics and environmental conditions documented in `BUS_CONDITION_TEST_REPORT.md` (chassis vibration, deceleration pitch, rain sheen, night sodium lighting).

---

## Privacy, Redaction & DPDP Act 2023 Compliance

- **No Raw Video Transmission:** Video streams never leave the bus. All tensor processing and defect extraction occur strictly inside edge RAM.
- **Edge Anonymization:** OpenCV Haar cascades detect faces and registration plates. An irreversible Gaussian blur ($ksize = 31$) is burned into the pixels before the 50KB JPEG thumbnail is encoded.
- **Transitory Edge Buffer:** Uncompressed frames are released from memory immediately after inference; only metadata is written to SQLite edge queue.
