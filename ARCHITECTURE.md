# UrbanPulse — Production Architecture Design
## SIH26124: AI-Powered Mobile Urban Intelligence Platform

---

## 1. SYSTEM OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         URBANPULSE ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ BUS/SIMULATOR│───▶│EDGE PROCESSING│───▶│EVENT TRANSPORT│                  │
│  │              │    │              │    │              │                    │
│  │ • Camera Feed│    │ • YOLO CV    │    │ • MQTT/REST  │                    │
│  │ • GPS Data   │    │ • Filtering  │    │ • Offline Q  │                    │
│  │ • Timestamp  │    │ • Validation │    │ • Retry Logic│                    │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                    │                    │                          │
│         │                    │                    ▼                          │
│         │                    │         ┌──────────────────┐                 │
│         │                    │         │CENTRAL PLATFORM  │                 │
│         │                    │         │                  │                 │
│         │                    │         │ • API Gateway    │                 │
│         │                    │         │ • Event Ingestion│                 │
│         │                    │         │ • Auth/RBAC      │                 │
│         │                    │         └──────────────────┘                 │
│         │                    │                    │                          │
│         │                    │                    ▼                          │
│         │                    │         ┌──────────────────┐                 │
│         │                    │         │GEOSPATIAL ENGINE │                 │
│         │                    │         │                  │                 │
│         │                    │         │ • PostGIS        │                 │
│         │                    │         │ • Spatial Match  │                 │
│         │                    │         │ • Multi-Pass     │                 │
│         │                    │         │ • Priority Score │                 │
│         │                    │         └──────────────────┘                 │
│         │                    │                    │                          │
│         │                    │                    ▼                          │
│         │                    │         ┌──────────────────┐                 │
│         │                    │         │   DASHBOARD      │                 │
│         │                    │         │                  │                 │
│         │                    │         │ • GIS Map        │                 │
│         │                    │         │ • Event Queue    │                 │
│         │                    │         │ • Fleet Monitor  │                 │
│         │                    │         │ • Analytics      │                 │
│         │                    │         └──────────────────┘                 │
│         │                    │                    │                          │
│         │                    │                    ▼                          │
│         │                    │         ┌──────────────────┐                 │
│         │                    │         │   ACTION LAYER   │                 │
│         │                    │         │                  │                 │
│         │                    │         │ • Work Orders    │                 │
│         │                    │         │ • Dispatch       │                 │
│         │                    │         │ • Status Updates │                 │
│         └────────────────────┴─────────┴──────────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. LAYER-BY-LAYER DESIGN

### 2.1 BUS / SIMULATOR LAYER

**Responsibility**: Capture raw sensor data from public transport fleet

**Components**:
- **Camera Module**: USB/CSI camera capturing 30fps video
- **GPS Module**: GPS receiver providing lat/lng/speed/heading
- **Edge Computer**: Raspberry Pi 4 / Jetson Nano running inference
- **Local Storage**: SD card for offline buffering

**Data Flow**:
```
Camera → Frame Buffer → GPS Sync → Metadata Package
```

**Offline Behavior**:
- Store frames + GPS locally (SQLite)
- Sync when connectivity restored
- Max buffer: 2 hours of compressed video

**Scaling**: Each bus is independent unit; no coordination needed

---

### 2.2 EDGE PROCESSING LAYER

**Responsibility**: Run AI inference, filter detections, create structured events

**Components**:
- **YOLO Inference Engine**: Detect potholes, cracks, vehicles, signs
- **ByteTrack**: Track objects across frames
- **Confidence Filter**: Threshold ≥ 0.70
- **Temporal Validator**: Require 3+ frames within 2s window
- **Event Creator**: Package detection + GPS + timestamp

**Processing Pipeline**:
```
Frame → YOLO Detection → Confidence Check → Tracking → Temporal Validation → Event Creation
```

**Error Handling**:
- Model crash → restart service, log error
- Low confidence → discard detection
- GPS failure → use last known location, mark as uncertain

**Performance Targets**:
- Inference: < 50ms per frame (GPU) / < 200ms (CPU)
- Event creation: < 1s latency
- Memory: < 2GB RAM

---

### 2.3 EVENT TRANSPORT LAYER

