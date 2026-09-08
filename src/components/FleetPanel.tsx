import { Bus } from '../types';

interface Props {
  buses: Bus[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-500' },
  idle: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  maintenance: { bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-500' },
  offline: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function FleetPanel({ buses }: Props) {
  const activeCount = buses.filter(b => b.status === 'active').length;
  const totalEvents = buses.reduce((sum, b) => sum + b.eventsDetected, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Fleet Status</h2>
          <p className="text-sm text-gray-400 mt-1">
            Public buses as mobile sensing units — {activeCount}/{buses.length} active
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="text-lg font-bold text-cyan-400">{totalEvents}</div>
            <div className="text-[10px] text-gray-400">Total Detections</div>
          </div>
          <div className="text-center px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="text-lg font-bold text-green-400">{activeCount}</div>
            <div className="text-[10px] text-gray-400">Active Units</div>
          </div>
        </div>
      </div>

      {/* Concept Banner */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <i className="fa-solid fa-bus text-blue-400"></i>
          </div>
          <div>
            <div className="text-sm font-medium text-blue-300">Core Concept: Bus = Mobile Sensor</div>
            <div className="text-xs text-gray-400 mt-0.5">
              Each bus carries camera + GPS, continuously scanning road conditions.
              Observations are aggregated across the fleet for multi-pass verification.
            </div>
          </div>
        </div>
      </div>

      {/* Bus Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {buses.map(bus => {
          const style = STATUS_STYLES[bus.status];
          return (
            <div
              key={bus.id}
              className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/50 hover:border-gray-600 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{bus.id}</span>
                    <span className={`w-2 h-2 rounded-full ${style.dot} ${bus.status === 'active' ? 'animate-pulse' : ''}`}></span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{bus.routeName}</div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${style.bg} ${style.text} border border-current/20`}>
                  {bus.status}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Route</span>
                  <span className="text-gray-300 font-mono">{bus.routeNumber}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Speed</span>
                  <span className="text-gray-300">{bus.speed} km/h</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Last Ping</span>
                  <span className="text-gray-300">{timeAgo(bus.lastPing)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Events Detected</span>
                  <span className="text-cyan-400 font-bold">{bus.eventsDetected}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Camera</span>
                  <span className={`flex items-center gap-1 ${bus.cameraStatus === 'online' ? 'text-green-400' : 'text-gray-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${bus.cameraStatus === 'online' ? 'bg-green-500' : 'bg-gray-600'}`}></span>
                    {bus.cameraStatus}
                  </span>
                </div>
              </div>

              {/* GPS Coordinates */}
              <div className="mt-3 pt-2 border-t border-gray-700/50">
                <div className="text-[10px] text-gray-500 font-mono">
                  📍 {bus.currentLocation.lat.toFixed(4)}, {bus.currentLocation.lng.toFixed(4)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Data Flow Diagram */}
      <div className="mt-8 p-5 rounded-xl bg-gray-800/20 border border-gray-700/50">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Fleet Data Flow</h3>
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
          {[
            { icon: 'fa-camera', label: 'Camera', desc: '30 FPS capture' },
            { icon: 'fa-location-dot', label: 'GPS', desc: '1 Hz fix' },
            { icon: 'fa-microchip', label: 'Edge AI', desc: 'YOLO inference' },
            { icon: 'fa-wifi', label: 'Transmit', desc: '4G/MQTT' },
            { icon: 'fa-database', label: 'Central DB', desc: 'PostGIS' },
            { icon: 'fa-map-location-dot', label: 'Dashboard', desc: 'This screen' },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-col items-center text-center min-w-[70px]">
                <div className="w-9 h-9 rounded-lg bg-gray-700/50 flex items-center justify-center mb-1">
                  <i className={`fa-solid ${step.icon} text-xs text-gray-300`}></i>
                </div>
                <span className="text-[10px] text-gray-300 font-medium">{step.label}</span>
                <span className="text-[9px] text-gray-500">{step.desc}</span>
              </div>
              {i < 5 && <i className="fa-solid fa-chevron-right text-[10px] text-gray-600"></i>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
