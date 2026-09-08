# UrbanPulse — Implementation Plan
## SIH26124: Phased Development Roadmap

---

## PHASE 1: FOUNDATION (Week 1-2) ✅ IN PROGRESS

### Goal
Working end-to-end data flow with simulated data on frontend.

### Completed
- [x] React + TypeScript + Tailwind CSS frontend scaffold
- [x] GIS map with Leaflet (CARTO dark tiles)
- [x] Event list with multi-pass verification timeline
- [x] Fleet monitoring panel
- [x] Pipeline visualization
- [x] Analytics charts (Recharts)
- [x] Architecture documentation
- [x] Type definitions aligned with production schema
- [x] Simulated data layer (Bengaluru coordinates)

### Remaining
- [ ] Connect frontend to real backend API
- [ ] WebSocket integration for real-time updates
- [ ] Event status management (action/resolve buttons)
- [ ] Responsive mobile layout

### Deliverables
- Functional authority dashboard
- Architecture documentation (ARCHITECTURE.md)
- Type definitions matching production schema

---

## PHASE 2: BACKEND + DATABASE (Week 3-4)

### Goal
Working FastAPI backend with PostgreSQL + PostGIS.

### Tasks

#### 2.1 Database Setup
```bash
# PostgreSQL 15 + PostGIS 3.3
docker run -d --name urbanpulse-db \
  -e POSTGRES_PASSWORD=urbanpulse_dev \
  -e POSTGRES_DB=urbanpulse \
  -p 5432:5432 \
  postgis/postgis:15-3.3
```

**Schema**: events, observations, buses, verification_rules tables
**Indexes**: GIST on location, B-tree on timestamp/status/type

#### 2.2 FastAPI Backend
```
backend/
├── app/
│   ├── main.py              # FastAPI app with CORS
│   ├── config.py            # Settings via pydantic-settings
│   ├── database.py          # SQLAlchemy async engine
│   ├── models/              # SQLAlchemy ORM models
│   ├── schemas/             # Pydantic request/response schemas
│   ├── api/v1/
│   │   ├── events.py        # CRUD for events
│   │   ├── fleet.py         # Bus status endpoints
│   │   └── analytics.py     # Aggregation queries
│   └── services/
│       ├── event_service.py
│       └── geospatial_service.py
```

**Key Endpoints**:
- `POST /api/v1/events` — Ingest event from bus
- `GET /api/v1/events` — Query with spatial + temporal filters
- `PATCH /api/v1/events/{id}/status` — Update lifecycle
- `GET /api/v1/fleet/status` — All bus locations
- `WS /api/v1/ws/events` — Real-time event stream

#### 2.3 Docker Compose
```yaml
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
  backend:
    build: ./backend
    ports: ["8000:8000"]
    depends_on: [db, redis]
  db:
    image: postgis/postgis:15-3.3
    ports: ["5432:5432"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

### Acceptance Criteria
- POST event → stored in PostGIS → visible on dashboard
- Spatial query returns events within bounding box
- Fleet status updates in real-time
- All services running via `docker-compose up`

---

## PHASE 3: GEOSPATIAL INTELLIGENCE (Week 5-6)

### Goal
Multi-pass verification and priority scoring working.

### Tasks

#### 3.1 Spatial Matching Service
```python
# Find existing events within radius of new detection
async def find_nearby_events(
    event_type: str,
    lat: float,
    lng: float,
    radius_m: float = 50.0,
    time_window_hours: int = 24
) -> list[Event]:
    query = text("""
        SELECT * FROM events
        WHERE event_type = :event_type
          AND status IN ('unverified', 'pending_verify', 'verified')
          AND ST_DWithin(
            location::geography,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
            :radius_m
          )
          AND timestamp > NOW() - INTERVAL ':hours hours'
        ORDER BY verification_count DESC
        LIMIT 10
    """)
```

#### 3.2 Verification Engine
```python
# Rule-based verification
async def verify_event(event_id: str) -> bool:
    event = await get_event(event_id)
    rule = await get_verification_rule(event.event_type)
    observations = await get_observations(event_id)
    
    # Check: enough observations?
    if len(observations) < rule.min_observations:
        return False
    
    # Check: average confidence above threshold?
    avg_conf = mean([o.confidence for o in observations])
    if avg_conf < rule.min_confidence:
        return False
    
    # Check: within time window?
    time_span = (observations[-1].timestamp - observations[0].timestamp)
    if time_span.total_seconds() > rule.time_window_seconds:
        return False
    
    # VERIFIED
    await update_event_status(event_id, 'verified')
    await calculate_priority(event_id)
    return True