**Responsibility**: Securely transmit events from edge to central platform

**Communication Methods**:
- **Primary**: MQTT over TLS (port 8883)
- **Fallback**: HTTPS REST API
- **Offline Queue**: Local SQLite with retry logic

**MQTT Topic Structure**:
```
urbanpulse/{city_id}/bus/{bus_id}/events
urbanpulse/{city_id}/bus/{bus_id}/heartbeat
urbanpulse/{city_id}/bus/{bus_id}/status
```

**Message Format** (MQTT Payload):
```json
{
  "event_id": "uuid-v4",
  "bus_id": "BUS-KA01-001",
  "route_id": "201-C",
  "timestamp": "2026-01-15T10:30:45.123Z",
  "latitude": 12.9355,
  "longitude": 77.6240,
  "event_type": "pothole",
  "confidence": 0.87,
  "frame_reference": "s3://frames/2026/01/15/BUS-KA01-001/1705312245.jpg",
  "camera_id": "CAM-FRONT-01",
  "speed_kmh": 28,
  "heading": 45.2,
  "detection_bbox": [120, 340, 280, 480],
  "status": "unverified",
  "verification_count": 0,
  "priority": null,
  "created_at": "2026-01-15T10:30:45.123Z",
  "updated_at": "2026-01-15T10:30:45.123Z"
}
```

**Error Handling**:
- Network failure → queue locally, retry with exponential backoff
- Message too large → compress frame reference, send metadata only
- Authentication failure → refresh JWT token

**Offline Behavior**:
- Store up to 10,000 events locally
- Sync in batches when online
- Priority: verified events > unverified events

---

### 2.4 CENTRAL PLATFORM LAYER

**Responsibility**: Ingest events, authenticate, route to geospatial engine

**Components**:
- **API Gateway**: FastAPI with rate limiting
- **Event Ingestion Service**: Validate and store incoming events
- **Authentication Service**: JWT + API key management
- **Message Queue**: Redis/RabbitMQ for async processing

**API Endpoints**:

```
POST /api/v1/events
  - Ingest new event from bus
  - Auth: API key or JWT
  - Rate limit: 100 req/min per bus

GET /api/v1/events
  - Query events with filters
  - Auth: JWT (authority role)
  - Params: bbox, event_type, status, date_range

GET /api/v1/events/{event_id}
  - Get single event details
  - Auth: JWT

PATCH /api/v1/events/{event_id}/status
  - Update event status (verified, actioned, resolved)
  - Auth: JWT (authority role)

GET /api/v1/fleet/status
  - Get all bus locations and status
  - Auth: JWT

POST /api/v1/fleet/{bus_id}/commands
  - Send command to bus (restart, update config)
  - Auth: JWT (admin role)
```

**Data Validation**:
- Schema validation (Pydantic)
- GPS bounds check (within city limits)
- Timestamp sanity (not future, not > 24h old)
- Confidence range (0.0 - 1.0)

**Error Handling**:
- Invalid event → reject with 400, log details
- Database error → retry 3x, then alert
- Auth failure → 401/403, log attempt

**Scaling Strategy**:
- Horizontal scaling: Multiple API instances behind load balancer
- Database: Read replicas for query load
- Queue: Partition by bus_id for parallel processing

---

### 2.5 GEOSPATIAL INTELLIGENCE LAYER

**Responsibility**: Spatial matching, multi-pass verification, priority scoring

**Components**:
- **PostGIS Database**: Store events with geometry
- **Spatial Matching Service**: Find nearby events within radius
- **Verification Engine**: Aggregate observations, confirm events
- **Priority Scorer**: Calculate severity × frequency × recency

**Database Schema** (PostgreSQL + PostGIS):

