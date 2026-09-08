import { RoadEvent } from '../types';

interface EvidencePanelProps {
  issue: RoadEvent | null;
  onClose: () => void;
}

export function EvidencePanel({ issue, onClose }: EvidencePanelProps) {
  if (!issue) return null;

  const distinctBuses = new Set(issue.observations.map(o => o.busId));
  const avgConfidence = issue.observations.reduce((sum, o) => sum + o.confidence, 0) / issue.observations.length;
  const firstObs = new Date(issue.firstDetected);
  const lastObs = new Date(issue.lastDetected);
  const ageHours = (lastObs.getTime() - firstObs.getTime()) / (1000 * 60 * 60);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Evidence Chain</h2>
            <p className="text-xs text-gray-400">Issue ID: {issue.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Issue Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-gray-400">Event Type</div>
              <div className="text-sm font-bold text-white capitalize">{issue.type.replace('_', ' ')}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-gray-400">Priority</div>
              <div className={`text-sm font-bold capitalize ${
                issue.priority === 'critical' ? 'text-red-400' :
                issue.priority === 'high' ? 'text-orange-400' :
                issue.priority === 'medium' ? 'text-yellow-400' : 'text-green-400'
              }`}>{issue.priority}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-gray-400">Severity</div>
              <div className="text-sm font-bold text-white">{issue.severity}/10</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-gray-400">Status</div>
              <div className="text-sm font-bold text-blue-400 capitalize">{issue.status.replace('_', ' ')}</div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-bold text-white mb-2">
              <i className="fa-solid fa-location-dot mr-2 text-blue-400"></i>
              Location
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Coordinates:</span>{' '}
                <span className="text-white font-mono">{issue.location.lat.toFixed(6)}, {issue.location.lng.toFixed(6)}</span>
              </div>
              {issue.address && (
                <div>
                  <span className="text-gray-400">Address:</span>{' '}
                  <span className="text-white">{issue.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Evidence Chain Visualization */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-bold text-white mb-4">
              <i className="fa-solid fa-link mr-2 text-purple-400"></i>
              Evidence Chain
            </h3>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <EvidenceStep
                step={1}
                title="Observation"
                subtitle={`${issue.observations.length} raw detections`}
                color="blue"
                active
              />
              <Arrow />
              <EvidenceStep
                step={2}
                title="Validation"
                subtitle={`Avg confidence: ${(avgConfidence * 100).toFixed(0)}%`}
                color="green"
                active={issue.status !== 'unverified'}
              />
              <Arrow />
              <EvidenceStep
                step={3}
                title="Geolocation"
                subtitle={`GPS tagged`}
                color="cyan"
                active
              />
              <Arrow />
              <EvidenceStep
                step={4}
                title="Multi-Pass"
                subtitle={`${distinctBuses.size} buses confirmed`}
                color="purple"
                active={distinctBuses.size > 1}
              />
              <Arrow />
              <EvidenceStep
                step={5}
                title="Priority"
                subtitle={`${issue.priority.toUpperCase()}`}
                color={issue.priority === 'critical' ? 'red' : issue.priority === 'high' ? 'orange' : 'yellow'}
                active
              />
            </div>
          </div>

          {/* Observations Timeline */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-bold text-white mb-3">
              <i className="fa-solid fa-clock-rotate-left mr-2 text-yellow-400"></i>
              Observation Timeline
            </h3>
            <div className="space-y-2">
              {issue.observations.map((obs, idx) => (
                <div key={obs.id} className="flex items-center gap-3 bg-gray-700/50 rounded p-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500 flex items-center justify-center text-xs font-bold text-blue-400">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-white">
                      Bus: <span className="font-mono text-blue-300">{obs.busId}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(obs.timestamp).toLocaleString()} • Confidence: {(obs.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    {obs.location.lat.toFixed(4)}, {obs.location.lng.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{issue.observations.length}</div>
              <div className="text-xs text-gray-400">Total Observations</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">{distinctBuses.size}</div>
              <div className="text-xs text-gray-400">Distinct Buses</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{(avgConfidence * 100).toFixed(0)}%</div>
              <div className="text-xs text-gray-400">Avg Confidence</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-400">{ageHours.toFixed(1)}h</div>
              <div className="text-xs text-gray-400">Age</div>
            </div>
          </div>

          {/* Description */}
          {issue.description && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-bold text-white mb-2">
                <i className="fa-solid fa-circle-info mr-2 text-cyan-400"></i>
                Description
              </h3>
              <p className="text-sm text-gray-300">{issue.description}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium">
              <i className="fa-solid fa-user-check mr-2"></i>
              Assign to Team
            </button>
            <button className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-sm font-medium">
              <i className="fa-solid fa-check mr-2"></i>
              Mark Resolved
            </button>
            <button className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg text-sm font-medium">
              <i className="fa-solid fa-eye mr-2"></i>
              View on Map
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvidenceStep({ step, title, subtitle, color, active }: {
  step: number;
  title: string;
  subtitle: string;
  color: string;
  active: boolean;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'border-blue-500 bg-blue-500/20 text-blue-400',
    green: 'border-green-500 bg-green-500/20 text-green-400',
    cyan: 'border-cyan-500 bg-cyan-500/20 text-cyan-400',
    purple: 'border-purple-500 bg-purple-500/20 text-purple-400',
    red: 'border-red-500 bg-red-500/20 text-red-400',
    orange: 'border-orange-500 bg-orange-500/20 text-orange-400',
    yellow: 'border-yellow-500 bg-yellow-500/20 text-yellow-400',
  };

  return (
    <div className={`flex-shrink-0 border-2 rounded-lg p-3 min-w-[120px] ${
      active ? colorClasses[color] : 'border-gray-600 bg-gray-700/50 text-gray-500'
    }`}>
      <div className="text-xs font-bold">{title}</div>
      <div className="text-[10px] mt-1 opacity-80">{subtitle}</div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex-shrink-0 text-gray-500">
      <i className="fa-solid fa-arrow-right text-xs"></i>
    </div>
  );
}
