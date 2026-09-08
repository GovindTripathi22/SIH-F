import { RoadEvent } from '../types';

interface Props {
  events: RoadEvent[];
  selectedEventId: string | null;
  onEventSelect: (id: string | null) => void;
  compact?: boolean;
}

const STATUS_BADGES: Record<string, string> = {
  unverified: 'bg-slate-800/80 text-slate-400 border-slate-700',
  pending_verify: 'bg-amber-950/80 text-amber-300 border-amber-500/50 glow-amber',
  verified: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50 glow-cyan',
  actioned: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/50',
  repaired: 'bg-teal-950/80 text-teal-300 border-teal-500/50',
  resolution_verified: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 glow-emerald',
  resolved: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 glow-emerald',
};

const PRIORITY_BADGES: Record<string, string> = {
  critical: 'text-rose-400 bg-rose-500/10 border-rose-500/30 glow-rose animate-pulse',
  high: 'text-amber-400 bg-amber-500/10 border-amber-500/30 glow-amber',
  medium: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  low: 'text-slate-400 bg-slate-800/50 border-slate-700',
};

const TYPE_ICONS: Record<string, string> = {
  pothole: 'fa-road-barrier',
  road_crack: 'fa-crack',
  waterlogging: 'fa-water',
  traffic_congestion: 'fa-car-burst',
  vehicle_count: 'fa-car',
  road_sign_damage: 'fa-sign-hanging',
  zebra_crossing_deficiency: 'fa-person-walking',
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function EventList({ events, selectedEventId, onEventSelect, compact }: Props) {
  const sortedEvents = [...events].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  if (compact) {
    return (
      <div className="p-4 bg-[#0e1321]/80 backdrop-blur-md rounded-xl border border-slate-800">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <i className="fa-solid fa-list-check text-cyan-400"></i>
            Active Hotspots
          </h3>
          <span className="text-[10px] font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">
            {events.length} detected
          </span>
        </div>
        <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
          {sortedEvents.map(event => (
            <button
              key={event.id}
              onClick={() => onEventSelect(event.id === selectedEventId ? null : event.id)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                event.id === selectedEventId
                  ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                  : 'bg-[#161b2a]/60 border-slate-800 hover:bg-[#161b2a] hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                  <i className={`fa-solid ${TYPE_ICONS[event.type] || 'fa-triangle-exclamation'} text-xs`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-white capitalize truncate">
                      {event.type.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded border ${STATUS_BADGES[event.status] || 'bg-slate-800 text-slate-300'}`}>
                      {event.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                    <span className={`px-1.5 py-0.2 rounded border font-semibold ${PRIORITY_BADGES[event.priority]}`}>
                      {event.priority}
                    </span>
                    <span>•</span>
                    <span>{event.observations.length} passes</span>
                    <span>•</span>
                    <span className="text-slate-500">{timeAgo(event.lastDetected)}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0e1321]/80 backdrop-blur-md rounded-xl border border-slate-800 p-6 shadow-lg card-top-glow">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2.5">
            <i className="fa-solid fa-triangle-exclamation text-amber-400"></i>
            Geotagged Road Distress Records
          </h2>
          <p className="text-xs text-slate-400 mt-1">Multi-pass validated urban anomalies from public transit fleet cameras</p>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span> Candidate
          </div>
          <div className="flex items-center gap-1.5 text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> Supported
          </div>
          <div className="flex items-center gap-1.5 text-cyan-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Verified
          </div>
          <div className="flex items-center gap-1.5 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Resolved
          </div>
        </div>
      </div>

      <div className="space-y-3.5">
        {sortedEvents.map(event => (
          <div
            key={event.id}
            onClick={() => onEventSelect(event.id === selectedEventId ? null : event.id)}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              event.id === selectedEventId
                ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-400/30 shadow-lg shadow-cyan-500/10'
                : 'bg-[#161b2a]/70 border-slate-800 hover:border-cyan-500/30 hover:bg-[#161b2a]'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 shadow-sm shrink-0">
                  <i className={`fa-solid ${TYPE_ICONS[event.type] || 'fa-triangle-exclamation'} text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <h3 className="text-sm font-bold text-white capitalize">
                      {event.type.replace(/_/g, ' ')}
                    </h3>
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_BADGES[event.status] || 'bg-slate-800 text-slate-300'}`}>
                      {event.status.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border ${PRIORITY_BADGES[event.priority]}`}>
                      {event.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-mono flex items-center gap-1.5 truncate">
                    <i className="fa-solid fa-location-dot text-[10px] text-cyan-400"></i>
                    {event.address}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">{event.description}</p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 font-mono text-xs">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400">Bayesian Confidence:</span>
                  <div className="text-sm font-bold text-cyan-300">
                    {((event.confidence ?? (event.observations?.length ? event.observations.reduce((acc, o) => acc + o.confidence, 0) / event.observations.length : 0.85)) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Observation timeline */}
            <div className="mt-3.5 pt-3 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400 font-mono font-semibold uppercase tracking-wider">
                  Fleet Multi-Pass:
                </span>
                <div className="flex items-center gap-1.5 font-mono">
                  {event.observations.map((obs, i) => (
                    <div key={obs.id} className="flex items-center">
                      <div
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 bg-cyan-950/80 border-cyan-500/40 text-cyan-300"
                        title={`Bus ${obs.busId} detected at ${new Date(obs.timestamp).toLocaleTimeString()}`}
                      >
                        <i className="fa-solid fa-bus text-[8px]"></i>
                        <span>{obs.busId.split('-').pop()}</span>
                        <span className="text-slate-400 text-[9px]">({Math.round(obs.confidence * 100)}%)</span>
                      </div>
                      {i < event.observations.length - 1 && (
                        <div className="w-3 h-px bg-cyan-500/40 mx-1"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-400">
                {timeAgo(event.firstDetected)} → {timeAgo(event.lastDetected)}
              </div>
            </div>

            {/* Expanded details on select */}
            {event.id === selectedEventId && (
              <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">FIRST DETECTED</span>
                  <span className="text-slate-200 font-semibold">{new Date(event.firstDetected).toLocaleTimeString()}</span>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">LATEST DETECTED</span>
                  <span className="text-slate-200 font-semibold">{new Date(event.lastDetected).toLocaleTimeString()}</span>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">SEVERITY INDEX</span>
                  <span className="text-cyan-300 font-semibold">{event.severity}/10</span>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">GPS COORDINATES</span>
                  <span className="text-slate-200 font-semibold">{event.location.lat.toFixed(4)}°, {event.location.lng.toFixed(4)}°</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
