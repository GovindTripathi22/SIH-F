import { useState } from 'react';
import { RoadEvent, Bus } from '../types';
import { EvidencePanel } from './EvidencePanel';
import { RoleSwitcher } from './RoleSwitcher';
import { simulatedEvents, simulatedBuses } from '../data';

interface CommandDashboardProps {
  issues?: RoadEvent[];
  buses?: Bus[];
  isLive?: boolean;
  onRefresh?: () => void;
}

export default function CommandDashboard({ issues: propIssues, buses: propBuses, isLive = true, onRefresh }: CommandDashboardProps = {}) {
  const [selectedIssue, setSelectedIssue] = useState<RoadEvent | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'fleet' | 'analytics'>('overview');

  const issues = propIssues && propIssues.length > 0 ? propIssues : simulatedEvents;
  const buses = propBuses && propBuses.length > 0 ? propBuses : simulatedBuses;

  const criticalIssues = issues.filter(e => e.priority === 'critical');
  const highPriorityIssues = issues.filter(e => e.priority === 'high');
  const activeBuses = buses.filter(b => b.status === 'active');

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-city text-white text-lg"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">UrbanPulse Command Center</h1>
                <p className="text-xs text-gray-400">Real-time Urban Intelligence Platform • SIH26124</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <RoleSwitcher />
            <div className={`flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-md border ${
              isLive
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                : 'bg-amber-950/60 border-amber-500/40 text-amber-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{isLive ? 'POSTGIS LIVE BACKEND' : 'OFFLINE DEMO'}</span>
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Sync with Backend"
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition"
              >
                <i className="fa-solid fa-rotate"></i>
              </button>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-gray-300">{activeBuses.length} buses active</span>
            </div>
            <div className="text-sm text-gray-400">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-gray-900 border-b border-gray-800 px-6">
        <div className="flex gap-1">
          {[
            { id: 'overview', label: 'Overview', icon: 'fa-gauge-high' },
            { id: 'issues', label: 'Issues', icon: 'fa-triangle-exclamation' },
            { id: 'fleet', label: 'Fleet', icon: 'fa-bus' },
            { id: 'analytics', label: 'Analytics', icon: 'fa-chart-line' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <i className={`fa-solid ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'overview' && (
          <OverviewTab
            criticalIssues={criticalIssues}
            highPriorityIssues={highPriorityIssues}
            activeBuses={activeBuses}
            onIssueSelect={setSelectedIssue}
          />
        )}
        {activeTab === 'issues' && (
          <IssuesTab
            issues={issues}
            onIssueSelect={setSelectedIssue}
          />
        )}
        {activeTab === 'fleet' && (
          <FleetTab buses={buses} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab />
        )}
      </main>

      {/* Evidence Panel Modal */}
      {selectedIssue && (
        <EvidencePanel
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
        />
      )}
    </div>
  );
}