```

#### 3.3 Priority Scoring
```python
def calculate_priority_score(event, observations):
    severity = estimate_severity(event.type, observations)  # 1-10
    freq_score = min(len(observations) / 5.0, 1.0)          # 0-1
    age_hours = hours_since(event.last_detected)
    recency_score = max(0, 1 - age_hours / 24)              # 0-1
    conf_score = mean([o.confidence for o in observations])  # 0-1
    
    score = (
        severity * 10 * 0.40 +   # 40% severity
        freq_score * 100 * 0.25 + # 25% frequency
        recency_score * 100 * 0.20 + # 20% recency
        conf_score * 100 * 0.15   # 15% confidence
    )
    
    if score >= 80: return 'critical'
    if score >= 60: return 'high'
    if score >= 40: return 'medium'
    return 'low'
```

#### 3.4 Background Workers
```python
# Celery worker for async verification
@celery_app.task
def process_verification(event_id: str):
    asyncio.run(verify_event(event_id))

# Triggered on each new observation
@celery_app.task
def on_new_observation(observation_id: str):
    observation = get_observation(observation_id)
    matched_event = spatial_match(observation)
    
    if matched_event:
        attach_observation(observation, matched_event)
        process_verification.delay(matched_event.id)
    else:
        new_event = create_event_from_observation(observation)
        process_verification.delay(new_event.id)
```

### Acceptance Criteria
- 3 observations of same location → event becomes "verified"
- Priority score visible and explainable
- Verification rules configurable per event type
- Background workers process queue < 5s latency

---

## PHASE 4: EDGE AI PIPELINE (Week 7-8)

### Goal
Real computer vision detection on recorded video.

### Tasks

#### 4.1 YOLO Model
```python
# Fine-tune YOLOv8n on road damage dataset
from ultralytics import YOLO

model = YOLO('yolov8n.pt')
model.train(
    data='road_damage.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    device=0  # GPU
)
```

**Dataset**: RDD2022 (Road Damage Detection) or custom collected
**Classes**: pothole, crack, waterlogging, sign_damage
**Target mAP**: > 0.75 on validation set

#### 4.2 Edge Processing Pipeline
```python
# edge/main.py
class EdgeProcessor:
    def __init__(self):
        self.model = YOLO('models/best.pt')
        self.tracker = ByteTrack()
        self.gps = GPSReader('/dev/ttyUSB0')
        self.camera = CameraCapture(0)  # or video file
        self.mqtt = MQTTPublisher(config)
    
    async def process_frame(self, frame, gps_data):
        # 1. Run inference
        detections = self.model(frame, conf=0.70)
        
        # 2. Track objects
        tracked = self.tracker.update(detections)
        
        # 3. Create events for new detections
        for det in tracked.new_detections:
            event = create_event(
                event_type=det.class_name,
                confidence=det.confidence,
                lat=gps_data.lat,
                lng=gps_data.lng,
                timestamp=gps_data.timestamp,
                bbox=det.bbox,
            )
            await self.mqtt.publish(event)
    
    async def run(self):
        while True:
            frame = self.camera.capture()
            gps_data = self.gps.read()
            await self.process_frame(frame, gps_data)
            await asyncio.sleep(0.033)  # 30fps
```

#### 4.3 Video Simulator
```python
# For testing without real hardware
class VideoSimulator:
    def __init__(self, video_path, gps_track):
        self.cap = cv2.VideoCapture(video_path)
        self.gps_track = gps_track  # Pre-recorded GPS track
        self.frame_idx = 0
    
    def capture(self):
        ret, frame = self.cap.read()
        if not ret:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = self.cap.read()
        self.frame_idx += 1
        return frame
    
    def read_gps(self):
        return self.gps_track[self.frame_idx % len(self.gps_track)]
```

#### 4.4 MQTT Transport
```python
# edge/transport/mqtt_client.py
import paho.mqtt.client as mqtt

class MQTTPublisher:
    def __init__(self, config):
        self.client = mqtt.Client(
            client_id=config.bus_id,
            protocol=mqtt.MQTTv5
        )
        self.client.tls_set(ca_certs='certs/ca.crt')
        self.client.username_pw_set(config.api_key)
        self.client.connect(config.broker_host, 8883)
        self.topic = f"urbanpulse/{config.city_id}/bus/{config.bus_id}/events"
    
    async def publish(self, event):
        payload = json.dumps(event.to_dict())
        self.client.publish(self.topic, payload, qos=1)