```sql
-- Events table
CREATE TABLE events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id VARCHAR(50) NOT NULL,
  route_id VARCHAR(50) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  confidence FLOAT CHECK (confidence >= 0.0 AND confidence <= 1.0),
  frame_reference TEXT,
  camera_id VARCHAR(50),
  speed_kmh FLOAT,
  heading FLOAT,
  detection_bbox JSONB,
  status VARCHAR(20) DEFAULT 'unverified',
  verification_count INT DEFAULT 0,
  priority VARCHAR(20),
  severity INT CHECK (severity >= 1 AND severity <= 10),
  description TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create spatial index
CREATE INDEX idx_events_location ON events USING GIST (location);
CREATE INDEX idx_events_timestamp ON events (timestamp DESC);
CREATE INDEX idx_events_status ON events (status);
CREATE INDEX idx_events_type ON events (event_type);

-- Observations table (raw detections before aggregation)
CREATE TABLE observations (
  observation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(event_id),
  bus_id VARCHAR(50) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  confidence FLOAT NOT NULL,
  frame_reference TEXT,
  raw_detection JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_observations_event ON observations (event_id);
CREATE INDEX idx_observations_timestamp ON observations (timestamp DESC);

-- Buses table
CREATE TABLE buses (
  bus_id VARCHAR(50) PRIMARY KEY,
  route_id VARCHAR(50) NOT NULL,
  route_name TEXT,
  status VARCHAR(20) DEFAULT 'inactive',
  last_location GEOGRAPHY(POINT, 4326),
  last_ping TIMESTAMPTZ,
  camera_status VARCHAR(20) DEFAULT 'unknown',
  firmware_version VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verification rules
CREATE TABLE verification_rules (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  min_observations INT DEFAULT 3,
  time_window_seconds INT DEFAULT 3600,
  spatial_radius_meters FLOAT DEFAULT 50.0,
  min_confidence FLOAT DEFAULT 0.70,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default rules
INSERT INTO verification_rules (event_type, min_observations, time_window_seconds, spatial_radius_meters)
VALUES 
  ('pothole', 3, 3600, 50.0),
  ('road_crack', 2, 7200, 30.0),
  ('waterlogging', 3, 1800, 100.0),
  ('traffic_congestion', 5, 900, 200.0);
```

**Spatial Matching Algorithm**:
```python
def find_nearby_events(new_event, radius_meters=50):
    """
    Find existing events within radius of new detection
    """
    query = """
    SELECT event_id, location, verification_count
    FROM events
    WHERE event_type = %s
      AND status IN ('unverified', 'pending_verify', 'verified')
      AND ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
        %s
      )
      AND timestamp > NOW() - INTERVAL '24 hours'
    ORDER BY timestamp DESC
    LIMIT 10
    """
    return db.execute(query, (new_event.event_type, 
                              new_event.longitude, 
                              new_event.latitude, 
                              radius_meters))
```

**Multi-Pass Verification Logic**:
```python
def verify_event(event_id):
    """
    Check if event has enough observations to be verified
    """
    event = get_event(event_id)
    rule = get_verification_rule(event.event_type)
    
    observations = get_observations(event_id)
    
    # Check criteria
    if len(observations) >= rule.min_observations:
        avg_confidence = mean([obs.confidence for obs in observations])
        
        if avg_confidence >= rule.min_confidence:
            # Check temporal window
            time_span = (observations[-1].timestamp - 
                        observations[0].timestamp).total_seconds()
            
            if time_span <= rule.time_window_seconds:
                # VERIFIED
                update_event_status(event_id, 'verified')
                calculate_priority(event_id)
                return True
    
    return False
```

**Priority Scoring Formula**:
```python
def calculate_priority(event_id):
    event = get_event(event_id)
    observations = get_observations(event_id)
    
    # Severity (1-10): based on event type and size
    severity = estimate_severity(event.event_type, observations)
    
    # Frequency score: more observations = higher priority
    freq_score = min(len(observations) / 5.0, 1.0)  # cap at 5 obs
    
    # Recency score: newer events get priority
    age_hours = (now() - event.last_detected).total_seconds() / 3600
    recency_score = max(0, 1 - (age_hours / 24))  # decay over 24h
    
    # Confidence score
    conf_score = mean([obs.confidence for obs in observations])
    
    # Final priority score (0-100)
    priority_score = (
        severity * 10 * 0.4 +      # 40% weight
        freq_score * 100 * 0.25 +   # 25% weight
        recency_score * 100 * 0.2 + # 20% weight
        conf_score * 100 * 0.15     # 15% weight
    )
    
    # Map to priority level
    if priority_score >= 80:
        priority = 'critical'
    elif priority_score >= 60:
        priority = 'high'
    elif priority_score >= 40:
        priority = 'medium'
    else:
        priority = 'low'
    
    update_event_priority(event_id, priority, priority_score)
```

