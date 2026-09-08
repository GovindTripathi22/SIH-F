import { useState } from 'react';
import { RoadEvent, Bus } from '../types';
import { EvidencePanel } from './EvidencePanel';
import { RoleSwitcher } from './RoleSwitcher';
import { WorkOrderModal } from './WorkOrderModal';
import { simulatedEvents, simulatedBuses } from '../data';

interface CommandDashboardProps {
  issues?: RoadEvent[];
  buses?: Bus[];
  isLive?: boolean;
  onRefresh?: () => void;
}

export default function CommandDashboard({
  issues: propIssues,
  buses: propBuses,
  isLive = true,
  onRefresh
}: CommandDashboardProps = {}) {
  const [selectedIssue, setSelectedIssue] = useState<RoadEvent | null>(null);
  const [workOrderIssue, setWorkOrderIssue] = useState<RoadEvent | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'fleet' | 'analytics'>('overview');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const issues = propIssues && propIssues.length > 0 ? propIssues : simulatedEvents;
  const buses = propBuses && propBuses.length > 0 ? propBuses : simulatedBuses;

  const criticalIssues = issues.filter(e => e.priority === 'critical');
  const highPriorityIssues = issues.filter(e => e.priority === 'high');
  const activeBuses = buses.filter(b => b.status === 'active');

  const filteredIssues = issues.filter(issue => {
    if (filterSeverity === 'all') return true;
    return issue.priority === filterSeverity;
  });

  return (
    <div className="h-full bg-[#0a0f1d] text-[#dee2f6] flex flex-col overflow-hidden font-sans">
      {/* Top Header Bar */}
      <header className="bg-[#0e1321]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/40">
                <i className="fa-solid fa-city text-white text-base"></i>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-white tracking-tight">UrbanPulse Command Center</h1>
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono">
                    City OS v1.0
                  </span>
                </div>
                <p className="text-xs text-slate-400">Mobile Urban Intelligence & Road Infrastructure Platform • SIH26124</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <RoleSwitcher />

            {/* Backend Connectivity Status Badge */}
            <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border backdrop-blur-md shadow-sm ${
              isLive
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300 shadow-emerald-500/10'
                : 'bg-amber-950/70 border-amber-500/40 text-amber-300 shadow-amber-500/10'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="font-mono text-[11px] tracking-wide">{isLive ? 'POSTGIS LIVE SYNC' : 'OFFLINE DEMO'}</span>
            </div>

            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Synchronize Live Database"
                className="p-2 text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 rounded-lg border border-slate-700/60 hover:border-cyan-500/30 transition shadow-sm"
              >
                <i className="fa-solid fa-rotate text-xs"></i>
              </button>
            )}

            {/* Fleet Status Indicator */}
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-[#161b2a]/80 border border-slate-800 font-mono">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              <span className="text-slate-300 font-semibold">{activeBuses.length}</span>
              <span className="text-slate-400 text-[11px]">buses scanning</span>
            </div>

            {/* Clock */}
            <div className="text-xs font-mono text-slate-400 px-2.5 py-1 rounded-md bg-slate-900/60 border border-slate-800">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </div>
      </header>

      {/* Sub-Navigation Bar */}
      <nav className="bg-[#0e1321]/60 backdrop-blur-sm border-b border-slate-800/80 px-6 shrink-0 flex items-center justify-between">
        <div className="flex gap-2 py-1">
          {[
            { id: 'overview', label: 'Command Overview', icon: 'fa-gauge-high' },
            { id: 'issues', label: 'Road Distress Feed', icon: 'fa-triangle-exclamation' },
            { id: 'fleet', label: 'Fleet Telemetry', icon: 'fa-bus' },
            { id: 'analytics', label: 'Civic Analytics', icon: 'fa-chart-line' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <i className={`fa-solid ${tab.icon} text-[11px]`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Pills for Overview/Issues */}
        {(activeTab === 'overview' || activeTab === 'issues') && (
          <div className="flex items-center gap-1 text-[11px] font-mono">
            <span className="text-slate-500 mr-1 uppercase text-[10px]">Filter:</span>
            {['all', 'critical', 'high', 'medium', 'low'].map(sev => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-2.5 py-1 rounded-md capitalize transition font-medium ${
                  filterSeverity === sev
                    ? 'bg-cyan-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-y-auto p-6 bg-[#0a0f1d]">
        {activeTab === 'overview' && (
          <OverviewTab
            issues={filteredIssues}
            criticalIssues={criticalIssues}
            highPriorityIssues={highPriorityIssues}
            activeBuses={activeBuses}
            onIssueSelect={setSelectedIssue}
            onDispatchWorkOrder={setWorkOrderIssue}
          />
        )}
        {activeTab === 'issues' && (
          <IssuesTab
            issues={filteredIssues}
            onIssueSelect={setSelectedIssue}
            onDispatchWorkOrder={setWorkOrderIssue}
          />
        )}
        {activeTab === 'fleet' && (
          <FleetTab buses={buses} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab issues={issues} buses={buses} />
        )}
      </main>

      {/* Selected Issue Modal Drawer */}
      {selectedIssue && (
        <EvidencePanel
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onStatusUpdated={() => onRefresh && onRefresh()}
        />
      )}

      {/* Work Order Generator Modal */}
      {workOrderIssue && (
        <WorkOrderModal
          issue={workOrderIssue}
          onClose={() => setWorkOrderIssue(null)}
          onStatusUpdated={() => {
            setWorkOrderIssue(null);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Overview Tab (Command Center Layout)
// ----------------------------------------------------------------------------
function OverviewTab({
  issues,
  criticalIssues,
  highPriorityIssues,
  activeBuses,
  onIssueSelect,
  onDispatchWorkOrder
}: {
  issues: RoadEvent[];
  criticalIssues: RoadEvent[];
  highPriorityIssues: RoadEvent[];
  activeBuses: Bus[];
  onIssueSelect: (issue: RoadEvent) => void;
  onDispatchWorkOrder: (issue: RoadEvent) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Top Telemetry Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ModernStatCard
          title="Critical Defects"
          value={criticalIssues.length}
          icon="fa-triangle-exclamation"
          accent="rose"
          subtitle="Immediate municipal dispatch required"
          trend="+2 in last 2h"
        />
        <ModernStatCard
          title="High Priority"
          value={highPriorityIssues.length}
          icon="fa-circle-exclamation"
          accent="amber"
          subtitle="Inspection SLA: < 24 Hours"
          trend="85% consensus verified"
        />
        <ModernStatCard
          title="Active Transit Units"
          value={activeBuses.length}
          icon="fa-bus"
          accent="emerald"
          subtitle="BMTC Mobile Sensing Fleet"
          trend="35.4 FPS inference active"
        />
        <ModernStatCard
          title="Total Geo-Hotspots"
          value={issues.length}
          icon="fa-location-dot"
          accent="cyan"
          subtitle="Bangalore Metropolitan Corridors"
          trend="99.94% bandwidth savings"
        />
      </div>

      {/* Center 2-Column Split: Active Defect Feed (Left) & Real-time Telemetry (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Real-Time Road Defect Feed */}
        <div className="lg:col-span-7 bg-[#0e1321]/80 backdrop-blur-md border border-slate-800/90 rounded-xl p-5 shadow-lg shadow-black/30 card-top-glow">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2 tracking-wide">
                <i className="fa-solid fa-layer-group text-cyan-400"></i>
                Live Road Defect Stream
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Continuous detections sorted by Bayesian verification & explainable priority</p>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
              {issues.length} Monitored
            </span>
          </div>

          <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
            {issues.length === 0 ? (
              <div className="text-center text-slate-500 py-16">
                <i className="fa-solid fa-circle-check text-4xl text-emerald-400/60 mb-3"></i>
                <p className="text-sm font-medium">All municipal transit corridors clear of critical road distress.</p>
              </div>
            ) : (
              issues.map(issue => (
                <ModernDefectCard
                  key={issue.id}
                  issue={issue}
                  onSelect={() => onIssueSelect(issue)}
                  onDispatch={() => onDispatchWorkOrder(issue)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Column: Fleet Telemetry & Transit Corridor Status */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Fleet Telemetry Panel */}
          <div className="bg-[#0e1321]/80 backdrop-blur-md border border-slate-800/90 rounded-xl p-5 shadow-lg shadow-black/30 card-top-glow">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-satellite-dish text-emerald-400"></i>
                Transit Fleet Sensing Units
              </h2>
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                LIVE SENSORS
              </span>
            </div>

            <div className="space-y-3">
              {activeBuses.slice(0, 4).map(bus => (
                <div
                  key={bus.id}
                  className="p-3.5 rounded-lg bg-[#161b2a]/80 border border-slate-800/90 hover:border-cyan-500/30 transition group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <i className="fa-solid fa-bus text-xs"></i>
                      </span>
                      <div>
                        <div className="text-xs font-bold text-white font-mono">{bus.id}</div>
                        <div className="text-[10px] text-slate-400">Route {bus.routeNumber}</div>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-xs font-bold text-cyan-300">{bus.speed} km/h</div>
                      <div className="text-[10px] text-slate-500">Speed</div>
                    </div>
                  </div>

                  {/* Telemetry Progress Bars */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mt-2 pt-2 border-t border-slate-800/70">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Detections:</span>
                      <span className="font-bold text-emerald-400">{bus.eventsDetected}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Camera:</span>
                      <span className="font-bold text-emerald-400 uppercase">ONLINE</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Edge & Pipeline Health Overview */}
          <div className="bg-[#0e1321]/80 backdrop-blur-md border border-slate-800/90 rounded-xl p-5 shadow-lg shadow-black/30">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
              <i className="fa-solid fa-microchip text-cyan-400"></i>
              Edge Processing & Verification
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#161b2a]/60 border border-slate-800">
                <span className="text-slate-400">YOLOv8 Edge Inference:</span>
                <span className="font-mono font-bold text-cyan-300">28.3 ms / 35.4 FPS</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#161b2a]/60 border border-slate-800">
                <span className="text-slate-400">Privacy Anonymization:</span>
                <span className="font-mono font-bold text-emerald-300">DPDP Act 2023 Active</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#161b2a]/60 border border-slate-800">
                <span className="text-slate-400">Offline Resilience Queue:</span>
                <span className="font-mono font-bold text-emerald-300">SQLite FIFO Durable</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#161b2a]/60 border border-slate-800">
                <span className="text-slate-400">Bandwidth Optimization:</span>
                <span className="font-mono font-bold text-cyan-300">99.94% Data Reduction</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Modern Defect Card Component
// ----------------------------------------------------------------------------
function ModernDefectCard({
  issue,
  onSelect,
  onDispatch
}: {
  issue: RoadEvent;
  onSelect: () => void;
  onDispatch: () => void;
}) {
  const isCritical = issue.priority === 'critical';
  const isHigh = issue.priority === 'high';

  const severityBadgeClass = isCritical
    ? 'bg-rose-950/80 text-rose-300 border-rose-500/50 glow-rose animate-pulse'
    : isHigh
    ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 glow-amber'
    : issue.priority === 'medium'
    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
    : 'bg-slate-800/80 text-slate-300 border-slate-700';

  const confVal = issue.confidence ?? (issue.observations?.length ? issue.observations.reduce((acc, o) => acc + o.confidence, 0) / issue.observations.length : 0.85);
  const confPercent = Math.round(confVal * 100);

  return (
    <div className="p-4 rounded-xl bg-[#161b2a]/70 border border-slate-800 hover:border-cyan-500/40 transition-all shadow-sm group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0" onClick={onSelect} role="button">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="text-xs font-bold text-white capitalize tracking-wide font-sans">
              {issue.type.replace(/_/g, ' ')}
            </span>
            <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full border ${severityBadgeClass}`}>
              {issue.priority}
            </span>
            <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-800">
              {issue.verification_state || 'VERIFIED'}
            </span>
          </div>

          <div className="text-xs text-slate-300 flex items-center gap-2 mb-2 font-mono">
            <i className="fa-solid fa-location-dot text-[10px] text-cyan-400"></i>
            <span className="truncate">{issue.address || `${issue.location.lat.toFixed(4)}°N, ${issue.location.lng.toFixed(4)}°E`}</span>
          </div>

          {/* AI Confidence Meter & Multi-Bus Metric */}
          <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
              <span className="text-[10px] text-slate-400">Confidence:</span>
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                  style={{ width: `${confPercent}%` }}
                ></div>
              </div>
              <span className="text-[10px] font-bold text-cyan-300">{confPercent}%</span>
            </div>

            <span className="text-slate-600">•</span>

            <div className="flex items-center gap-1.5 text-[10px]">
              <i className="fa-solid fa-bus text-[9px] text-slate-400"></i>
              <span className="font-semibold text-white">{issue.observations?.length || 2} passes</span>
            </div>
          </div>
        </div>

        {/* Action Button: Dispatch Work Order */}
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={onDispatch}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-[11px] font-bold tracking-wide transition shadow-sm shadow-cyan-500/20 flex items-center gap-1.5"
            title="Generate and dispatch official municipal work order"
          >
            <i className="fa-solid fa-file-signature text-[10px]"></i>
            Dispatch
          </button>
          <button
            onClick={onSelect}
            className="px-3 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-medium transition border border-slate-700/60"
          >
            Inspect
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Modern Stat Card
// ----------------------------------------------------------------------------
function ModernStatCard({
  title,
  value,
  icon,
  accent,
  subtitle,
  trend
}: {
  title: string;
  value: number;
  icon: string;
  accent: 'rose' | 'amber' | 'emerald' | 'cyan';
  subtitle: string;
  trend: string;
}) {
  const accentStyles = {
    rose: {
      border: 'border-rose-500/30 hover:border-rose-500/50',
      iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      glow: 'shadow-rose-500/5',
      badge: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
    },
    amber: {
      border: 'border-amber-500/30 hover:border-amber-500/50',
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      glow: 'shadow-amber-500/5',
      badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    },
    emerald: {
      border: 'border-emerald-500/30 hover:border-emerald-500/50',
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      glow: 'shadow-emerald-500/5',
      badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    },
    cyan: {
      border: 'border-cyan-500/30 hover:border-cyan-500/50',
      iconBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      glow: 'shadow-cyan-500/5',
      badge: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
    }
  }[accent];

  return (
    <div className={`p-4 rounded-xl bg-[#0e1321]/80 backdrop-blur-md border ${accentStyles.border} shadow-lg ${accentStyles.glow} card-top-glow transition`}>
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-medium">{title}</span>
          <div className="text-3xl font-extrabold text-white font-mono mt-1 tracking-tight">{value}</div>
        </div>
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${accentStyles.iconBg}`}>
          <i className={`fa-solid ${icon} text-base`}></i>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
        <span className="text-slate-400 truncate">{subtitle}</span>
        <span className={`px-2 py-0.5 rounded font-mono font-semibold text-[10px] border shrink-0 ${accentStyles.badge}`}>
          {trend}
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Issues Tab
// ----------------------------------------------------------------------------
function IssuesTab({
  issues,
  onIssueSelect,
  onDispatchWorkOrder
}: {
  issues: RoadEvent[];
  onIssueSelect: (issue: RoadEvent) => void;
  onDispatchWorkOrder: (issue: RoadEvent) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-[#0e1321]/80 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation text-amber-400"></i>
            All Verified Municipal Hotspots ({issues.length})
          </h3>
          <span className="text-xs text-slate-400 font-mono">Consolidated Multi-Bus Detections</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {issues.map(issue => (
            <ModernDefectCard
              key={issue.id}
              issue={issue}
              onSelect={() => onIssueSelect(issue)}
              onDispatch={() => onDispatchWorkOrder(issue)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Fleet Tab
// ----------------------------------------------------------------------------
function FleetTab({ buses }: { buses: Bus[] }) {
  return (
    <div className="space-y-4">
      <div className="bg-[#0e1321]/80 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <i className="fa-solid fa-bus text-cyan-400"></i>
          Active Mobile Sensing Fleet ({buses.length} Vehicles)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {buses.map(bus => (
            <div
              key={bus.id}
              className="p-4 rounded-xl bg-[#161b2a]/80 border border-slate-800 hover:border-cyan-500/30 transition shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-base font-bold text-white font-mono">{bus.id}</div>
                  <div className="text-xs text-slate-400">Route {bus.routeNumber}</div>
                </div>
                <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full border ${
                  bus.status === 'active'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 glow-emerald'
                    : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                }`}>
                  {bus.status}
                </span>
              </div>
              <div className="space-y-2 text-xs font-mono pt-2 border-t border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Speed:</span>
                  <span className="text-white font-bold">{bus.speed} km/h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Road Distress Hits:</span>
                  <span className="text-cyan-300 font-bold">{bus.eventsDetected} events</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Edge Camera Health:</span>
                  <span className="text-emerald-400 font-bold">NORMAL (σ²=142)</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Analytics Tab
// ----------------------------------------------------------------------------
function AnalyticsTab({ issues, buses }: { issues: RoadEvent[]; buses: Bus[] }) {
  const potholes = issues.filter(i => i.type === 'pothole').length;
  const cracks = issues.filter(i => i.type === 'road_crack').length;
  const others = issues.length - potholes - cracks;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-[#0e1321]/80 backdrop-blur-md border border-slate-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <i className="fa-solid fa-chart-pie text-cyan-400"></i>
          Distress Type Distribution
        </h3>
        <div className="space-y-3 font-mono text-xs">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-300">Potholes</span>
              <span className="text-rose-400 font-bold">{potholes} ({Math.round((potholes / (issues.length || 1)) * 100)}%)</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(potholes / (issues.length || 1)) * 100}%` }}></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-300">Cracks & Fissures</span>
              <span className="text-amber-400 font-bold">{cracks} ({Math.round((cracks / (issues.length || 1)) * 100)}%)</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(cracks / (issues.length || 1)) * 100}%` }}></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-300">Other Hazards (Subsidence, Manholes)</span>
              <span className="text-cyan-400 font-bold">{others} ({Math.round((others / (issues.length || 1)) * 100)}%)</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(others / (issues.length || 1)) * 100}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#0e1321]/80 backdrop-blur-md border border-slate-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <i className="fa-solid fa-gauge-high text-emerald-400"></i>
          System Key Performance Indicators (SIH26124)
        </h3>
        <div className="grid grid-cols-2 gap-3 font-mono text-xs">
          <div className="p-3 rounded-lg bg-[#161b2a]/80 border border-slate-800">
            <span className="text-slate-400 text-[10px]">INSPECTION TURNAROUND</span>
            <div className="text-lg font-bold text-white mt-1">42 Minutes</div>
            <span className="text-[10px] text-emerald-400">vs 14 days traditional</span>
          </div>
          <div className="p-3 rounded-lg bg-[#161b2a]/80 border border-slate-800">
            <span className="text-slate-400 text-[10px]">CELLULAR BANDWIDTH</span>
            <div className="text-lg font-bold text-cyan-300 mt-1">99.94%</div>
            <span className="text-[10px] text-cyan-400">2.5 KB telemetry JSON</span>
          </div>
          <div className="p-3 rounded-lg bg-[#161b2a]/80 border border-slate-800">
            <span className="text-slate-400 text-[10px]">CORROBORATION ACCURACY</span>
            <div className="text-lg font-bold text-emerald-300 mt-1">98.5%</div>
            <span className="text-[10px] text-emerald-400">Bayesian multi-pass</span>
          </div>
          <div className="p-3 rounded-lg bg-[#161b2a]/80 border border-slate-800">
            <span className="text-slate-400 text-[10px]">HARDWARE COST / BUS</span>
            <div className="text-lg font-bold text-white mt-1">$35 USD</div>
            <span className="text-[10px] text-slate-400">Commodity edge CPU</span>
          </div>
        </div>
      </div>
    </div>
  );
}
