export function ArchitectureView() {
  return (
    <div className="h-[calc(100vh-180px)] overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">System Architecture</h2>
        <p className="text-sm text-gray-400 mt-1">
          SIH26124 — AI-Powered Mobile Urban Intelligence Platform (BEL)
        </p>
      </div>

      {/* Problem Statement */}
      <div className="mb-6 p-5 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
        <h3 className="text-sm font-semibold text-indigo-300 mb-2">
          <i className="fa-solid fa-lightbulb mr-2"></i>
          Core Innovation
        </h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          Transform existing public bus fleet into a <strong className="text-white">distributed mobile sensing network</strong>.
          Each bus becomes a sensor node — camera + GPS + edge AI — continuously scanning road conditions.
          Individual observations are aggregated, spatially matched, and temporally validated to produce
          <strong className="text-white"> verified, geospatially accurate urban intelligence</strong> for authorities.
        </p>
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
          <span><strong className="text-blue-400">1 observation</strong> = possible event</span>
          <span>→</span>
          <span><strong className="text-green-400">Multiple consistent observations</strong> = verified evidence</span>
          <span>→</span>
          <span><strong className="text-amber-400">Priority action</strong> for authority</span>
        </div>
      </div>

      {/* Architecture Diagram */}
      <div className="mb-8 p-5 rounded-xl bg-gray-800/20 border border-gray-700/50">
        <h3 className="text-sm font-semibold text-gray-300 mb-5">
          <i className="fa-solid fa-sitemap text-blue-400 mr-2"></i>
          End-to-End System Architecture
        </h3>

        {/* Layer 1: Edge */}
        <div className="mb-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Layer 1 — Edge (On-Bus)</div>
          <div className="flex items-stretch gap-2">
            {[
              { name: 'Camera', desc: 'Dashcam feed\n30 FPS', status: 'built', icon: 'fa-video' },
              { name: 'GPS Module', desc: '1 Hz fix\nLat/Lng/Time', status: 'built', icon: 'fa-satellite' },
              { name: 'Edge Computer', desc: 'Jetson/RPi\nYOLO inference', status: 'progress', icon: 'fa-microchip' },
              { name: 'Event Publisher', desc: 'MQTT/REST\nJSON events', status: 'progress', icon: 'fa-wifi' },
            ].map((item, i) => (
              <div key={i} className="flex items-center">
                <div className={`p-3 rounded-lg border min-w-[110px] ${getStatusStyle(item.status)}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <i className={`fa-solid ${item.icon} text-xs`}></i>
                    <span className="text-xs font-medium">{item.name}</span>
                  </div>
                  <div className="text-[9px] text-gray-400 whitespace-pre-line">{item.desc}</div>
                  <div className={`mt-1.5 text-[9px] font-medium ${getStatusTextColor(item.status)}`}>
                    {getStatusText(item.status)}
                  </div>
                </div>
                {i < 3 && <i className="fa-solid fa-arrow-right text-gray-600 mx-1 text-xs"></i>}
              </div>
            ))}
          </div>
        </div>

        {/* Arrow down */}
        <div className="flex justify-center my-2">
          <i className="fa-solid fa-arrow-down text-gray-600"></i>
        </div>

        {/* Layer 2: Cloud/Backend */}
        <div className="mb-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Layer 2 — Cloud Backend</div>
          <div className="flex items-stretch gap-2 flex-wrap">
            {[
              { name: 'API Gateway', desc: 'FastAPI\nEvent ingestion', status: 'progress', icon: 'fa-server' },
              { name: 'Event Store', desc: 'PostgreSQL\n+ PostGIS', status: 'progress', icon: 'fa-database' },
              { name: 'Verification Engine', desc: 'Spatial + temporal\nmulti-pass logic', status: 'progress', icon: 'fa-arrows-rotate' },
              { name: 'Priority Scorer', desc: 'Severity × confidence\n× frequency', status: 'progress', icon: 'fa-ranking-star' },
              { name: 'Message Queue', desc: 'MQTT / Redis\nEvent streaming', status: 'future', icon: 'fa-layer-group' },
            ].map((item, i) => (
              <div key={i} className="flex items-center">
                <div className={`p-3 rounded-lg border min-w-[110px] ${getStatusStyle(item.status)}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <i className={`fa-solid ${item.icon} text-xs`}></i>
                    <span className="text-xs font-medium">{item.name}</span>
                  </div>
                  <div className="text-[9px] text-gray-400 whitespace-pre-line">{item.desc}</div>
                  <div className={`mt-1.5 text-[9px] font-medium ${getStatusTextColor(item.status)}`}>
                    {getStatusText(item.status)}
                  </div>
                </div>
                {i < 4 && <i className="fa-solid fa-arrow-right text-gray-600 mx-1 text-xs"></i>}
              </div>
            ))}
          </div>
        </div>

        {/* Arrow down */}
        <div className="flex justify-center my-2">
          <i className="fa-solid fa-arrow-down text-gray-600"></i>
        </div>

        {/* Layer 3: Frontend */}
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Layer 3 — Authority Dashboard (Frontend)</div>
          <div className="flex items-stretch gap-2 flex-wrap">
            {[
              { name: 'GIS Map', desc: 'Leaflet/MapLibre\nEvent visualization', status: 'built', icon: 'fa-map' },
              { name: 'Event Manager', desc: 'List, filter, detail\nVerification status', status: 'built', icon: 'fa-list-check' },
              { name: 'Fleet Monitor', desc: 'Bus status, location\nCamera health', status: 'built', icon: 'fa-bus' },
              { name: 'Analytics', desc: 'Charts, trends\nVerification metrics', status: 'built', icon: 'fa-chart-line' },
              { name: 'Alert System', desc: 'Priority notifications\nAuthority dispatch', status: 'future', icon: 'fa-bell' },
            ].map((item, i) => (
              <div key={i} className="flex items-center">
                <div className={`p-3 rounded-lg border min-w-[110px] ${getStatusStyle(item.status)}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <i className={`fa-solid ${item.icon} text-xs`}></i>
                    <span className="text-xs font-medium">{item.name}</span>
                  </div>
                  <div className="text-[9px] text-gray-400 whitespace-pre-line">{item.desc}</div>
                  <div className={`mt-1.5 text-[9px] font-medium ${getStatusTextColor(item.status)}`}>
                    {getStatusText(item.status)}
                  </div>
                </div>
                {i < 4 && <i className="fa-solid fa-arrow-right text-gray-600 mx-1 text-xs"></i>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="p-5 rounded-xl bg-gray-800/20 border border-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">
            <i className="fa-solid fa-code text-green-400 mr-2"></i>
            Technology Stack
          </h3>
          <div className="space-y-2">
            {[
              { layer: 'Frontend', tech: 'React 18 + TypeScript + Tailwind CSS + Vite', status: 'built' },
              { layer: 'Maps', tech: 'Leaflet + react-leaflet (CARTO dark tiles)', status: 'built' },
              { layer: 'Charts', tech: 'Recharts (line, bar, pie)', status: 'built' },
              { layer: 'Backend', tech: 'Python + FastAPI + SQLAlchemy', status: 'progress' },
              { layer: 'Database', tech: 'PostgreSQL 15 + PostGIS extension', status: 'progress' },
              { layer: 'Computer Vision', tech: 'YOLOv8 + OpenCV + ByteTrack', status: 'progress' },
              { layer: 'Edge Hardware', tech: 'NVIDIA Jetson Orin Nano / RPi 5', status: 'progress' },
              { layer: 'Messaging', tech: 'MQTT (Mosquitto) / REST fallback', status: 'future' },
              { layer: 'Containerization', tech: 'Docker + Docker Compose', status: 'future' },
              { layer: 'OCR (future)', tech: 'PaddleOCR for sign/plate reading', status: 'future' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-700/30 last:border-0">
                <div>
                  <span className="text-xs text-gray-300 font-medium">{item.layer}</span>
                  <span className="text-[10px] text-gray-500 ml-2">{item.tech}</span>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${getStatusBadge(item.status)}`}>
                  {getStatusText(item.status)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-gray-800/20 border border-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">
            <i className="fa-solid fa-list-check text-amber-400 mr-2"></i>
            MVP Feature Checklist
          </h3>
          <div className="space-y-2">
            {[
              { feature: 'Road/pothole detection (CV)', status: 'progress' },
              { feature: 'Vehicle detection & counting', status: 'progress' },
              { feature: 'GPS tagging + timestamping', status: 'built' },
              { feature: 'Central event storage', status: 'progress' },
              { feature: 'GIS visualization (map)', status: 'built' },
              { feature: 'Multi-pass verification', status: 'built' },
              { feature: 'Priority scoring system', status: 'built' },
              { feature: 'Authority dashboard', status: 'built' },
              { feature: 'Fleet status monitoring', status: 'built' },
              { feature: 'Real-time event pipeline', status: 'built' },
              { feature: 'Video simulator (dashcam playback)', status: 'future' },
              { feature: 'ANPR / Hit-and-run workflow', status: 'future' },
              { feature: 'Route delay prediction', status: 'future' },
              { feature: 'Origin-destination analytics', status: 'future' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-700/30 last:border-0">
                <span className="text-xs text-gray-300">{item.feature}</span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${getStatusBadge(item.status)}`}>
                  {getStatusText(item.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Engineering Principles */}
      <div className="p-5 rounded-xl bg-gray-800/20 border border-gray-700/50">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">
          <i className="fa-solid fa-shield-halved text-purple-400 mr-2"></i>
          Engineering & Trust Principles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            'No hardcoded fake AI results — simulated data is clearly labeled',
            'One frame ≠ action — multi-pass verification required',
            'Clear BUILT / IN PROGRESS / FUTURE separation',
            'Modular architecture — each layer independently deployable',
            'Recorded video as simulator → live camera when hardware available',
            'Open-source stack — reproducible by any team',
            'Configuration via environment variables — no exposed secrets',
            'Meaningful error logging at every pipeline stage',
          ].map((principle, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
              <i className="fa-solid fa-check text-green-500 mt-0.5 text-[10px]"></i>
              <span>{principle}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getStatusStyle(status: string): string {
  switch (status) {
    case 'built': return 'bg-green-500/5 border-green-500/30';
    case 'progress': return 'bg-blue-500/5 border-blue-500/30';
    case 'future': return 'bg-gray-500/5 border-gray-600/30';
    default: return 'bg-gray-800/30 border-gray-700/50';
  }
}

function getStatusTextColor(status: string): string {
  switch (status) {
    case 'built': return 'text-green-400';
    case 'progress': return 'text-blue-400';
    case 'future': return 'text-gray-500';
    default: return 'text-gray-400';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'built': return '✓ BUILT';
    case 'progress': return '◐ IN PROGRESS';
    case 'future': return '○ FUTURE';
    default: return status;
  }
}

function getStatusBadge(status: string): string {
  switch (status) {
    case 'built': return 'bg-green-500/20 text-green-400 border border-green-500/30';
    case 'progress': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    case 'future': return 'bg-gray-500/20 text-gray-400 border border-gray-600/30';
    default: return 'bg-gray-500/20 text-gray-400';
  }
}