**Error Handling**:
- Spatial query timeout → increase index maintenance, partition by city
- Verification failure → log, retry in 5 minutes
- Priority calculation error → default to 'medium', alert ops

**Scaling Strategy**:
- Database partitioning by city_id or month
- Materialized views for dashboard queries
- Cache hot events in Redis
- Async verification workers (Celery/RQ)

---

### 2.6 DASHBOARD LAYER

**Responsibility**: Visualize events, fleet, and analytics for authorities

**Components**:
- **Web Dashboard**: React + TypeScript + Tailwind
- **GIS Map**: Leaflet with custom layers
- **Real-time Updates**: WebSocket for live events
- **Authentication**: JWT-based role access

**Features**:
- Interactive map with event markers (color-coded by status/priority)
- Event list with filtering and search
- Fleet monitoring (bus locations, status)
- Pipeline visualization (processing stages)
- Analytics charts (detection trends, verification rates)
- Work order management

**WebSocket Events**:
```
ws://dashboard/api/ws/events
  → new_event: New event detected
  → event_verified: Event verified
  → event_updated: Event status changed
  → bus_location: Bus GPS update
```

**Error Handling**:
- WebSocket disconnect → auto-reconnect with backoff
- Map tile failure → fallback to cached tiles
- Large dataset → pagination + spatial clustering

---

### 2.7 ACTION LAYER

**Responsibility**: Convert verified events into maintenance work orders

**Components**:
- **Work Order Generator**: Create maintenance tickets
- **Dispatch System**: Assign to field teams
- **Status Tracking**: Monitor repair progress
- **Feedback Loop**: Update event status when resolved

**Workflow**:
```
Verified Event → Auto-Generate Work Order → Assign Team → Dispatch → Track → Resolve → Update Event
```

**Integration**:
- Email/SMS notifications
- Mobile app for field teams
- Photo upload for verification
- SLA tracking

---

## 3. DATA CONTRACTS

### 3.1 Event Object (Canonical)

```typescript
interface Event {
  event_id: string;              // UUID
  bus_id: string;                // Bus identifier
  route_id: string;              // Route number
  timestamp: string;             // ISO 8601 UTC
  latitude: number;              // Decimal degrees
  longitude: number;             // Decimal degrees
  event_type: EventType;         // Enum: pothole, road_crack, etc.
  confidence: number;            // 0.0 - 1.0
  frame_reference?: string;      // S3/CDN URL to frame
  camera_id: string;             // Camera identifier
  speed_kmh?: number;            // Bus speed at detection
  heading?: number;              // Bus heading in degrees
  detection_bbox?: number[];     // [x1, y1, x2, y2]
  status: EventStatus;           // unverified, pending_verify, verified, actioned, resolved
  verification_count: number;    // Number of observations
  priority?: Priority;           // critical, high, medium, low
  severity?: number;             // 1-10
  description?: string;          // Human-readable description
  address?: string;              // Reverse geocoded address
  created_at: string;            // ISO 8601 UTC
  updated_at: string;            // ISO 8601 UTC
}

type EventType = 
  | 'pothole'
  | 'road_crack'
  | 'waterlogging'
  | 'traffic_congestion'
  | 'vehicle_count'
  | 'road_sign_damage'
  | 'zebra_crossing_deficiency';

type EventStatus = 
  | 'unverified'
  | 'pending_verify'
  | 'verified'
  | 'actioned'
  | 'resolved';

type Priority = 'critical' | 'high' | 'medium' | 'low';
```

### 3.2 Observation Object (Raw Detection)

```typescript
interface Observation {
  observation_id: string;        // UUID
  event_id?: string;             // Linked event (null if not yet matched)
  bus_id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  confidence: number;
  frame_reference?: string;
  raw_detection: {
    bbox: number[];
    class_id: number;
    class_name: string;
    model_version: string;
  };
  created_at: string;
}
```

### 3.3 Bus Object