```

### Acceptance Criteria
- Detect potholes in test video with >80% accuracy
- Events transmitted to backend within 5s
- System works with intermittent connectivity (offline queue)
- GPS coordinates correctly tagged on events

---

## PHASE 5: INTEGRATION & TESTING (Week 9-10)

### Goal
Production-ready integrated system.

### Tasks

#### 5.1 End-to-End Testing
```python
# tests/test_e2e.py
async def test_full_pipeline():
    # 1. Simulate bus detecting pothole
    event = simulate_detection('pothole', confidence=0.85)
    
    # 2. POST to backend
    response = await client.post('/api/v1/events', json=event)
    assert response.status_code == 201
    
    # 3. Verify stored in database
    stored = await db.get_event(response.json()['event_id'])
    assert stored.status == 'unverified'
    
    # 4. Simulate 2 more observations
    for _ in range(2):
        obs = simulate_observation(stored.id, confidence=0.88)
        await attach_observation(obs)
    
    # 5. Check verification triggered
    await asyncio.sleep(2)  # Wait for worker
    updated = await db.get_event(stored.id)
    assert updated.status == 'verified'
    assert updated.priority in ['high', 'critical']
    
    # 6. Check dashboard receives update
    ws_event = await websocket.receive_json()
    assert ws_event['type'] == 'event_verified'
```

#### 5.2 Load Testing
```bash
# 100 buses, 50 events each per day
locust -f load_test.py --users 100 --spawn-rate 10
```

**Targets**:
- API: 1000 req/s sustained
- Database: 500 writes/s
- WebSocket: 10,000 concurrent connections
- Spatial query: p95 < 100ms

#### 5.3 Security Audit
- [ ] JWT token rotation
- [ ] API key scoping per bus
- [ ] Rate limiting (100 req/min per bus)
- [ ] Input validation (GPS bounds, timestamp sanity)
- [ ] TLS for all communication
- [ ] SQL injection prevention (parameterized queries)
- [ ] CORS configuration

#### 5.4 Monitoring
```python
# Prometheus metrics
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app)

