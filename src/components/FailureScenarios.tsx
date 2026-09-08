import { useState } from 'react';

interface FailureScenario {
  id: string;
  title: string;
  description: string;
  category: 'detection' | 'network' | 'validation' | 'system';
  expectedBehavior: string;
  systemResponse: string;
  status: 'idle' | 'running' | 'completed';
}

const FAILURE_SCENARIOS: FailureScenario[] = [
  {
    id: 'low-confidence',
    title: 'Low Confidence Detection',
    description: 'AI detects object with confidence 0.3 (below 0.5 threshold)',
    category: 'detection',
    expectedBehavior: 'Detection rejected, no event created',
    systemResponse: 'Confidence filter blocks detection at edge',
    status: 'idle'
  },
  {
    id: 'noisy-gps',
    title: 'Noisy GPS Signal',
    description: 'GPS accuracy degrades to 50m (urban canyon)',
    category: 'detection',
    expectedBehavior: 'Event created with low GPS quality flag',
    systemResponse: 'Event stored with gps_accuracy_meters=50, flagged for review',
    status: 'idle'
  },
  {
    id: 'network-loss',
    title: 'Network Connection Lost',
    description: 'Bus enters tunnel, loses connectivity for 30 seconds',
    category: 'network',
    expectedBehavior: 'Events buffered locally, synced when connection returns',
    systemResponse: 'EventBuffer stores 3 events, syncs automatically on reconnection',
    status: 'idle'
  },
  {
    id: 'duplicate-event',
    title: 'Duplicate Event Detection',
    description: 'Same pothole detected twice within 5 seconds',
    category: 'validation',
    expectedBehavior: 'Second detection deduplicated',
    systemResponse: 'Deduplication window rejects duplicate, only one event created',
    status: 'idle'
  },
  {
    id: 'false-positive',
    title: 'False Positive Candidate',
    description: 'Shadow detected as pothole, confidence 0.6',
    category: 'detection',
    expectedBehavior: 'Temporal validation rejects (no persistence)',
    systemResponse: 'Appears in 1 frame only, fails min_persistence_frames=3 check',
    status: 'idle'
  },
  {
    id: 'insufficient-evidence',
    title: 'Insufficient Evidence',
    description: 'Single observation of potential issue',
    category: 'validation',
    expectedBehavior: 'Event marked as unverified, not escalated',
    systemResponse: 'Status remains "unverified", requires multi-pass confirmation',
    status: 'idle'
  },
  {
    id: 'server-unavailable',
    title: 'Server Unavailable',
    description: 'Backend API returns 503 for 10 seconds',
    category: 'system',
    expectedBehavior: 'Retry with exponential backoff',
    systemResponse: '3 retry attempts, events buffered, sync succeeds on recovery',
    status: 'idle'
  }
];