// Overview Tab
function OverviewTab({ criticalIssues, highPriorityIssues, activeBuses, onIssueSelect }: {
  criticalIssues: RoadEvent[];
  highPriorityIssues: RoadEvent[];
  activeBuses: Bus[];
  onIssueSelect: (issue: RoadEvent) => void;
}) {
  return (
    <div className="h-full grid grid-cols-12 gap-4 p-4 overflow-y-auto">
      {/* Stats Cards */}
      <div className="col-span-12 grid grid-cols-4 gap-4">
        <StatCard
          title="Critical Issues"
          value={criticalIssues.length}
          icon="fa-triangle-exclamation"
          color="red"
          subtitle="Immediate action required"
        />
        <StatCard
          title="High Priority"
          value={highPriorityIssues.length}
          icon="fa-exclamation-circle"
          color="orange"
          subtitle="Schedule within 24h"
        />
        <StatCard
          title="Active Buses"
          value={activeBuses.length}
          icon="fa-bus"
          color="green"
          subtitle="Currently scanning"
        />
        <StatCard
          title="Events Today"
          value={47}
          icon="fa-calendar-day"
          color="blue"
          subtitle="Last 24 hours"
        />
      </div>

      {/* Critical Issues List */}
      <div className="col-span-4 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-3">
          <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation"></i>
            Critical Issues ({criticalIssues.length})
          </h3>
        </div>
        <div className="p-4 space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
          {criticalIssues.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <i className="fa-solid fa-check-circle text-4xl mb-2"></i>
              <p>No critical issues</p>
            </div>
          ) : (
            criticalIssues.map(issue => (
              <IssueCard key={issue.id} issue={issue} onClick={() => onIssueSelect(issue)} />
            ))
          )}
        </div>
      </div>

      {/* High Priority Issues */}
      <div className="col-span-4 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="bg-orange-500/10 border-b border-orange-500/30 px-4 py-3">
          <h3 className="text-sm font-bold text-orange-400 flex items-center gap-2">
            <i className="fa-solid fa-exclamation-circle"></i>
            High Priority ({highPriorityIssues.length})
          </h3>
        </div>
        <div className="p-4 space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
          {highPriorityIssues.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <i className="fa-solid fa-check-circle text-4xl mb-2"></i>
              <p>No high priority issues</p>
            </div>
          ) : (
            highPriorityIssues.map(issue => (
              <IssueCard key={issue.id} issue={issue} onClick={() => onIssueSelect(issue)} />
            ))
          )}
        </div>
      </div>

      {/* Active Fleet */}
      <div className="col-span-4 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="bg-green-500/10 border-b border-green-500/30 px-4 py-3">
          <h3 className="text-sm font-bold text-green-400 flex items-center gap-2">
            <i className="fa-solid fa-bus"></i>
            Active Fleet ({activeBuses.length})
          </h3>
        </div>
        <div className="p-4 space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
          {activeBuses.map(bus => (
            <div key={bus.id} className="bg-gray-800 rounded-lg p-3 hover:bg-gray-750 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-white">{bus.id}</div>
                <div className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Active
                </div>
              </div>
              <div className="text-xs text-gray-400 space-y-1">
                <div>Route: {bus.routeNumber}</div>
                <div>Speed: {bus.speed} km/h</div>
                <div>Events: {bus.eventsDetected}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Issues Tab
function IssuesTab({ issues, onIssueSelect }: { issues: RoadEvent[]; onIssueSelect: (issue: RoadEvent) => void }) {
  return (
    <div className="h-full p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-bold text-white">All Issues ({issues.length})</h3>
        </div>
        <div className="p-4 space-y-2">
          {issues.map(issue => (
            <IssueCard key={issue.id} issue={issue} onClick={() => onIssueSelect(issue)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Fleet Tab
function FleetTab({ buses }: { buses: Bus[] }) {
  return (
    <div className="h-full p-4 overflow-y-auto">
      <div className="grid grid-cols-3 gap-4">
        {buses.map(bus => (
          <div key={bus.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-bold text-white">{bus.id}</div>
              <div className={`text-xs px-2 py-1 rounded-full ${
                bus.status === 'active' ? 'bg-green-500/20 text-green-400' :
                bus.status === 'idle' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {bus.status}
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Route:</span>
                <span className="text-white font-mono">{bus.routeNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Speed:</span>
                <span className="text-white">{bus.speed} km/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Events:</span>
                <span className="text-blue-400 font-bold">{bus.eventsDetected}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Camera:</span>
                <span className={bus.cameraStatus === 'online' ? 'text-green-400' : 'text-red-400'}>
                  {bus.cameraStatus}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Analytics Tab
function AnalyticsTab() {
  return (
    <div className="h-full p-4 overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-bold text-white mb-4">Detection Trends</h3>
          <div className="text-gray-400 text-sm">
            Chart visualization would go here
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-bold text-white mb-4">Issue Distribution</h3>
          <div className="text-gray-400 text-sm">
            Distribution chart would go here
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function StatCard({ title, value, icon, color, subtitle }: {
  title: string;
  value: number;
  icon: string;
  color: string;
  subtitle: string;
}) {
  const colorClasses: Record<string, string> = {
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  };

  const iconColors: Record<string, string> = {
    red: 'text-red-400',
    orange: 'text-orange-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-lg p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-400 mb-1">{title}</div>
          <div className="text-3xl font-bold text-white">{value}</div>
          <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
        </div>
        <i className={`fa-solid ${icon} text-2xl ${iconColors[color]}`}></i>
      </div>
    </div>
  );
}

function IssueCard({ issue, onClick }: { issue: RoadEvent; onClick: () => void }) {
  const priorityColors: Record<string, string> = {
    critical: 'border-red-500/50 bg-red-500/5',
    high: 'border-orange-500/50 bg-orange-500/5',
    medium: 'border-yellow-500/50 bg-yellow-500/5',
    low: 'border-green-500/50 bg-green-500/5',
  };

  return (
    <div
      onClick={onClick}
      className={`border-l-4 ${priorityColors[issue.priority]} rounded-lg p-3 cursor-pointer hover:bg-gray-800/50 transition-colors`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-sm font-bold text-white capitalize">{issue.type.replace('_', ' ')}</div>
        <div className={`text-xs px-2 py-0.5 rounded-full ${
          issue.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
          issue.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
          issue.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-green-500/20 text-green-400'
        }`}>
          {issue.priority}
        </div>
      </div>
      <div className="text-xs text-gray-400 space-y-1">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-location-dot text-[10px]"></i>
          <span className="truncate">{issue.address || `${issue.location.lat.toFixed(4)}, ${issue.location.lng.toFixed(4)}`}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{issue.observations.length} obs</span>
          <span>•</span>
          <span>Severity: {issue.severity}/10</span>
        </div>
      </div>
    </div>
  );
}