```typescript
interface Bus {
  bus_id: string;
  route_id: string;
  route_name?: string;
  status: 'active' | 'idle' | 'maintenance' | 'offline';
  current_location?: {
    latitude: number;
    longitude: number;
  };
  last_ping?: string;
  camera_status: 'online' | 'offline' | 'error';
  events_detected: number;
  speed?: number;
  firmware_version?: string;
}
```

---

## 4. REPOSITORY STRUCTURE

```
urbanpulse/
├── README.md
├── ARCHITECTURE.md
├── docker-compose.yml
├── .env.example
│
├── edge/                          # Edge processing (runs on bus)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── config.yaml
│   ├── main.py                    # Entry point
│   ├── camera/
│   │   ├── capture.py             # Frame capture
│   │   └── gps_sync.py            # GPS timestamp sync
│   ├── inference/
│   │   ├── yolo_detector.py       # YOLO inference
│   │   ├── tracker.py             # ByteTrack
│   │   └── confidence_filter.py   # Threshold logic
│   ├── event/
│   │   ├── creator.py             # Event packaging
│   │   └── validator.py           # Temporal validation
│   ├── transport/
│   │   ├── mqtt_client.py         # MQTT publisher
│   │   ├── rest_client.py         # HTTP fallback
│   │   └── offline_queue.py       # Local buffering
│   ├── models/
│   │   └── yolov8n.pt             # Pre-trained model
│   └── tests/
│
├── backend/                       # Central platform
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic/                   # DB migrations
│   │   └── versions/
│   ├── app/
│   │   ├── main.py                # FastAPI app
│   │   ├── config.py              # Settings
│   │   ├── database.py            # DB connection
│   │   ├── models/                # SQLAlchemy models
│   │   │   ├── event.py
│   │   │   ├── observation.py
│   │   │   └── bus.py
│   │   ├── schemas/               # Pydantic schemas
│   │   │   ├── event.py
│   │   │   ├── observation.py
│   │   │   └── bus.py
│   │   ├── api/                   # API routes
│   │   │   ├── v1/
│   │   │   │   ├── events.py
│   │   │   │   ├── fleet.py
│   │   │   │   └── analytics.py
│   │   │   └── websocket.py
│   │   ├── services/              # Business logic
│   │   │   ├── event_service.py
│   │   │   ├── verification_service.py
│   │   │   ├── priority_service.py
│   │   │   └── geospatial_service.py
│   │   ├── workers/               # Background tasks
│   │   │   ├── verification_worker.py
│   │   │   └── priority_worker.py
│   │   └── utils/
│   │       ├── auth.py
│   │       └── validators.py
│   └── tests/
│
├── frontend/                      # Dashboard (current project)
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── MapView.tsx
│   │   │   ├── EventList.tsx
│   │   │   ├── FleetPanel.tsx
│   │   │   ├── PipelineView.tsx
│   │   │   ├── AnalyticsPanel.tsx
│   │   │   └── ArchitectureView.tsx
│   │   ├── types.ts
│   │   └── data.ts
│   └── public/
│
├── database/                      # DB setup
│   ├── init.sql                   # Schema creation
│   ├── seed.sql                   # Sample data
│   └── docker-compose.yml         # PostGIS container
│
├── docs/
│   ├── API.md                     # API documentation
│   ├── DEPLOYMENT.md              # Deployment guide
│   └── USER_GUIDE.md              # Authority user guide
│
└── scripts/
    ├── setup.sh                   # Dev environment setup
    ├── deploy.sh                  # Production deployment
    └── simulate_bus.py            # Bus simulator for testing
```

---

## 5. IMPLEMENTATION PLAN

### Phase 1: Foundation (Week 1-2)

**Goal**: Working end-to-end data flow with simulated data

**Tasks**:
1. ✅ Frontend dashboard (current state)
2. PostgreSQL + PostGIS database setup
3. Basic FastAPI backend with event CRUD
4. Event ingestion API endpoint
5. Database migrations (Alembic)
6. Docker Compose for local dev

**Deliverables**:
- Database with event/observation/bus tables
- API: POST /events, GET /events, GET /fleet
- Frontend connected to real backend
- Docker Compose running all services

**Acceptance Criteria**:
- Can POST event via API and see it on dashboard
- Events persist in database
- Fleet status updates in real-time

---

### Phase 2: Geospatial Intelligence (Week 3-4)