export default function FailureScenarios() {
  const [scenarios, setScenarios] = useState<FailureScenario[]>(FAILURE_SCENARIOS);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const runScenario = (scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;

    // Update scenario status
    setScenarios(prev => prev.map(s => 
      s.id === scenarioId ? { ...s, status: 'running' } : s
    ));

    // Simulate scenario execution with logs
    const scenarioLogs = generateScenarioLogs(scenario);
    setLogs([]);
    
    let logIndex = 0;
    const logInterval = setInterval(() => {
      if (logIndex < scenarioLogs.length) {
        setLogs(prev => [...prev, scenarioLogs[logIndex]]);
        logIndex++;
      } else {
        clearInterval(logInterval);
        // Mark as completed
        setScenarios(prev => prev.map(s => 
          s.id === scenarioId ? { ...s, status: 'completed' } : s
        ));
      }
    }, 500);

    setSelectedScenario(scenarioId);
  };

  const resetAll = () => {
    setScenarios(FAILURE_SCENARIOS);
    setSelectedScenario(null);
    setLogs([]);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'detection': return 'bg-blue-600/20 text-blue-400 border-blue-600/30';
      case 'network': return 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30';
      case 'validation': return 'bg-purple-600/20 text-purple-400 border-purple-600/30';
      case 'system': return 'bg-red-600/20 text-red-400 border-red-600/30';
      default: return 'bg-gray-600/20 text-gray-400 border-gray-600/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'idle': return '○';
      case 'running': return '◉';
      case 'completed': return '✓';
      default: return '○';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Failure Scenario Testing
          </h1>
          <p className="text-gray-400">
            Demonstrates system resilience and intelligent error handling
          </p>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={resetAll}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-semibold transition-all"
          >
            Reset All
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scenarios List */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">
              Test Scenarios ({scenarios.filter(s => s.status === 'completed').length}/{scenarios.length})
            </h2>
            
            <div className="space-y-3">
              {scenarios.map(scenario => (
                <div
                  key={scenario.id}
                  className={`p-4 rounded-lg border transition-all cursor-pointer ${
                    selectedScenario === scenario.id
                      ? 'bg-blue-600/10 border-blue-600/50'
                      : 'bg-gray-700/30 border-gray-700 hover:bg-gray-700/50'
                  }`}
                  onClick={() => runScenario(scenario.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <span className="text-lg">{getStatusIcon(scenario.status)}</span>
                      {scenario.title}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded border ${getCategoryColor(scenario.category)}`}>
                      {scenario.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">
                    {scenario.description}
                  </p>
                  <div className="text-xs text-gray-500">
                    <div><span className="text-gray-400">Expected:</span> {scenario.expectedBehavior}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Logs Panel */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">
              System Logs
            </h2>
            
            <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs h-[600px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500">
                  Click a scenario to see system behavior logs...
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, idx) => (
                    <div key={idx} className="text-gray-300">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Scenario Details */}
            {selectedScenario && (
              <div className="mt-4 p-4 bg-blue-600/10 border border-blue-600/30 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-300 mb-2">
                  System Response
                </h3>
                <p className="text-sm text-gray-300">
                  {scenarios.find(s => s.id === selectedScenario)?.systemResponse}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="mt-8 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">
            Resilience Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Detection Failures</div>
              <div className="text-2xl font-bold text-blue-400">
                {scenarios.filter(s => s.category === 'detection' && s.status === 'completed').length}
              </div>
              <div className="text-xs text-gray-500">Handled gracefully</div>
            </div>
            <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Network Issues</div>
              <div className="text-2xl font-bold text-yellow-400">
                {scenarios.filter(s => s.category === 'network' && s.status === 'completed').length}
              </div>
              <div className="text-xs text-gray-500">Buffered & synced</div>
            </div>
            <div className="bg-purple-600/10 border border-purple-600/30 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Validation Checks</div>
              <div className="text-2xl font-bold text-purple-400">
                {scenarios.filter(s => s.category === 'validation' && s.status === 'completed').length}
              </div>
              <div className="text-xs text-gray-500">Filtered correctly</div>
            </div>
            <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">System Failures</div>
              <div className="text-2xl font-bold text-red-400">
                {scenarios.filter(s => s.category === 'system' && s.status === 'completed').length}
              </div>
              <div className="text-xs text-gray-500">Retried & recovered</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function generateScenarioLogs(scenario: FailureScenario): string[] {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  
  switch (scenario.id) {
    case 'low-confidence':
      return [
        `[${timestamp}] INFO: Frame received from BUS-KA01-001`,
        `[${timestamp}] DEBUG: Running inference on frame #1234`,
        `[${timestamp}] INFO: Detection found: pothole, confidence=0.3`,
        `[${timestamp}] WARN: Confidence 0.3 below threshold 0.5`,
        `[${timestamp}] INFO: Detection rejected by confidence filter`,
        `[${timestamp}] INFO: No event created, frame discarded`
      ];
    
    case 'noisy-gps':
      return [
        `[${timestamp}] INFO: Frame received from BUS-KA01-001`,
        `[${timestamp}] INFO: Detection found: pothole, confidence=0.85`,
        `[${timestamp}] WARN: GPS accuracy degraded: 50m (threshold: 10m)`,
        `[${timestamp}] INFO: Event created with low GPS quality flag`,
        `[${timestamp}] INFO: Event ID: EVT-2026-0908-001`,
        `[${timestamp}] INFO: GPS accuracy stored: 50m`,
        `[${timestamp}] INFO: Event flagged for manual review`
      ];
    
    case 'network-loss':
      return [
        `[${timestamp}] INFO: Connection status: LIVE`,
        `[${timestamp}] INFO: Event EVT-001 created`,
        `[${timestamp}] ERROR: Network connection lost`,
        `[${timestamp}] INFO: Connection status: OFFLINE`,
        `[${timestamp}] INFO: Event EVT-002 buffered locally`,
        `[${timestamp}] INFO: Event EVT-003 buffered locally`,
        `[${timestamp}] INFO: Event EVT-004 buffered locally`,
        `[${timestamp}] INFO: Buffer size: 3/1000 events`,
        `[${timestamp}] INFO: Connection restored`,
        `[${timestamp}] INFO: Connection status: SYNCING`,
        `[${timestamp}] INFO: Syncing 3 buffered events`,
        `[${timestamp}] INFO: Event EVT-002 synced successfully`,
        `[${timestamp}] INFO: Event EVT-003 synced successfully`,
        `[${timestamp}] INFO: Event EVT-004 synced successfully`,
        `[${timestamp}] INFO: Connection status: LIVE`,
        `[${timestamp}] INFO: Buffer cleared`
      ];
    
    case 'duplicate-event':
      return [
        `[${timestamp}] INFO: Detection found: pothole at 12.9716,77.5946`,
        `[${timestamp}] INFO: Event EVT-001 created`,
        `[${timestamp}] INFO: Detection found: pothole at 12.9716,77.5946`,
        `[${timestamp}] WARN: Duplicate detected within 5s window`,
        `[${timestamp}] INFO: Deduplication filter activated`,
        `[${timestamp}] INFO: Second detection rejected`,
        `[${timestamp}] INFO: Only 1 event in system (correct)`
      ];
    
    case 'false-positive':
      return [
        `[${timestamp}] INFO: Frame #100: Detection found, confidence=0.6`,
        `[${timestamp}] INFO: Track created: track_001`,
        `[${timestamp}] INFO: Frame #101: No detection`,
        `[${timestamp}] WARN: Track track_001 disappeared`,
        `[${timestamp}] INFO: Frame #102: No detection`,
        `[${timestamp}] ERROR: Track track_001 failed persistence check`,
        `[${timestamp}] INFO: Required: 3 frames, Got: 1 frame`,
        `[${timestamp}] INFO: Track rejected, no event created`,
        `[${timestamp}] INFO: False positive prevented`
      ];
    
    case 'insufficient-evidence':
      return [
        `[${timestamp}] INFO: Detection validated: pothole`,
        `[${timestamp}] INFO: Event EVT-001 created`,
        `[${timestamp}] INFO: Observation count: 1`,
        `[${timestamp}] WARN: Below minimum observations (2)`,
        `[${timestamp}] INFO: Event status: unverified`,
        `[${timestamp}] INFO: Not escalated to priority queue`,
        `[${timestamp}] INFO: Awaiting multi-pass confirmation`
      ];
    
    case 'server-unavailable':
      return [
        `[${timestamp}] INFO: Attempting to send event EVT-001`,
        `[${timestamp}] ERROR: API request failed: 503 Service Unavailable`,
        `[${timestamp}] INFO: Retry attempt 1/3 in 2s`,
        `[${timestamp}] ERROR: API request failed: 503 Service Unavailable`,
        `[${timestamp}] INFO: Retry attempt 2/3 in 4s`,
        `[${timestamp}] ERROR: API request failed: 503 Service Unavailable`,
        `[${timestamp}] INFO: Retry attempt 3/3 in 8s`,
        `[${timestamp}] INFO: API request successful`,
        `[${timestamp}] INFO: Event EVT-001 delivered`,
        `[${timestamp}] INFO: Total retries: 3, Success: true`
      ];
    
    default:
      return [`[${timestamp}] INFO: Scenario executed`];
  }
}
