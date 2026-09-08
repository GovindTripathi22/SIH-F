import { useState } from 'react';
import { RoadEvent, Bus } from '../types';
import { MapView } from './MapView';
import { EvidencePanel } from './EvidencePanel';
import { WorkOrderModal } from './WorkOrderModal';

interface CommandDashboardProps {
  issues: RoadEvent[];
  buses: Bus[];
  isLive?: boolean;
  onRefresh?: () => void;
}

export default function CommandDashboard({
  issues,
  buses,
  isLive = true,
  onRefresh
}: CommandDashboardProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [workOrderIssue, setWorkOrderIssue] = useState<RoadEvent | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'high' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter issues
  const filteredIssues = issues.filter(issue => {
    if (filterSeverity === 'critical' && issue.priority !== 'critical') return false;
    if (filterSeverity === 'high' && issue.priority !== 'high') return false;
    if (filterSeverity === 'resolved' && issue.status !== 'resolved') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchType = issue.type.toLowerCase().includes(q);
      const matchAddress = (issue.address || '').toLowerCase().includes(q);
      return matchType || matchAddress;
    }
    return true;
  });

  const selectedIssue = issues.find(e => e.id === selectedEventId) || null;
  const criticalCount = issues.filter(e => e.priority === 'critical').length;
  const activeBusesCount = buses.filter(b => b.status === 'active').length;

  return (
    <div className="h-full flex flex-col bg-[#0a0f1d] text-[#dee2f6] overflow-hidden">
      {/* Subtle Top Telemetry Ribbon - 3 Clean Metrics + Live Indicator */}
      <div className="bg-[#0e1321]/70 backdrop-blur-md border-b border-slate-800/80 px-6 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">ACTIVE DEFECTS:</span>
            <span className="font-bold text-white text-sm">{issues.length}</span>
            {criticalCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-950/80 text-rose-300 border border-rose-500/40 font-bold">
                {criticalCount} Critical
              </span>
            )}
          </div>
          <div className="h-3.5 w-px bg-slate-800"></div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">SCANNING FLEET:</span>
            <span className="font-bold text-cyan-300 text-sm">{activeBusesCount}</span>
            <span className="text-slate-500 text-[11px]">/ {buses.length} buses</span>
          </div>
          <div className="h-3.5 w-px bg-slate-800"></div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">AVG DISPATCH SLA:</span>
            <span className="font-bold text-emerald-300 text-sm">42 mins</span>
            <span className="text-slate-500 text-[11px]">(99.94% bandwidth savings)</span>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border ${
            isLive
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            <span className="text-[11px] font-bold">{isLive ? 'POSTGIS LIVE' : 'DEMO MODE'}</span>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh database"
              className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 rounded-md border border-slate-800 transition"
            >
              <i className="fa-solid fa-rotate text-xs"></i>
            </button>
          )}
        </div>
      </div>

      {/* Main Command Deck: Map on Left (65%), Incident Triage on Right (35%) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 overflow-hidden">
        {/* Left Column: Clean GIS Map Container */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col bg-[#0e1321]/60 backdrop-blur-md border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-3 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-[#161b2a]/40">
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-map-location-dot text-cyan-400 text-sm"></i>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                Bengaluru Transit GIS Matrix
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                • Route 500-D, 201-C & 335-A
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Critical
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> High
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Medium
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Resolved
              </span>
            </div>
          </div>

          {/* Interactive Leaflet Map */}
          <div className="flex-1 w-full relative">
            <MapView
              events={issues}
              buses={buses}
              selectedEventId={selectedEventId}
              onEventSelect={setSelectedEventId}
            />
          </div>
        </div>

        {/* Right Column: Sleek Incident Triage List */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col bg-[#0e1321]/80 backdrop-blur-md border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          {/* Header & Filter Controls */}
          <div className="p-4 border-b border-slate-800/80 space-y-3 shrink-0 bg-[#161b2a]/30">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation text-amber-400"></i>
                Incident Triage ({filteredIssues.length})
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                Multi-Pass Verified
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-xs text-slate-500"></i>
              <input
                type="text"
                placeholder="Search by defect type or road corridor..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition font-mono"
              />
            </div>

            {/* Severity Filter Pills */}
            <div className="flex gap-1.5 font-mono text-[11px]">
              {(['all', 'critical', 'high', 'resolved'] as const).map(sev => (
                <button
                  key={sev}
                  onClick={() => setFilterSeverity(sev)}
                  className={`px-3 py-1 rounded-md capitalize font-semibold transition ${
                    filterSeverity === sev
                      ? 'bg-cyan-600/90 text-white shadow-sm shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800/80'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Incident Scrollable Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin">
            {filteredIssues.length === 0 ? (
              <div className="text-center py-16 text-slate-500 space-y-2">
                <i className="fa-solid fa-check-circle text-3xl text-emerald-500/50"></i>
                <p className="text-xs font-medium">No road distress matching this filter.</p>
              </div>
            ) : (
              filteredIssues.map(issue => {
                const isSelected = issue.id === selectedEventId;
                const isCritical = issue.priority === 'critical';
                const isHigh = issue.priority === 'high';
                const isResolved = issue.status === 'resolved';

                // Linear-style 2px left border accent
                const borderAccent = isCritical
                  ? 'border-l-rose-500'
                  : isHigh
                  ? 'border-l-amber-500'
                  : isResolved
                  ? 'border-l-emerald-500'
                  : 'border-l-cyan-500';

                const conf = Math.round(
                  (issue.confidence ?? (issue.observations?.length
                    ? issue.observations.reduce((acc, o) => acc + o.confidence, 0) / issue.observations.length
                    : 0.85)) * 100
                );

                return (
                  <div
                    key={issue.id}
                    onClick={() => setSelectedEventId(isSelected ? null : issue.id)}
                    className={`p-3.5 rounded-xl border border-l-4 transition-all cursor-pointer ${borderAccent} ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                        : 'bg-[#161b2a]/50 border-slate-800/80 hover:bg-[#161b2a] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white capitalize font-sans">
                          {issue.type.replace(/_/g, ' ')}
                        </span>
                        <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded ${
                          isCritical ? 'bg-rose-950/80 text-rose-300 border border-rose-500/30' :
                          isHigh ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30' :
                          isResolved ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' :
                          'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30'
                        }`}>
                          {issue.priority}
                        </span>
                      </div>

                      {/* One-Click Dispatch Button */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setWorkOrderIssue(issue);
                        }}
                        className="px-2.5 py-1 rounded-md bg-cyan-600/80 hover:bg-cyan-500 text-white text-[10px] font-bold font-mono transition flex items-center gap-1 shadow-sm"
                        title="Dispatch municipal work order"
                      >
                        <i className="fa-solid fa-file-signature text-[9px]"></i>
                        Dispatch
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-300 font-mono truncate mb-2">
                      <i className="fa-solid fa-location-dot text-[9px] text-cyan-400 mr-1.5"></i>
                      {issue.address || `${issue.location.lat.toFixed(4)}°N, ${issue.location.lng.toFixed(4)}°E`}
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800/60">
                      <div className="flex items-center gap-2">
                        <span>Confidence:</span>
                        <span className="font-bold text-cyan-300">{conf}%</span>
                        <span className="text-slate-600">•</span>
                        <span>{issue.observations?.length || 2} bus passes</span>
                      </div>
                      <span className="text-slate-500">
                        {new Date(issue.lastDetected).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Selected Issue Inspection Modal Drawer */}
      {selectedIssue && (
        <EvidencePanel
          issue={selectedIssue}
          onClose={() => setSelectedEventId(null)}
          onStatusUpdated={() => onRefresh && onRefresh()}
        />
      )}

      {/* Municipal Work Order Generator Modal */}
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
