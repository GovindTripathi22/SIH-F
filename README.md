# UrbanPulse
## AI-Powered Mobile Urban Intelligence Platform Using Public Transport Fleet

**SIH 2026 | Problem Statement: SIH26124**
**Organization: Bharat Electronics Limited (BEL)**
**Theme: Smart Automation | Category: Software**

---

## 🎯 Core Concept

```
PUBLIC BUS = MOBILE URBAN SENSOR
```

UrbanPulse transforms existing public buses into a distributed mobile sensing network. Bus-mounted cameras and GPS detect road/infrastructure events in real-time, aggregate observations across the fleet, verify repeated observations through multi-pass analysis, and deliver actionable urban intelligence to authorities.

### Key Innovation

> **One observation = Possible event**
> **Multiple consistent observations = Verified intelligence**

The system never acts on a single AI detection. Events must pass through confidence filtering, spatial matching, temporal validation, and multi-pass verification before becoming actionable maintenance priorities.

---

## 🏗️ System Architecture

```
BUS/SIMULATOR → EDGE PROCESSING → EVENT TRANSPORT → CENTRAL PLATFORM
                                                              ↓
ACTION ← DASHBOARD ← GEOSPATIAL INTELLIGENCE ←──────────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete system design.

---

## 📊 Current Status

| Module | Status | Description |
|--------|--------|-------------|
| **Frontend Dashboard** | ✅ BUILT | React + TypeScript + Tailwind CSS |
| **GIS Map** | ✅ BUILT | Leaflet with CARTO dark tiles |
| **Event Management** | ✅ BUILT | Multi-pass verification timeline |
| **Fleet Monitor** | ✅ BUILT | Bus status and location tracking |
| **Pipeline Visualization** | ✅ BUILT | Real-time processing stages |
| **Analytics** | ✅ BUILT | Detection trends and distributions |
| **Architecture Docs** | ✅ BUILT | Complete system design |
| **Video Simulator** | ◐ IN PROGRESS | Dashcam playback for testing |
| **FastAPI Backend** | ○ PLANNED | API server (Phase 2) |
| **PostgreSQL + PostGIS** | ○ PLANNED | Spatial database (Phase 2) |
| **YOLO Detection** | ○ PLANNED | Edge AI inference (Phase 4) |
| **MQTT Transport** | ○ PLANNED | Event transmission (Phase 4) |
| **Action Workflow** | ○ PLANNED | Work orders + dispatch (Phase 5) |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The dashboard will be available at `http://localhost:3000`.

---

## 📁 Project Structure

```
urbanpulse/
├── src/                          # Frontend source
│   ├── App.tsx                   # Main application
│   ├── types.ts                  # TypeScript type definitions
│   ├── data.ts                   # Simulated data layer
│   ├── components/
│   │   ├── MapView.tsx           # GIS map (Leaflet)
│   │   ├── EventList.tsx         # Event management
│   │   ├── FleetPanel.tsx        # Bus monitoring
│   │   ├── PipelineView.tsx      # Processing pipeline
│   │   ├── AnalyticsPanel.tsx    # Charts and analytics
│   │   ├── ArchitectureView.tsx  # System architecture
│   │   └── StatsBar.tsx          # KPI summary
│   └── index.css                 # Tailwind styles
├── ARCHITECTURE.md               # Complete system design
├── IMPLEMENTATION_PLAN.md        # Phased development roadmap
└── README.md                     # This file
```

---

## 🎨 Dashboard Features

### 1. GIS Map View
- Interactive Leaflet map with CARTO dark tiles
- Event markers color-coded by type and priority
- Bus locations with real-time status
- Click events to see verification timeline
- Spatial clustering for dense areas

### 2. Event Management
- List of all detected events
- Multi-pass verification timeline showing observation chain
- Status indicators (unverified → pending → verified → actioned)
- Priority badges (critical, high, medium, low)
- Confidence scores and observation counts

### 3. Fleet Monitoring
- All buses with current status
- GPS location and speed
- Camera health indicators
- Events detected per bus
- Last ping timestamp

### 4. Pipeline Visualization
- Real-time processing stages
- Throughput metrics (events/second)
- Stage status indicators
- Data flow animation

### 5. Analytics Dashboard
- Event type distribution (donut chart)
- Detection confidence histogram
- Verification status breakdown
- Priority distribution
- Hourly detection trends

### 6. Architecture View
- Complete system architecture diagram
- Module status (BUILT / IN PROGRESS / FUTURE)
- Technology stack per layer
- Data flow visualization
- Event schema documentation
- Database schema overview
- Communication protocols
- Error handling strategy
- Scaling approach

---

## 📋 Event Schema

```typescript
interface RoadEvent {
  id: string;                    // UUID
  type: EventType;               // pothole, road_crack, waterlogging, etc.
  location: { lat: number; lng: number };
  firstDetected: string;         // ISO 8601
  lastDetected: string;          // ISO 8601
  observations: Observation[];   // All detections contributing to this event
  status: EventStatus;           // unverified | pending_verify | verified | actioned
  priority: Priority;            // critical | high | medium | low
  severity: number;              // 1-10
  description: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

interface Observation {
  id: string;
  busId: string;
  timestamp: string;
  confidence: number;            // 0.0 - 1.0
  location: { lat: number; lng: number };
}
```

