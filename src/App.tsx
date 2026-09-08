import { useState, useEffect, useCallback } from 'react';
import { MapView } from './components/MapView';
import { EventList } from './components/EventList';
import { FleetPanel } from './components/FleetPanel';
import { PipelineView } from './components/PipelineView';
import { StatsBar } from './components/StatsBar';
import ArchitectureView from './components/ArchitectureView';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { CVDemo } from './components/CVDemo';
import TemporalValidationDemo from './components/TemporalValidationDemo';
import CommandDashboard from './components/CommandDashboard';
import GISIntelligenceLayer from './components/GISIntelligenceLayer';
import { EvidencePanel } from './components/EvidencePanel';
import DemoMode from './components/DemoMode';
import FailureScenarios from './components/FailureScenarios';
import { RoleSwitcher } from './components/RoleSwitcher';
import { simulatedEvents, simulatedBuses, dashboardStats } from './data';
import { RoadEvent, Route, Bus } from './types';
import { apiClient, BackendHealth } from './api/client';

type Tab = 'command' | 'gis' | 'dashboard' | 'events' | 'fleet' | 'pipeline' | 'cv-demo' | 'temporal' | 'demo' | 'failures' | 'analytics' | 'architecture';

// Sample routes for demonstration
const sampleRoutes: Route[] = [
  {
    id: 'route-1',
    number: '201-C',
    name: 'Koramangala → Indiranagar',
    startLocation: { lat: 12.9352, lng: 77.6245 },
    endLocation: { lat: 12.9719, lng: 77.6412 },
    distanceKm: 8.5,
    estimatedDurationMinutes: 25,
    isActive: true,
  },
  {
    id: 'route-2',
    number: '500-D',
    name: 'Majestic → Whitefield',
    startLocation: { lat: 12.9716, lng: 77.5946 },
    endLocation: { lat: 12.9698, lng: 77.7499 },
    distanceKm: 22.0,
    estimatedDurationMinutes: 55,
    isActive: true,
  },
  {
    id: 'route-3',
    number: '335-A',
    name: 'Yelahanka → Electronic City',
    startLocation: { lat: 13.1007, lng: 77.5963 },
    endLocation: { lat: 12.8456, lng: 77.6603 },
    distanceKm: 45.0,
    estimatedDurationMinutes: 90,
    isActive: true,
  },
];