# Metrics:
# - events_ingested_total
# - events_verified_total
# - verification_latency_seconds
# - api_request_duration_seconds
# - active_buses_count
```

### Acceptance Criteria
- 100 buses simulated simultaneously
- < 2s latency detection → dashboard
- Zero data loss with network failures
- Pass security review
- Grafana dashboards operational

---

## PHASE 6: ADVANCED FEATURES (Week 11-12)

### Goal
Extended detection and analytics capabilities.

### Tasks
- [ ] Waterlogging detection (semantic segmentation)
- [ ] Traffic congestion analytics (vehicle counting + speed estimation)
- [ ] Road sign detection + OCR
- [ ] Route delay prediction (historical analysis)
- [ ] Origin-destination analytics
- [ ] Mobile app for field teams (React Native)

---

## REPOSITORY STRUCTURE

```
urbanpulse/
│
├── README.md                     # Project overview + setup
├── ARCHITECTURE.md               # System architecture (this document)
├── IMPLEMENTATION_PLAN.md        # This file
├── docker-compose.yml            # Full stack orchestration
├── .env.example                  # Environment variables template
├── .gitignore
│
├── frontend/                     # React Dashboard
│   ├── package.json
│   ├── vite.config.js
│   ├── tsconfig.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── types.ts              # TypeScript type definitions
│   │   ├── data.ts               # Simulated data (dev only)
│   │   ├── api/                  # API client (future)
│   │   │   └── client.ts
│   │   ├── components/
│   │   │   ├── MapView.tsx       # GIS map with Leaflet
│   │   │   ├── EventList.tsx     # Event management
│   │   │   ├── FleetPanel.tsx    # Bus monitoring
│   │   │   ├── PipelineView.tsx  # Processing pipeline
│   │   │   ├── AnalyticsPanel.tsx # Charts
│   │   │   ├── ArchitectureView.tsx # System docs
│   │   │   └── StatsBar.tsx      # KPI summary
│   │   └── hooks/                # Custom React hooks
│   │       ├── useEvents.ts
│   │       ├── useFleet.ts
│   │       └── useWebSocket.ts
│   └── public/
│       └── index.html
│
├── backend/                      # FastAPI Server
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/
│   │       └── 001_initial_schema.py
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI app entry
│   │   ├── config.py             # pydantic-settings
│   │   ├── database.py           # SQLAlchemy async
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── event.py
│   │   │   ├── observation.py
│   │   │   └── bus.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── event.py
│   │   │   ├── observation.py
│   │   │   └── bus.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py           # Dependency injection
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── router.py
│   │   │       ├── events.py
│   │   │       ├── fleet.py
│   │   │       └── analytics.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── event_service.py
│   │   │   ├── verification_service.py
│   │   │   ├── priority_service.py
│   │   │   └── geospatial_service.py
│   │   ├── workers/
│   │   │   ├── __init__.py
│   │   │   ├── celery_app.py
│   │   │   ├── verification_worker.py
│   │   │   └── priority_worker.py
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       └── validators.py
│   └── tests/
│       ├── conftest.py
│       ├── test_events.py
│       ├── test_verification.py
│       └── test_geospatial.py
│
├── edge/                         # Edge Processing (runs on bus)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── config.yaml               # Bus configuration
│   ├── main.py                   # Entry point
│   ├── camera/
│   │   ├── __init__.py
│   │   ├── capture.py            # Frame capture (camera or video)
│   │   └── gps_sync.py           # GPS + timestamp sync
│   ├── inference/
│   │   ├── __init__.py
│   │   ├── detector.py           # YOLO inference wrapper
│   │   ├── tracker.py            # ByteTrack integration
│   │   └── confidence_filter.py  # Threshold logic
│   ├── event/
│   │   ├── __init__.py
│   │   ├── creator.py            # Event packaging
│   │   └── validator.py          # Pre-transmission validation
│   ├── transport/
│   │   ├── __init__.py
│   │   ├── mqtt_client.py        # MQTT publisher
│   │   ├── rest_client.py        # HTTP fallback
│   │   └── offline_queue.py      # Local SQLite buffer
│   ├── models/
│   │   └── .gitkeep              # YOLO weights (downloaded separately)
│   ├── simulator/
│   │   ├── __init__.py
│   │   ├── video_simulator.py    # Dashcam playback
│   │   └── gps_track_generator.py # Simulated GPS tracks
│   └── tests/
│       ├── test_detector.py
│       ├── test_transport.py
│       └── test_pipeline.py
│
├── database/                     # Database setup
│   ├── Dockerfile
│   ├── init.sql                  # Schema creation
│   ├── seed.sql                  # Sample data
│   └── docker-compose.yml        # Standalone DB container
│
├── docs/
│   ├── API.md                    # API documentation
│   ├── DEPLOYMENT.md             # Production deployment guide
│   ├── USER_GUIDE.md             # Authority user guide
│   └── DATA_MODEL.md             # Detailed data model docs
│
├── scripts/
│   ├── setup.sh                  # Dev environment setup
│   ├── deploy.sh                 # Production deployment
│   ├── simulate_bus.py           # Bus simulator for testing
│   ├── generate_test_data.py     # Create realistic test events
│   └── benchmark.py              # Performance benchmarking
│
└── .github/
    └── workflows/
        ├── ci.yml                # CI pipeline
        └── deploy.yml            # CD pipeline
```

---

## QUICK START (Development)

```bash
# 1. Clone repository
git clone https://github.com/your-org/urbanpulse.git
cd urbanpulse

# 2. Start infrastructure
docker-compose up -d db redis

# 3. Setup backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 4. Setup frontend
cd ../frontend
npm install
npm run dev

# 5. (Optional) Start edge simulator
cd ../edge
pip install -r requirements.txt
python main.py --mode simulator --video test_data/dashcam.mp4
```

---

## TECHNOLOGY STACK SUMMARY

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + TypeScript + Tailwind | Authority dashboard |
| Maps | Leaflet + CARTO tiles | GIS visualization |
| Charts | Recharts | Analytics |
| Backend | FastAPI + Python 3.11 | API server |
| Database | PostgreSQL 15 + PostGIS 3.3 | Spatial storage |
| Cache | Redis 7 | Session + queue |
| Workers | Celery + Redis | Async processing |
| ML | YOLOv8 + Ultralytics | Object detection |
| Tracking | ByteTrack | Multi-object tracking |
| Transport | MQTT 5.0 (Eclipse Paho) | Edge → Central |
| Edge HW | Raspberry Pi 4 / Jetson Nano | On-bus compute |
| Container | Docker + Docker Compose | Deployment |
| CI/CD | GitHub Actions | Automation |
| Monitoring | Prometheus + Grafana | Observability |

---

**Document Version**: 1.0
**Last Updated**: 2026-01-15
**Status**: Approved for Implementation
