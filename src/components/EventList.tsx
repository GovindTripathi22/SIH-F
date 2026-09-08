import { RoadEvent } from '../types';

interface Props {
  events: RoadEvent[];
  selectedEventId: string | null;
  onEventSelect: (id: string | null) => void;
  compact?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  unverified: 'bg-gray-500/20 text-gray-300 border-gray-600',
  pending_verify: 'bg-amber-500/20 text-amber-300 border-amber-600',
  verified: 'bg-blue-500/20 text-blue-300 border-blue-600',
  actioned: 'bg-green-500/20 text-green-300 border-green-600',
  resolved: 'bg-emerald-500/20 text-emerald-300 border-emerald-600',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10',
  high: 'text-orange-400 bg-orange-500/10',
  medium: 'text-yellow-400 bg-yellow-500/10',
  low: 'text-gray-400 bg-gray-500/10',
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
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Recent Events</h3>
          <span className="text-[10px] text-gray-500">{events.length} total</span>
        </div>
        <div className="space-y-2">
          {sortedEvents.map(event => (
            <button
              key={event.id}
              onClick={() => onEventSelect(event.id === selectedEventId ? null : event.id)}
              className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                event.id === selectedEventId
                  ? 'bg-blue-500/10 border-blue-500/50'
                  : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800'
              }`}
            >
              <div className="flex items-start gap-2">
                <i className={`fa-solid ${TYPE_ICONS[event.type]} text-[10px] mt-0.5 text-gray-400`}></i>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-gray-200 truncate">
                      {event.type.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[event.status]}`}>
                      {event.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${PRIORITY_COLORS[event.priority]}`}>
                      {event.priority}
                    </span>
                    <span className="text-[9px] text-gray-500">
                      {event.observations.length} obs
                    </span>
                    <span className="text-[9px] text-gray-500">
                      {timeAgo(event.lastDetected)}
                    </span>
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Road Events</h2>
          <p className="text-sm text-gray-400 mt-1">Geotagged events from fleet observation network</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-gray-500"></span> Unverified
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Verified
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Actioned
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {sortedEvents.map(event => (
          <div
            key={event.id}
            onClick={() => onEventSelect(event.id === selectedEventId ? null : event.id)}
            className={`p-5 rounded-xl border cursor-pointer transition-all ${
              event.id === selectedEventId
                ? 'bg-blue-500/5 border-blue-500/30 ring-1 ring-blue-500/20'
                : 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-800/50 hover:border-gray-600'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                  <i className={`fa-solid ${TYPE_ICONS[event.type]} text-gray-300`}></i>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white capitalize">
                    {event.type.replace(/_/g, ' ')}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">{event.address}</p>
                  <p className="text-xs text-gray-500 mt-1">{event.description}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[event.status]}`}>
                  {event.status.replace(/_/g, ' ')}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${PRIORITY_COLORS[event.priority]}`}>
                  {event.priority} priority
                </span>
              </div>
            </div>

            {/* Observation timeline */}
            <div className="mt-4 pt-3 border-t border-gray-700/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                  Multi-Pass Verification ({event.observations.length} observations)
                </span>
              </div>
              <div className="flex items-center gap-1">
                {event.observations.map((obs, i) => (
                  <div key={obs.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{
                          background: `rgba(59, 130, 246, ${0.2 + obs.confidence * 0.5})`,
                          border: `1px solid rgba(59, 130, 246, ${0.3 + obs.confidence * 0.5})`,
                          color: '#93c5fd',
                        }}
                      >
                        {Math.round(obs.confidence * 100)}
                      </div>
                      <span className="text-[8px] text-gray-500 mt-0.5">{obs.busId.split('-').pop()}</span>
                    </div>
                    {i < event.observations.length - 1 && (
                      <div className="w-6 h-px bg-gray-600 mx-1"></div>
                    )}
                  </div>
                ))}
                <div className="ml-2 text-[10px] text-gray-500">
                  {timeAgo(event.firstDetected)} → {timeAgo(event.lastDetected)}
                </div>
              </div>
            </div>

            {/* Expanded details */}
            {event.id === selectedEventId && (
              <div className="mt-4 pt-3 border-t border-gray-700/50 grid grid-cols-2 gap-3">
                <div className="text-xs">
                  <span className="text-gray-500">First detected:</span>
                  <span className="text-gray-300 ml-2">{new Date(event.firstDetected).toLocaleString()}</span>
                </div>
                <div className="text-xs">
                  <span className="text-gray-500">Last detected:</span>
                  <span className="text-gray-300 ml-2">{new Date(event.lastDetected).toLocaleString()}</span>
                </div>
                <div className="text-xs">
                  <span className="text-gray-500">Severity:</span>
                  <span className="text-gray-300 ml-2">{event.severity}/10</span>
                </div>
                <div className="text-xs">
                  <span className="text-gray-500">Location:</span>
                  <span className="text-gray-300 ml-2">{event.location.lat.toFixed(4)}, {event.location.lng.toFixed(4)}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
