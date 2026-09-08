import { ArchitectureModule, ModuleStatus } from '../types';

const STATUS_COLORS: Record<ModuleStatus, string> = {
  built: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  future: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const STATUS_LABELS: Record<ModuleStatus, string> = {
  built: '✓ BUILT',
  in_progress: '◐ IN PROGRESS',
  future: '○ FUTURE',
};

const modules: ArchitectureModule[] = [
  // Bus / Simulator Layer
  {
    name: 'Camera Feed Capture',
    layer: 'BUS / SIMULATOR',
    status: 'future',
    description: 'USB/CSI camera capturing 30fps video from bus windshield',
    techStack: ['OpenCV', 'V4L2', 'USB Camera'],
  },
  {
    name: 'GPS Module',
    layer: 'BUS / SIMULATOR',
    status: 'future',
    description: 'GPS receiver providing lat/lng/speed/heading at 1Hz',
    techStack: ['GPSD', 'NMEA Protocol'],
  },
  {
    name: 'Video Simulator',
    layer: 'BUS / SIMULATOR',
    status: 'in_progress',
    description: 'Playback recorded dashcam footage as substitute for live camera',
    techStack: ['Python', 'OpenCV', 'FFmpeg'],
  },
  // Edge Processing Layer
  {
    name: 'YOLO Inference Engine',
    layer: 'EDGE PROCESSING',
    status: 'future',
    description: 'YOLOv8n model for pothole, crack, vehicle, sign detection',
    techStack: ['Ultralytics YOLOv8', 'ONNX Runtime'],
  },
  {
    name: 'ByteTrack Object Tracker',
    layer: 'EDGE PROCESSING',
    status: 'future',
    description: 'Track objects across frames to avoid duplicate detections',
    techStack: ['ByteTrack', 'OpenCV'],
  },
  {
    name: 'Confidence Filter',
    layer: 'EDGE PROCESSING',
    status: 'future',
    description: 'Discard detections below 0.70 confidence threshold',
    techStack: ['Python'],
  },
  {
    name: 'Event Creator',
    layer: 'EDGE PROCESSING',
    status: 'future',
    description: 'Package detection + GPS + timestamp into structured event',
    techStack: ['Python', 'Pydantic'],
  },
  // Event Transport Layer
  {
    name: 'MQTT Publisher',
    layer: 'EVENT TRANSPORT',
    status: 'future',
    description: 'Secure MQTT over TLS for event transmission to central platform',
    techStack: ['Eclipse Paho', 'MQTT 5.0', 'TLS 1.3'],
  },
  {
    name: 'Offline Queue',
    layer: 'EVENT TRANSPORT',
    status: 'future',
    description: 'Local SQLite buffer for events when network unavailable',
    techStack: ['SQLite', 'Python'],
  },
  {
    name: 'REST Fallback',
    layer: 'EVENT TRANSPORT',
    status: 'future',
    description: 'HTTPS REST API fallback when MQTT unavailable',
    techStack: ['HTTPX', 'Python'],
  },
  // Central Platform Layer
  {
    name: 'FastAPI Backend',
    layer: 'CENTRAL PLATFORM',
    status: 'future',
    description: 'API gateway with event ingestion, auth, and routing',
    techStack: ['FastAPI', 'Python', 'Uvicorn'],
  },
  {
    name: 'Authentication Service',
    layer: 'CENTRAL PLATFORM',
    status: 'future',
    description: 'JWT + API key authentication with RBAC',
    techStack: ['python-jose', 'Passlib'],
  },
  {
    name: 'Message Queue',
    layer: 'CENTRAL PLATFORM',
    status: 'future',
    description: 'Redis/RabbitMQ for async event processing',
    techStack: ['Redis', 'Celery'],
  },
  // Geospatial Intelligence Layer
  {
    name: 'PostgreSQL + PostGIS',
    layer: 'GEOSPATIAL INTELLIGENCE',
    status: 'future',
    description: 'Spatial database with geometry columns and spatial indexes',
    techStack: ['PostgreSQL 15', 'PostGIS 3.3', 'Alembic'],
  },
  {
    name: 'Spatial Matching Engine',
    layer: 'GEOSPATIAL INTELLIGENCE',
    status: 'future',
    description: 'Find nearby events within configurable radius using ST_DWithin',
    techStack: ['PostGIS', 'SQLAlchemy'],
  },
  {
    name: 'Multi-Pass Verification',
    layer: 'GEOSPATIAL INTELLIGENCE',
    status: 'future',
    description: 'Aggregate observations, apply temporal + spatial rules',
    techStack: ['Python', 'Celery Workers'],
  },
  {
    name: 'Priority Scorer',
    layer: 'GEOSPATIAL INTELLIGENCE',
    status: 'future',
    description: 'Calculate severity × frequency × recency × confidence',
    techStack: ['Python'],
  },
  // Dashboard Layer
  {
    name: 'React Dashboard',
    layer: 'DASHBOARD',
    status: 'built',
    description: 'Authority-facing web dashboard with GIS map and event management',
    techStack: ['React 18', 'TypeScript', 'Tailwind CSS'],
  },
  {
    name: 'GIS Map Visualization',
    layer: 'DASHBOARD',
    status: 'built',
    description: 'Interactive Leaflet map with event markers and fleet tracking',
    techStack: ['Leaflet', 'react-leaflet', 'CARTO Tiles'],
  },
  {
    name: 'Event Management UI',
    layer: 'DASHBOARD',
    status: 'built',
    description: 'Event list with verification timeline and status management',
    techStack: ['React', 'Framer Motion'],
  },
  {
    name: 'Fleet Monitor',
    layer: 'DASHBOARD',
    status: 'built',
    description: 'Real-time bus status, location, and camera health',
    techStack: ['React', 'WebSocket (planned)'],
  },
  {
    name: 'Analytics Dashboard',
    layer: 'DASHBOARD',
    status: 'built',
    description: 'Charts showing detection trends, verification rates, priority distribution',
    techStack: ['Recharts', 'React'],
  },
  {
    name: 'Pipeline Visualization',
    layer: 'DASHBOARD',
    status: 'built',
    description: 'Real-time processing pipeline with throughput metrics',
    techStack: ['React', 'Framer Motion'],
  },
  {
    name: 'WebSocket Integration',
    layer: 'DASHBOARD',
    status: 'future',
    description: 'Real-time event updates via WebSocket connection',
    techStack: ['WebSocket API', 'React'],
  },
  // Action Layer
  {
    name: 'Work Order Generator',
    layer: 'ACTION',
    status: 'future',
    description: 'Auto-generate maintenance tickets from verified events',
    techStack: ['FastAPI', 'PostgreSQL'],
  },
  {
    name: 'Dispatch System',
    layer: 'ACTION',
    status: 'future',
    description: 'Assign work orders to field teams based on location and priority',
    techStack: ['FastAPI', 'Email/SMS API'],
  },
  {
    name: 'Field Team Mobile App',
    layer: 'ACTION',
    status: 'future',
    description: 'Mobile app for field teams to receive and update work orders',
    techStack: ['React Native', 'Expo'],
  },
];

const layers = [
  { name: 'BUS / SIMULATOR', color: 'border-blue-500', icon: '🚌', description: 'Sensor data capture from public transport fleet' },
  { name: 'EDGE PROCESSING', color: 'border-purple-500', icon: '🧠', description: 'On-device AI inference and event creation' },
  { name: 'EVENT TRANSPORT', color: 'border-cyan-500', icon: '📡', description: 'Secure transmission with offline buffering' },
  { name: 'CENTRAL PLATFORM', color: 'border-green-500', icon: '🖥️', description: 'API gateway, ingestion, and authentication' },
  { name: 'GEOSPATIAL INTELLIGENCE', color: 'border-amber-500', icon: '🗺️', description: 'Spatial matching, verification, and priority scoring' },
  { name: 'DASHBOARD', color: 'border-rose-500', icon: '📊', description: 'Authority-facing visualization and management' },
  { name: 'ACTION', color: 'border-emerald-500', icon: '⚡', description: 'Work orders, dispatch, and resolution tracking' },
];

export default function ArchitectureView() {
  const builtCount = modules.filter(m => m.status === 'built').length;
  const inProgressCount = modules.filter(m => m.status === 'in_progress').length;
  const futureCount = modules.filter(m => m.status === 'future').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          System Architecture — SIH26124
        </h2>
        <p className="text-slate-400 text-sm mb-4">
          AI-Powered Mobile Urban Intelligence Platform Using Public Transport Fleet
        </p>
        <p className="text-slate-500 text-xs">
          Organization: Bharat Electronics Limited (BEL) | Theme: Smart Automation | Category: Software
        </p>
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <div className="text-3xl font-bold text-emerald-400">{builtCount}</div>
          <div className="text-emerald-300 text-sm">Modules Built</div>
          <div className="text-emerald-500/60 text-xs mt-1">Frontend Dashboard + GIS</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="text-3xl font-bold text-amber-400">{inProgressCount}</div>
          <div className="text-amber-300 text-sm">In Progress</div>
          <div className="text-amber-500/60 text-xs mt-1">Video Simulator</div>
        </div>
        <div className="bg-slate-500/10 border border-slate-500/30 rounded-xl p-4">
          <div className="text-3xl font-bold text-slate-400">{futureCount}</div>
          <div className="text-slate-300 text-sm">Planned</div>
          <div className="text-slate-500/60 text-xs mt-1">Backend + Edge AI + Action</div>
        </div>
      </div>

      {/* Architecture Flow Diagram */}
      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Processing Pipeline Flow</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {layers.map((layer, i) => (
            <div key={layer.name} className="flex items-center gap-2">
              <div className={`bg-slate-800 border-l-4 ${layer.color} rounded-lg px-4 py-3 min-w-[140px]`}>
                <div className="text-lg mb-1">{layer.icon}</div>
                <div className="text-xs font-semibold text-white">{layer.name}</div>
                <div className="text-[10px] text-slate-400 mt-1">{layer.description}</div>
              </div>
              {i < layers.length - 1 && (
                <div className="text-slate-600 text-xl">→</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Data Flow Diagram */}
      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Data Flow — Detection to Action</h3>
        <div className="space-y-3">
          {[
            { step: '1', label: 'Camera + GPS + Timestamp', desc: 'Raw sensor data captured from bus', color: 'blue' },
            { step: '2', label: 'Edge AI Inference', desc: 'YOLO detects road events in frame', color: 'purple' },
            { step: '3', label: 'Confidence Filter', desc: 'Discard detections below threshold (≥0.70)', color: 'purple' },
            { step: '4', label: 'Event Creation', desc: 'Package detection with GPS + timestamp', color: 'cyan' },
            { step: '5', label: 'Secure Transmission', desc: 'MQTT/TLS to central platform', color: 'cyan' },
            { step: '6', label: 'Spatial Matching', desc: 'Match to existing events within radius', color: 'amber' },
            { step: '7', label: 'Multi-Pass Verification', desc: 'Require 3+ observations within time window', color: 'amber' },
            { step: '8', label: 'Priority Scoring', desc: 'severity × frequency × recency × confidence', color: 'amber' },
            { step: '9', label: 'Authority Dashboard', desc: 'Verified events displayed on GIS map', color: 'rose' },
            { step: '10', label: 'Maintenance Action', desc: 'Work order generated and dispatched', color: 'emerald' },
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full bg-${item.color}-500/20 border border-${item.color}-500/30 flex items-center justify-center text-${item.color}-400 text-sm font-bold shrink-0`}>
                {item.step}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{item.label}</div>
                <div className="text-xs text-slate-400">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Module Grid by Layer */}
      <div className="space-y-4">
        {layers.map((layer) => {
          const layerModules = modules.filter(m => m.layer === layer.name);
          return (
            <div key={layer.name} className={`bg-slate-900/80 border-l-4 ${layer.color} border border-slate-700 rounded-xl p-5`}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{layer.icon}</span>
                <div>
                  <h3 className="text-base font-bold text-white">{layer.name}</h3>
                  <p className="text-xs text-slate-400">{layer.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {layerModules.map((mod) => (
                  <div
                    key={mod.name}
                    className={`border rounded-lg p-3 ${STATUS_COLORS[mod.status]}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-white">{mod.name}</h4>
                      <span className="text-[10px] font-mono whitespace-nowrap">
                        {STATUS_LABELS[mod.status]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mb-2">{mod.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {mod.techStack.map((tech) => (
                        <span
                          key={tech}
                          className="text-[10px] bg-slate-800/50 text-slate-300 px-1.5 py-0.5 rounded"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Event Schema */}
      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Canonical Event Schema</h3>
        <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
          <pre className="text-xs text-slate-300 font-mono leading-relaxed">
{`{
  "event_id":           "uuid-v4",           // Unique event identifier
  "bus_id":             "BUS-KA01-001",      // Source bus
  "route_id":           "201-C",             // Bus route
  "timestamp":          "2026-01-15T10:30:45Z", // Detection time (UTC)
  "latitude":           12.9355,             // GPS latitude
  "longitude":          77.6240,             // GPS longitude
  "event_type":         "pothole",           // Type enum
  "confidence":         0.87,                // 0.0 - 1.0
  "frame_reference":    "s3://frames/...",   // Source frame URL
  "camera_id":          "CAM-FRONT-01",      // Camera identifier
  "status":             "verified",          // Lifecycle status
  "verification_count": 3,                   // Number of observations
  "priority":           "high",              // Calculated priority
  "severity":           7,                   // 1-10 scale
  "created_at":         "2026-01-15T10:30:45Z",
  "updated_at":         "2026-01-15T11:15:00Z"
}`}
          </pre>
        </div>
      </div>

      {/* Database Schema */}
      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Database Schema (PostgreSQL + PostGIS)</h3>
        <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto">
          <pre className="text-xs text-slate-300 font-mono leading-relaxed">
{`-- Core tables
events          → Geotagged infrastructure issues (aggregated)
observations    → Raw detections from individual bus passes
buses           → Fleet registry with status and location
verification_rules → Per-type verification thresholds

-- Key indexes
GIST index on events.location    → Spatial queries (< 100ms)
B-tree on events.timestamp       → Time-range queries
B-tree on events.status          → Status filtering
B-tree on observations.event_id  → Observation aggregation

-- Spatial operations
ST_DWithin()  → Find events within radius
ST_ClusterDBSCAN() → Cluster nearby events
ST_GeomFromGeoJSON() → Import GeoJSON data`}
          </pre>
        </div>
      </div>

      {/* Communication Methods */}
      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Communication & APIs</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-cyan-400 mb-2">Bus → Central (MQTT)</h4>
            <div className="text-xs text-slate-300 space-y-1">
              <div className="font-mono text-slate-400">urbanpulse/{'{city_id}'}/bus/{'{bus_id}'}/events</div>
              <div className="font-mono text-slate-400">urbanpulse/{'{city_id}'}/bus/{'{bus_id}'}/heartbeat</div>
              <div className="font-mono text-slate-400">urbanpulse/{'{city_id}'}/bus/{'{bus_id}'}/status</div>
              <div className="text-slate-500 mt-2">TLS 1.3 | QoS 1 | Retain: false</div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-400 mb-2">Dashboard → Backend (REST)</h4>
            <div className="text-xs text-slate-300 space-y-1 font-mono text-slate-400">
              <div>POST   /api/v1/events</div>
              <div>GET    /api/v1/events</div>
              <div>PATCH  /api/v1/events/{'{id}'}/status</div>
              <div>GET    /api/v1/fleet/status</div>
              <div>WS     /api/v1/ws/events</div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Handling & Offline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Error Handling</h3>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex gap-2"><span className="text-red-400">●</span> Model crash → auto-restart, log error</div>
            <div className="flex gap-2"><span className="text-amber-400">●</span> Low confidence → discard, don't create event</div>
            <div className="flex gap-2"><span className="text-amber-400">●</span> GPS failure → use last known, mark uncertain</div>
            <div className="flex gap-2"><span className="text-red-400">●</span> Network failure → queue locally, retry with backoff</div>
            <div className="flex gap-2"><span className="text-amber-400">●</span> Auth failure → refresh JWT, retry once</div>
            <div className="flex gap-2"><span className="text-red-400">●</span> DB error → retry 3x, then alert ops team</div>
          </div>
        </div>
        <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Offline Behavior</h3>
          <div className="space-y-2 text-xs text-slate-300">
            <div>• Store up to 10,000 events in local SQLite</div>
            <div>• Buffer 2 hours of compressed video on SD card</div>
            <div>• Sync in priority batches when connectivity restored</div>
            <div>• Verified events synced before unverified</div>
            <div>• Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 5min</div>
            <div>• Deduplication on sync via event_id</div>
          </div>
        </div>
      </div>

      {/* Scaling Strategy */}
      <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Scaling Strategy</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <h4 className="text-cyan-400 font-semibold mb-2">Horizontal</h4>
            <ul className="text-slate-300 space-y-1">
              <li>• Multiple API instances + LB</li>
              <li>• DB read replicas</li>
              <li>• Celery worker pool</li>
              <li>• Stateless design</li>
            </ul>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <h4 className="text-amber-400 font-semibold mb-2">Data Volume</h4>
            <ul className="text-slate-300 space-y-1">
              <li>• 100 buses × 50 events/day</li>
              <li>• 5,000 events/day</li>
              <li>• ~75GB/month storage</li>
              <li>• Partition by month</li>
            </ul>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <h4 className="text-emerald-400 font-semibold mb-2">Performance</h4>
            <ul className="text-slate-300 space-y-1">
              <li>• API: 1000 req/s</li>
              <li>• Spatial query: &lt;100ms</li>
              <li>• End-to-end: &lt;5s</li>
              <li>• Uptime: 99.5%</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