---

## 🔄 Multi-Pass Verification Logic

```
OBSERVATION 1 (Bus A, 10:30) ─┐
                                ├─→ SPATIAL MATCH ─→ SAME EVENT?
OBSERVATION 2 (Bus B, 11:15) ─┤                      │
                                │                     YES
OBSERVATION 3 (Bus A, 12:00) ─┘                      ↓
                                              TEMPORAL CHECK
                                                      │
                                              WITHIN WINDOW?
                                                      │
                                                      YES
                                                      ↓
                                                ✓ VERIFIED
                                                      ↓
                                              PRIORITY SCORE
                                                      ↓
                                              AUTHORITY QUEUE
```

**Verification Rules** (per event type):
- Pothole: 3+ observations within 1 hour, 50m radius, avg confidence ≥ 0.70
- Road crack: 2+ observations within 2 hours, 30m radius
- Waterlogging: 3+ observations within 30 minutes, 100m radius
- Traffic congestion: 5+ observations within 15 minutes, 200m radius

---

## 🎯 Priority Scoring Formula

```
Priority Score = (
    severity × 10 × 0.40 +      // 40% weight: How bad is it?
    frequency × 100 × 0.25 +     // 25% weight: How often detected?
    recency × 100 × 0.20 +       // 20% weight: How recent?
    confidence × 100 × 0.15      // 15% weight: How certain?
)

Score ≥ 80 → CRITICAL
Score ≥ 60 → HIGH
Score ≥ 40 → MEDIUM
Score < 40 → LOW
```

---

## 🛠️ Technology Stack

### Frontend (Current)
- **React 18** — UI framework
- **TypeScript** — Type safety
- **Tailwind CSS v4** — Styling
- **Leaflet** — GIS mapping
- **Recharts** — Data visualization
- **Framer Motion** — Animations
- **Lucide React** — Icons

### Backend (Planned)
- **FastAPI** — Python web framework
- **PostgreSQL 15 + PostGIS 3.3** — Spatial database
- **Redis 7** — Caching + message queue
- **Celery** — Background workers
- **SQLAlchemy** — ORM
- **Alembic** — Database migrations

### Edge AI (Planned)
- **YOLOv8n** — Object detection
- **ByteTrack** — Multi-object tracking
- **OpenCV** — Image processing
- **Eclipse Paho** — MQTT client
- **SQLite** — Offline buffer

### Infrastructure (Planned)
- **Docker + Docker Compose** — Containerization
- **MQTT 5.0 over TLS** — Edge communication
- **GitHub Actions** — CI/CD
- **Prometheus + Grafana** — Monitoring

---

## 📚 Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Complete system architecture
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) — Phased development roadmap

---

## 🧪 Testing Strategy

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
- Load testing (100 buses)

---

## 📈 Performance Targets

| Metric | Target |
|--------|--------|
| Edge inference latency | < 50ms per frame |
| Event transmission | < 1s |
| Dashboard update | < 2s |
| Spatial query (p95) | < 100ms |
| API throughput | 1000 req/s |
| System uptime | 99.5% |
| Detection accuracy | > 85% |
| False positive rate | < 10% |

---

## 🔒 Security

- JWT authentication for dashboard access
- API keys for bus authentication
- TLS 1.3 for all communication
- Role-based access control (RBAC)
- Rate limiting on all endpoints
- Input validation and sanitization
- Encrypted database at rest
- Audit logging for all actions

---

## 📊 Data Volume Estimates

**Per Bus Per Day**:
- 8 hours operation
- ~50 events detected (after filtering)
- ~25MB data (metadata + frame references)

**Fleet of 100 Buses**:
- 5,000 events/day
- 2.5GB storage/day
- ~75GB/month

---

## 🚧 Development Phases

### Phase 1: Foundation ✅ (Current)
- Frontend dashboard with simulated data
- Architecture documentation
- Type definitions

### Phase 2: Backend + Database (Week 3-4)
- FastAPI server
- PostgreSQL + PostGIS
- Event CRUD API
- Docker Compose

### Phase 3: Geospatial Intelligence (Week 5-6)
- Spatial matching
- Multi-pass verification
- Priority scoring
- Background workers

### Phase 4: Edge AI Pipeline (Week 7-8)
- YOLO model training
- Edge inference
- GPS integration
- MQTT transport

### Phase 5: Integration & Testing (Week 9-10)
- End-to-end testing
- Load testing
- Security audit
- Monitoring setup

### Phase 6: Advanced Features (Week 11-12)
- Waterlogging detection
- Traffic analytics
- Mobile app for field teams

---

## 🤝 Contributing

This is a Smart India Hackathon 2026 project. For questions or contributions, contact the development team.

---

## 📄 License

This project is developed for SIH 2026 under the guidance of Bharat Electronics Limited (BEL).

---

## 📞 Contact

**Problem Statement**: SIH26124
**Organization**: Bharat Electronics Limited (BEL)
**Theme**: Smart Automation
**Category**: Software

---

**Version**: 1.0.0
**Last Updated**: 2026-01-15