**Goal**: Multi-pass verification and priority scoring

**Tasks**:
1. Spatial matching service (PostGIS queries)
2. Observation aggregation logic
3. Verification engine (rule-based)
4. Priority scoring algorithm
5. Background workers (Celery)
6. WebSocket for real-time updates

**Deliverables**:
- Automatic event verification
- Priority calculation
- Real-time dashboard updates
- Verification analytics

**Acceptance Criteria**:
- Multiple observations of same location → verified event
- Priority score visible on dashboard
- Verified events trigger notifications

---

### Phase 3: Edge AI Pipeline (Week 5-6)

**Goal**: Real computer vision detection

**Tasks**:
1. YOLO model training/fine-tuning on road damage dataset
2. Edge inference pipeline (camera → detection)
3. GPS synchronization
4. Event creation from detections
5. MQTT transport layer
6. Offline queue with retry logic

**Deliverables**:
- Working edge service detecting potholes
- Events transmitted to central platform
- Offline buffering and sync
- Bus simulator for testing

**Acceptance Criteria**:
- Detect potholes in test video with >80% accuracy
- Events appear on dashboard within 5s of detection
- System works with intermittent connectivity

---

### Phase 4: Integration & Testing (Week 7-8)

**Goal**: Production-ready system

**Tasks**:
1. End-to-end testing
2. Performance optimization
3. Security hardening (auth, rate limiting)
4. Monitoring and logging
5. Documentation
6. Deployment scripts

**Deliverables**:
- Fully integrated system
- Load testing results
- Security audit
- User documentation
- Deployment guide

**Acceptance Criteria**:
- Handle 100 buses simultaneously
- <2s latency from detection to dashboard
- Zero data loss with network failures
- Pass security review

---

### Phase 5: Advanced Features (Week 9-10)

**Goal**: Additional capabilities

**Tasks**:
1. Waterlogging detection
2. Traffic congestion analytics
3. Vehicle counting
4. ANPR (optional)
5. Route delay prediction
6. Mobile app for field teams

**Deliverables**:
- Extended detection capabilities
- Advanced analytics
- Field team workflow

---

## 6. SCALING STRATEGY

### Horizontal Scaling

**API Layer**:
- Multiple FastAPI instances behind nginx
- Stateless design (session in Redis)
- Auto-scaling based on CPU/memory

**Database**:
- Read replicas for dashboard queries
- Connection pooling (PgBouncer)
- Partitioning by city_id or month

**Workers**:
- Celery workers scale independently
- Queue partitioning by bus_id
- Priority queues for critical events

### Vertical Scaling

**Edge Devices**:
- Jetson Nano for GPU inference
- 4GB RAM minimum
- 64GB storage for offline buffer

**Central Server**:
- 16GB RAM minimum
- 8 CPU cores
- SSD storage for database

### Data Volume Estimates

**Per Bus Per Day**:
- 8 hours operation
- 30 fps × 8 hours = 864,000 frames
- ~50 events detected (after filtering)
- ~500KB per event (metadata + frame reference)
- Total: ~25MB per bus per day

**Fleet of 100 Buses**:
- 5,000 events per day
- 2.5GB storage per day
- ~75GB per month

**Database Growth**:
- Events table: ~1.5M rows per year
- Observations table: ~5M rows per year
- With indexing: ~100GB per year

### Performance Targets

**Latency**:
- Edge inference: <50ms per frame
- Event transmission: <1s
- Dashboard update: <2s
- Spatial query: <100ms

**Throughput**:
- API: 1000 req/s
- Database: 500 writes/s
- WebSocket: 10,000 connections

**Availability**:
- 99.5% uptime target
- Graceful degradation (offline mode)
- Auto-recovery from failures

---

## 7. SECURITY CONSIDERATIONS

### Authentication
- JWT tokens for API access
- API keys for bus authentication
- Role-based access control (RBAC)
- Token rotation every 24h

### Data Protection
- TLS 1.3 for all communication
- Encrypted database at rest
- Frame storage in private S3 bucket
- GDPR compliance for any PII

### Network Security
- VPN for bus communication
- Firewall rules (whitelist bus IPs)
- Rate limiting on all endpoints
- DDoS protection

