import { useState, useEffect } from 'react';
import { pipelineStages } from '../data';

export function PipelineView() {
  const [pulseStage, setPulseStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseStage(prev => (prev + 1) % pipelineStages.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-[calc(100vh-180px)] overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Processing Pipeline</h2>
        <p className="text-sm text-gray-400 mt-1">
          Real-time data flow from camera capture to authority action
        </p>
      </div>

      {/* Trust Principle Banner */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-shield-halved text-red-400 text-sm"></i>
          </div>
          <div>
            <div className="text-sm font-medium text-red-300">Critical Trust Principle</div>
            <div className="text-xs text-gray-400 mt-1">
              One AI frame does NOT immediately create a high-priority maintenance action.
              Events must pass through confidence filtering, temporal validation, spatial matching,
              and multi-pass evidence before reaching authority queue.
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div className="space-y-3">
        {pipelineStages.map((stage, index) => {
          const isActive = index === pulseStage;
          const isPast = index < pulseStage;

          return (
            <div
              key={stage.id}
              className={`relative p-5 rounded-xl border transition-all duration-500 ${
                isActive
                  ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/20'
                  : isPast
                  ? 'bg-gray-800/30 border-gray-700/30'
                  : 'bg-gray-800/20 border-gray-700/50'
              }`}
            >
              {/* Stage number */}
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center">
                <span className="text-[10px] font-bold text-gray-300">{index + 1}</span>
              </div>

              <div className="flex items-center justify-between ml-4">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isActive ? 'bg-blue-500/20' : 'bg-gray-700/50'
                  }`}>
                    <i className={`fa-solid ${getStageIcon(stage.id)} ${isActive ? 'text-blue-400' : 'text-gray-400'}`}></i>
                  </div>
                  <div>
                    <h3 className={`text-sm font-semibold ${isActive ? 'text-blue-300' : 'text-gray-300'}`}>
                      {stage.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">{stage.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`text-sm font-mono font-bold ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
                      {stage.throughput}/min
                    </div>
                    <div className="text-[10px] text-gray-500">throughput</div>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${
                    isActive ? 'bg-blue-500 animate-pulse' : 'bg-gray-600'
                  }`}></div>
                </div>
              </div>

              {/* Progress indicator */}
              {isActive && (
                <div className="mt-3 ml-14">
                  <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Verification Logic Detail */}
      <div className="mt-8 p-5 rounded-xl bg-gray-800/20 border border-gray-700/50">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">
          <i className="fa-solid fa-arrows-rotate text-blue-400 mr-2"></i>
          Multi-Pass Verification Logic
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
            <div className="text-xs font-medium text-gray-300 mb-2">1. Spatial Matching</div>
            <div className="text-[11px] text-gray-500">
              New detection within <span className="text-blue-400">50m radius</span> of existing event?
              → Merge as additional observation
            </div>
            <div className="mt-2 text-[10px] text-gray-600 font-mono">
              distance(obs.location, event.location) {'<'} 50m
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
            <div className="text-xs font-medium text-gray-300 mb-2">2. Temporal Validation</div>
            <div className="text-[11px] text-gray-500">
              Observations from <span className="text-blue-400">≥2 different passes</span> within time window?
              → Upgrade to "verified"
            </div>
            <div className="mt-2 text-[10px] text-gray-600 font-mono">
              unique_bus_ids {'>='} 2 AND time_span {'<'} 24h
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
            <div className="text-xs font-medium text-gray-300 mb-2">3. Priority Scoring</div>
            <div className="text-[11px] text-gray-500">
              Score = <span className="text-blue-400">severity × confidence × frequency</span>
              → Determines maintenance urgency
            </div>
            <div className="mt-2 text-[10px] text-gray-600 font-mono">
              score = sev × avg_conf × log(obs_count + 1)
            </div>
          </div>
        </div>
      </div>

      {/* Status Legend */}
      <div className="mt-6 flex items-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
          Currently processing
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-gray-600"></span>
          Waiting / idle
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 font-mono">N/min</span>
          Events per minute throughput
        </div>
      </div>
    </div>
  );
}

function getStageIcon(id: string): string {
  const icons: Record<string, string> = {
    'stage-1': 'fa-video',
    'stage-2': 'fa-brain',
    'stage-3': 'fa-filter',
    'stage-4': 'fa-crosshairs',
    'stage-5': 'fa-clock-rotate-left',
    'stage-6': 'fa-ranking-star',
    'stage-7': 'fa-clipboard-check',
  };
  return icons[id] || 'fa-gear';
}