export type OperationalMode = 'LIVE' | 'DEMO' | 'OFFLINE';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('command');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<RoadEvent | null>(null);

  // 3-Mode Operational Architecture (LIVE / DEMO / OFFLINE)
  const [mode, setMode] = useState<OperationalMode>('LIVE');
  const [liveIssues, setLiveIssues] = useState<RoadEvent[]>([]);
  const [liveBuses, setLiveBuses] = useState<Bus[]>([]);
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(false);
  const [, setHealthData] = useState<BackendHealth | null>(null);

  const fetchLiveBackendData = useCallback(async () => {
    try {
      const health = await apiClient.checkHealth();
      if (health.online && health.data) {
        setIsLiveBackend(true);
        setHealthData(health.data);
        const issuesRes = await apiClient.getIssues();
        setLiveIssues(issuesRes.issues);
        const busesRes = await apiClient.getBuses();
        setLiveBuses(busesRes.buses);
      } else {
        setIsLiveBackend(false);
      }
    } catch {
      setIsLiveBackend(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'LIVE') {
      fetchLiveBackendData();
      const interval = setInterval(fetchLiveBackendData, 6000);
      return () => clearInterval(interval);
    }
  }, [mode, fetchLiveBackendData]);

  // Determine active issues and buses based on operational mode
  const activeIssues: RoadEvent[] = mode === 'LIVE'
    ? (isLiveBackend ? liveIssues : [])
    : (mode === 'DEMO' ? simulatedEvents : simulatedEvents.slice(0, 6));

  const activeBuses: Bus[] = mode === 'LIVE'
    ? (isLiveBackend ? liveBuses : [])
    : (mode === 'DEMO' ? simulatedBuses : simulatedBuses.map(b => ({ ...b, status: 'idle' })));

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'command', label: 'Command Deck', icon: 'fa-tower-broadcast' },
    { id: 'gis', label: 'GIS Matrix', icon: 'fa-map-location-dot' },
    { id: 'demo', label: '16-Step SIH Demo', icon: 'fa-play-circle' },
    { id: 'failures', label: 'Failure Controls', icon: 'fa-shield-halved' },
    { id: 'dashboard', label: 'Overview', icon: 'fa-gauge-high' },
    { id: 'events', label: 'Distress Feed', icon: 'fa-triangle-exclamation' },
    { id: 'fleet', label: 'Fleet Telemetry', icon: 'fa-bus' },
    { id: 'pipeline', label: 'Pipeline Architecture', icon: 'fa-diagram-project' },
    { id: 'cv-demo', label: 'Edge YOLOv8', icon: 'fa-video' },
    { id: 'temporal', label: 'Temporal Tracker', icon: 'fa-clock-rotate-left' },
    { id: 'analytics', label: 'Civic Analytics', icon: 'fa-chart-line' },
    { id: 'architecture', label: 'Specs & Evidence', icon: 'fa-sitemap' },
  ];

  // Mode banner rendering
  const renderModeBanner = () => {
    if (mode === 'LIVE' && !isLiveBackend) {
      return (
        <div className="bg-rose-950/90 border-b border-rose-800/90 px-6 py-2 text-xs text-rose-200 flex items-center justify-between shrink-0 shadow-inner">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-triangle-exclamation text-rose-400 animate-pulse"></i>
            <span>
              <strong>LIVE BACKEND OFFLINE:</strong> FastAPI server at <code>http://127.0.0.1:8001</code> is unreachable. Live database polling paused. Switch to <strong>DEMO MODE</strong> to inspect the deterministic seeded Bangalore fleet scenario.
            </span>
          </div>
          <button
            onClick={() => setMode('DEMO')}
            className="px-3 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded-md text-[11px] font-bold transition shadow-sm font-mono"
          >
            Switch to Demo Mode
          </button>
        </div>
      );
    }
    if (mode === 'DEMO') {
      return (
        <div className="bg-purple-950/80 border-b border-purple-800/80 px-6 py-1.5 text-xs text-purple-200 flex items-center justify-between shrink-0 font-mono">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-play-circle text-purple-400"></i>
            <span><strong>DEMO MODE ACTIVE:</strong> Viewing deterministic seeded Bangalore fleet scenario (5 buses, 3 transit corridors).</span>
          </div>
          <button
            onClick={() => { setMode('LIVE'); fetchLiveBackendData(); }}
            className="px-2.5 py-0.5 bg-purple-800 hover:bg-purple-700 text-white rounded text-[11px] font-semibold transition"
          >
            Connect Live Database
          </button>
        </div>
      );
    }
    if (mode === 'OFFLINE') {
      return (
        <div className="bg-amber-950/80 border-b border-amber-800/80 px-6 py-1.5 text-xs text-amber-200 flex items-center justify-between shrink-0 font-mono">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-hard-drive text-amber-400"></i>
            <span><strong>OFFLINE BUFFER ACTIVE:</strong> Simulating edge cellular network severance. Detections queued in local SQLite FIFO storage (<code>edge_queue.db</code>).</span>
          </div>
          <button
            onClick={() => { setMode('LIVE'); fetchLiveBackendData(); }}
            className="px-2.5 py-0.5 bg-amber-800 hover:bg-amber-700 text-white rounded text-[11px] font-semibold transition"
          >
            Restore Sync
          </button>
        </div>
      );
    }
    return null;
  };

  // Mode Switcher Buttons
  const renderModeToggle = () => (
    <div className="flex items-center gap-1 bg-[#090e1c] p-1 rounded-xl border border-slate-800/90 text-[11px] font-mono shadow-inner">
      <button
        onClick={() => { setMode('LIVE'); fetchLiveBackendData(); }}
        className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
          mode === 'LIVE'
            ? (isLiveBackend ? 'bg-emerald-600/90 text-white shadow-sm shadow-emerald-500/30 border border-emerald-400/40 glow-emerald' : 'bg-rose-600/90 text-white animate-pulse border border-rose-400/40')
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
        }`}
        title="Connect to live FastAPI & PostGIS/SQLite backend"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isLiveBackend ? 'bg-white' : 'bg-rose-200'}`}></span>
        LIVE
      </button>
      <button
        onClick={() => setMode('DEMO')}
        className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
          mode === 'DEMO' ? 'bg-purple-600/90 text-white shadow-sm shadow-purple-500/30 border border-purple-400/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
        }`}
        title="Inspect deterministic seeded Bangalore corridor dataset"
      >
        <i className="fa-solid fa-film text-[10px]"></i>
        DEMO
      </button>
      <button
        onClick={() => setMode('OFFLINE')}
        className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
          mode === 'OFFLINE' ? 'bg-amber-600/90 text-white shadow-sm shadow-amber-500/30 border border-amber-400/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
        }`}
        title="Simulate cellular loss and SQLite queue buffering"
      >
        <i className="fa-solid fa-hard-drive text-[10px]"></i>
        OFFLINE
      </button>
    </div>
  );

  // Tab Header Bar shared across views
  const renderTabBar = () => (
    <div className="bg-[#0e1321]/90 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between shrink-0">
      <div className="flex gap-1 overflow-x-auto py-1.5 scrollbar-none">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 text-xs font-semibold flex items-center gap-2 rounded-lg transition-all whitespace-nowrap ${
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
      <div className="flex items-center gap-3">
        {renderModeToggle()}
        <RoleSwitcher />
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-3 py-1 rounded-lg border ${
          mode === 'LIVE'
            ? (isLiveBackend ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/80 border-rose-500/40 text-rose-300')
            : (mode === 'DEMO' ? 'bg-purple-950/80 border-purple-500/40 text-purple-300' : 'bg-amber-950/80 border-amber-500/40 text-amber-300')
        }`}>
          <span className={`w-2 h-2 rounded-full ${mode === 'LIVE' && isLiveBackend ? 'bg-emerald-400 animate-pulse' : (mode === 'LIVE' ? 'bg-rose-400' : 'bg-purple-400')}`}></span>
          {mode === 'LIVE'
            ? (isLiveBackend ? `LIVE DATABASE (${activeIssues.length} HOTSPOTS)` : 'BACKEND OFFLINE')
            : (mode === 'DEMO' ? `DEMO DATASET (${activeIssues.length} HOTSPOTS)` : 'OFFLINE BUFFER')}
        </span>
      </div>
    </div>
  );

  // Command Dashboard is a full-page view
  if (activeTab === 'command') {
    return (
      <div className="h-screen bg-[#0a0f1d] flex flex-col overflow-hidden">
        {renderTabBar()}
        {renderModeBanner()}
        <div className="flex-1 overflow-hidden">
          <CommandDashboard
            issues={activeIssues}
            buses={activeBuses}
            isLive={mode === 'LIVE' && isLiveBackend}
            onRefresh={fetchLiveBackendData}
          />
        </div>
      </div>
    );
  }

  // GIS Intelligence Layer is a full-page view
  if (activeTab === 'gis') {
    return (
      <div className="h-screen flex flex-col bg-[#0a0f1d] overflow-hidden">
        {renderTabBar()}
        {renderModeBanner()}
        <div className="flex-1 overflow-hidden">
          <GISIntelligenceLayer
            issues={activeIssues}
            buses={activeBuses}
            routes={sampleRoutes}
            onIssueSelect={setSelectedIssue}
          />
        </div>
        {selectedIssue && (
          <EvidencePanel
            issue={selectedIssue}
            onClose={() => setSelectedIssue(null)}
            onStatusUpdated={() => fetchLiveBackendData()}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-[#dee2f6] flex flex-col font-sans">
      {/* Top Main Header */}
      <header className="bg-[#0e1321]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/40">
            <i className="fa-solid fa-city text-white text-base"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">UrbanPulse</h1>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono">
                SIH26124
              </span>
            </div>
            <p className="text-xs text-slate-400">Mobile Public Fleet Urban Intelligence Platform • Bharat Electronics Limited</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {renderModeToggle()}
          <RoleSwitcher />
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-200 font-bold">{activeBuses.filter(b => b.status === 'active').length}</span>
            <span>buses online</span>
          </div>
          <div className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border ${
            mode === 'LIVE'
              ? (isLiveBackend ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 glow-emerald' : 'bg-rose-950/80 text-rose-300 border-rose-500/40')
              : (mode === 'DEMO' ? 'bg-purple-950/80 text-purple-300 border-purple-500/40' : 'bg-amber-950/80 text-amber-300 border-amber-500/40')
          }`}>
            <i className={`fa-solid ${mode === 'LIVE' && isLiveBackend ? 'fa-circle-check' : (mode === 'LIVE' ? 'fa-triangle-exclamation' : 'fa-film')}`}></i>
            <span>{mode === 'LIVE' ? (isLiveBackend ? 'PostGIS Active' : 'Backend Offline') : (mode === 'DEMO' ? 'Demo Dataset' : 'Offline Buffer')}</span>
          </div>
          <div className="text-xs font-mono text-slate-500">
            BEL × SIH 2026
          </div>
        </div>
      </header>

      {/* Mode Alert Banner */}
      {renderModeBanner()}

      {/* Tabs Navigation */}
      <nav className="bg-[#0e1321]/80 backdrop-blur-md border-b border-slate-800/80 px-6 flex gap-1 shrink-0 overflow-x-auto py-1.5 scrollbar-none">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 text-xs font-semibold flex items-center gap-2 rounded-lg transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
            }`}
          >
            <i className={`fa-solid ${tab.icon} text-[11px]`}></i>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Stats Bar */}
      <StatsBar stats={{ ...dashboardStats, totalEvents: activeIssues.length, activeBuses: activeBuses.filter(b => b.status === 'active').length }} />

      {/* Main Content Area */}
      <main className="flex-1 p-6 overflow-auto bg-[#0a0f1d]">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#0e1321]/80 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-lg card-top-glow">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <i className="fa-solid fa-map-location-dot text-cyan-400"></i>
                    Live Infrastructure GIS Matrix
                  </h2>
                  <span className="text-[11px] font-mono text-slate-400">Bengaluru Metropolitan Region • 3 Transit Corridors</span>
                </div>
                <div className="h-[420px] rounded-lg overflow-hidden border border-slate-800">
                  <MapView
                    events={activeIssues}
                    buses={activeBuses}
                    selectedEventId={selectedEventId}
                    onEventSelect={setSelectedEventId}
                  />
                </div>
              </div>
              <EventList
                events={activeIssues}
                selectedEventId={selectedEventId}
                onEventSelect={setSelectedEventId}
              />
            </div>
            <div className="space-y-6">
              <FleetPanel buses={activeBuses} />
              <PipelineView />
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-4">
            <EventList
              events={activeIssues}
              selectedEventId={selectedEventId}
              onEventSelect={setSelectedEventId}
            />
          </div>
        )}

        {activeTab === 'fleet' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#0e1321]/80 backdrop-blur-md border border-slate-800 rounded-xl p-5 shadow-lg card-top-glow">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <i className="fa-solid fa-bus text-cyan-400"></i>
                Active Fleet Live Position Grid
              </h3>
              <div className="h-[500px] rounded-lg overflow-hidden border border-slate-800">
                <MapView
                  events={activeIssues}
                  buses={activeBuses}
                  selectedEventId={selectedEventId}
                  onEventSelect={setSelectedEventId}
                />
              </div>
            </div>
            <FleetPanel buses={activeBuses} />
          </div>
        )}

        {activeTab === 'pipeline' && <PipelineView />}
        {activeTab === 'cv-demo' && <CVDemo />}
        {activeTab === 'temporal' && <TemporalValidationDemo />}
        {activeTab === 'demo' && <DemoMode />}
        {activeTab === 'failures' && <FailureScenarios />}
        {activeTab === 'analytics' && <AnalyticsPanel />}
        {activeTab === 'architecture' && <ArchitectureView />}
      </main>

      {/* Selected Event Details Modal */}
      {selectedEventId && (
        <EvidencePanel
          issue={activeIssues.find(e => e.id === selectedEventId) || null}
          onClose={() => setSelectedEventId(null)}
          onStatusUpdated={() => fetchLiveBackendData()}
        />
      )}
    </div>
  );
}