### Audit Logging
- All API calls logged
- Event status changes tracked
- User actions audited
- 90-day log retention

---

## 8. MONITORING & OBSERVABILITY

### Metrics
- Event detection rate
- Verification success rate
- API latency (p50, p95, p99)
- Database query performance
- Bus uptime percentage
- Network connectivity

### Logging
- Structured JSON logs
- Centralized logging (ELK/Loki)
- Log levels: DEBUG, INFO, WARN, ERROR
- Correlation IDs for tracing

### Alerts
- Bus offline > 30 minutes
- API error rate > 5%
- Database connection failures
- Low disk space on edge devices
- Verification backlog > 1000 events

### Dashboards
- Grafana for system metrics
- Custom dashboard for business KPIs
- Real-time event flow visualization

---

## 9. DEPLOYMENT ARCHITECTURE

### Development
```
docker-compose up
  → frontend (port 3000)
  → backend (port 8000)
  → postgres (port 5432)
  → redis (port 6379)
```

### Production
```
┌─────────────────────────────────────────┐
│           Load Balancer (nginx)          │
└─────────────────────────────────────────┘
              │              │
              ▼              ▼
    ┌─────────────┐  ┌─────────────┐
    │  Frontend   │  │   Backend   │
    │  (React)    │  │  (FastAPI)  │
    │  Port 443   │  │  Port 8000  │
    └─────────────┘  └─────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Postgres │  │  Redis   │  │  Celery  │
        │ + PostGIS│  │  Cache   │  │ Workers  │
        └──────────┘  └──────────┘  └──────────┘
```

### Infrastructure
- **Cloud**: AWS / Azure / GCP
- **Containers**: Docker + Kubernetes (optional)
- **Database**: RDS PostgreSQL with PostGIS
- **Cache**: ElastiCache Redis
- **Storage**: S3 for frames
- **CDN**: CloudFront for dashboard assets

---

## 10. TESTING STRATEGY

### Unit Tests
- Edge inference pipeline
- Verification logic
- Priority calculation
- API validation

### Integration Tests
- API endpoints
- Database operations
- MQTT communication
- WebSocket connections

### End-to-End Tests
- Full detection → dashboard flow
- Offline sync scenario
- Multi-bus simulation
- Load testing

### Performance Tests
- 100 buses simultaneous
- 10,000 events per hour
- Spatial query performance
- Dashboard rendering with 1000+ events

---

## 11. RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| Low detection accuracy | High | Fine-tune model on local data, ensemble methods |
| Network connectivity loss | Medium | Offline queue, batch sync, local storage |
| GPS inaccuracy | Medium | Sensor fusion, map matching, outlier detection |
| Database performance | Medium | Indexing, partitioning, read replicas |
| Scalability limits | Medium | Horizontal scaling, caching, async processing |
| Security breach | Critical | Regular audits, encryption, access controls |
| Model drift | Medium | Continuous monitoring, retraining pipeline |

---

## 12. SUCCESS METRICS

### Technical
- Detection accuracy: >85%
- False positive rate: <10%
- Verification success rate: >70%
- System uptime: >99.5%
- End-to-end latency: <5s

### Business
- Events detected per day: >1000
- Verified events per day: >500
- Average time to action: <24h
- Fleet coverage: >80% of routes
- Authority satisfaction: >4/5

---

## 13. FUTURE ENHANCEMENTS

### Phase 2 Features
- Predictive maintenance (road degradation trends)
- Traffic pattern analysis
- Pedestrian safety analytics
- Integration with traffic signals
- Mobile app for citizens to report issues

### Phase 3 Features
- Autonomous vehicle integration
- V2X communication
- Edge computing optimization
- Federated learning across cities
- AI-powered dispatch optimization

---

## 14. REFERENCES

- **SIH26124**: Problem statement
- **YOLOv8**: Object detection model
- **PostGIS**: Spatial database extension
- **FastAPI**: Python web framework
- **Leaflet**: Mapping library
- **MQTT**: IoT messaging protocol

---

## 15. CONTACT & SUPPORT

**Development Team**: SIH 2026 Team
**Organization**: Bharat Electronics Limited (BEL)
**Theme**: Smart Automation
**Category**: Software

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-15  
**Status**: Approved for Implementation
