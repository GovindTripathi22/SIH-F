import { Bus } from '../types';

interface Props {
  buses: Bus[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-emerald-950/80 border-emerald-500/40 glow-emerald', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  idle: { bg: 'bg-amber-950/80 border-amber-500/40 glow-amber', text: 'text-amber-300', dot: 'bg-amber-400' },
  maintenance: { bg: 'bg-indigo-950/80 border-indigo-500/40', text: 'text-indigo-300', dot: 'bg-indigo-400' },
  offline: { bg: 'bg-rose-950/80 border-rose-500/40 glow-rose', text: 'text-rose-300', dot: 'bg-rose-400' },
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
    <div className="bg-[#0e1321]/80 backdrop-blur-md rounded-xl border border-slate-800 p-6 shadow-lg card-top-glow">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <i className="fa-solid fa-satellite-dish text-cyan-400"></i>
            Fleet Telemetry & Mobile Sensors
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time BMTC transit vehicles operating as continuous edge sensing probes
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono">
          <div className="px-3 py-1.5 bg-[#161b2a]/80 rounded-lg border border-slate-800 text-center">
            <div className="text-base font-bold text-cyan-300">{totalEvents}</div>
            <div className="text-[9px] uppercase tracking-wider text-slate-400">Distress Hits</div>
          </div>
          <div className="px-3 py-1.5 bg-[#161b2a]/80 rounded-lg border border-slate-800 text-center">
            <div className="text-base font-bold text-emerald-300">{activeCount} / {buses.length}</div>
            <div className="text-[9px] uppercase tracking-wider text-slate-400">Active Probes</div>
          </div>
        </div>
      </div>

      {/* Concept High-Tech Banner */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-teal-950/20 to-emerald-950/40 border border-cyan-500/20 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <i className="fa-solid fa-bus text-base"></i>
          </div>
          <div className="text-xs">
            <div className="font-bold text-cyan-300 tracking-wide uppercase font-mono text-[11px]">
              Core Differentiator: Transit Fleets as Autonomous Road Scanners
            </div>
            <div className="text-slate-400 mt-0.5 leading-relaxed">
              Every passenger bus runs lightweight YOLOv8 edge inference and transmits only 2.5 KB geotagged metadata, eliminating expensive dedicated road inspection vehicles.
            </div>
          </div>
        </div>
      </div>

      {/* Bus Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {buses.map(bus => {
          const style = STATUS_STYLES[bus.status] || STATUS_STYLES.active;
          return (
            <div
              key={bus.id}
              className="p-4 rounded-xl bg-[#161b2a]/70 border border-slate-800 hover:border-cyan-500/30 transition-all shadow-sm group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white font-mono">{bus.id}</span>
                    <span className={`w-2 h-2 rounded-full ${style.dot} ${bus.status === 'active' ? 'animate-pulse' : ''}`}></span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{bus.routeName}</div>
                </div>
                <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full border ${style.bg} ${style.text}`}>
                  {bus.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs font-mono pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Route Number:</span>
                  <span className="text-slate-200 font-bold">{bus.routeNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Vehicle Speed:</span>
                  <span className="text-cyan-300 font-bold">{bus.speed} km/h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Telemetry:</span>
                  <span className="text-slate-300">{timeAgo(bus.lastPing)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Road Anomaly Hits:</span>
                  <span className="text-emerald-300 font-bold">{bus.eventsDetected} hits</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Edge Camera:</span>
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    ONLINE (30 FPS)
                  </span>
                </div>
              </div>

              {/* GPS Coordinates */}
              <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>GNSS Position:</span>
                <span className="text-slate-300">{bus.currentLocation.lat.toFixed(4)}°N, {bus.currentLocation.lng.toFixed(4)}°E</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modern Data Flow Diagram */}
      <div className="mt-6 p-4 rounded-xl bg-[#161b2a]/50 border border-slate-800">
        <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
          <i className="fa-solid fa-diagram-project text-cyan-400"></i>
          Edge-to-Authority Data Pipeline
        </h3>
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 font-mono text-xs">
          {[
            { icon: 'fa-camera', label: '1. Camera', desc: 'Forward Frame' },
            { icon: 'fa-microchip', label: '2. YOLOv8 Edge', desc: '28.3ms CPU' },
            { icon: 'fa-user-shield', label: '3. Privacy Blur', desc: 'DPDP 2023' },
            { icon: 'fa-hard-drive', label: '4. SQLite Queue', desc: 'FIFO Offline' },
            { icon: 'fa-database', label: '5. PostGIS Core', desc: 'Spatial Match' },
            { icon: 'fa-file-signature', label: '6. Work Order', desc: 'BBMP PDF' },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-col items-center text-center min-w-[85px] p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="w-7 h-7 rounded-md bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-1 text-cyan-400">
                  <i className={`fa-solid ${step.icon} text-xs`}></i>
                </div>
                <span className="text-[11px] text-slate-200 font-bold">{step.label}</span>
                <span className="text-[9px] text-slate-400">{step.desc}</span>
              </div>
              {i < 5 && <i className="fa-solid fa-chevron-right text-[10px] text-slate-600"></i>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
