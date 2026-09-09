import { useState, useEffect, useCallback } from 'react';
import CommandDashboard from './components/CommandDashboard';
import { FleetPanel } from './components/FleetPanel';
import DemoMode from './components/DemoMode';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import ArchitectureView from './components/ArchitectureView';
import FailureScenarios from './components/FailureScenarios';
import { CVDemo } from './components/CVDemo';
import { RoleSwitcher } from './components/RoleSwitcher';
import { simulatedEvents, simulatedBuses } from './data';
import { RoadEvent, Bus } from './types';
import { apiClient } from './api/client';
import { SUPPORTED_CITIES, getCityConfig } from './cities';

export type MainTab = 'command' | 'fleet' | 'demo' | 'analytics' | 'specs';
export type OperationalMode = 'LIVE' | 'DEMO' | 'OFFLINE';

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>('command');
  const [subSpecTab, setSubSpecTab] = useState<'architecture' | 'failures' | 'cv'>('architecture');

  // Multi-City Management (Amravati MH, Bengaluru KA, Mumbai MH, Pune MH)
  const [selectedCityId, setSelectedCityId] = useState<string>('amravati');
  const currentCity = getCityConfig(selectedCityId);

  // 3-Mode Operational Architecture (LIVE / DEMO / OFFLINE)
  const [mode, setMode] = useState<OperationalMode>('LIVE');
  const [liveIssues, setLiveIssues] = useState<RoadEvent[]>([]);
  const [liveBuses, setLiveBuses] = useState<Bus[]>([]);
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(false);

  const fetchLiveBackendData = useCallback(async () => {
    try {
      const health = await apiClient.checkHealth();
      if (health.online && health.data) {
        setIsLiveBackend(true);
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

  // Determine active issues and buses based on operational mode and selected city
  const activeIssues: RoadEvent[] = mode === 'LIVE'
    ? (isLiveBackend && liveIssues.length > 0
        ? (() => {
            const cityIssues = liveIssues.filter(issue => {
              const dLat = Math.abs(issue.location.lat - currentCity.center.lat);
              const dLng = Math.abs(issue.location.lng - currentCity.center.lng);
              return dLat < 0.8 && dLng < 0.8;
            });
            return cityIssues.length > 0 ? cityIssues : currentCity.issues;
          })()
        : currentCity.issues)
    : (mode === 'DEMO' ? currentCity.issues : currentCity.issues.slice(0, 4));

  const activeBuses: Bus[] = mode === 'LIVE'
    ? (isLiveBackend && liveBuses.length > 0
        ? (() => {
            const cityBuses = liveBuses.filter(bus => {
              const dLat = Math.abs(bus.currentLocation.lat - currentCity.center.lat);
              const dLng = Math.abs(bus.currentLocation.lng - currentCity.center.lng);
              return dLat < 0.8 && dLng < 0.8;
            });
            return cityBuses.length > 0 ? cityBuses : currentCity.buses;
          })()
        : currentCity.buses)
    : (mode === 'DEMO' ? currentCity.buses : currentCity.buses.map(b => ({ ...b, status: 'idle' })));

  // Streamlined 4 Core Navigation Items
  const primaryTabs: { id: MainTab; label: string; icon: string }[] = [
    { id: 'command', label: 'Command Deck', icon: 'fa-map-location-dot' },
    { id: 'fleet', label: 'Fleet & Edge AI', icon: 'fa-bus' },
    { id: 'demo', label: '16-Step Demo', icon: 'fa-play' },
    { id: 'analytics', label: 'Civic Analytics', icon: 'fa-chart-line' },
    { id: 'specs', label: 'System Audit', icon: 'fa-shield-halved' },
  ];

  return (
    <div className="h-screen w-screen bg-[#0a0f1d] text-[#dee2f6] flex flex-col font-sans overflow-hidden">
      {/* Sleek, Modern, Minimalist Top Navigation Header */}
      <header className="bg-[#0e1321]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-2.5 flex items-center justify-between shrink-0 z-20">
        {/* Brand & Logo + City Selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400/30">
              <i className="fa-solid fa-city text-white text-xs"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-tight">UrbanPulse</span>
                <span className="text-[10px] font-mono text-cyan-400 font-semibold px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-500/30">
                  SIH26124
                </span>
              </div>
            </div>
          </div>

          {/* City Selector Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <i className="fa-solid fa-location-dot text-cyan-400 text-[11px]"></i>
            <select
              value={selectedCityId}
              onChange={e => setSelectedCityId(e.target.value)}
              className="bg-transparent text-white font-bold font-mono text-xs focus:outline-none cursor-pointer pr-1"
            >
              {SUPPORTED_CITIES.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white font-mono">
                  {c.name} ({c.stateCode})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Center: Streamlined 4 Navigation Tabs */}
        <nav className="flex items-center gap-1 p-1 bg-slate-950/70 border border-slate-800/80 rounded-xl">
          {primaryTabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-cyan-600/90 text-white shadow-sm shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <i className={`fa-solid ${tab.icon} text-[10px]`}></i>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Controls: Mode Toggle & Role Switcher */}
        <div className="flex items-center gap-3">
          {/* Segmented Mode Toggle */}
          <div className="flex items-center gap-0.5 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
            <button
              onClick={() => { setMode('LIVE'); fetchLiveBackendData(); }}
              className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1.5 ${
                mode === 'LIVE'
                  ? (isLiveBackend ? 'bg-emerald-600 text-white shadow-sm' : 'bg-rose-600 text-white animate-pulse')
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Connect to live FastAPI & database backend"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveBackend ? 'bg-white' : 'bg-rose-200'}`}></span>
              LIVE
            </button>
            <button
              onClick={() => setMode('DEMO')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                mode === 'DEMO' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Inspect deterministic seeded Bangalore corridor dataset"
            >
              DEMO
            </button>
            <button
              onClick={() => setMode('OFFLINE')}
              className={`px-2.5 py-1 rounded-md font-bold transition ${
                mode === 'OFFLINE' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Simulate cellular disconnection and local SQLite buffering"
            >
              OFFLINE
            </button>
          </div>

          <RoleSwitcher />
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 overflow-hidden relative">
        {/* Tab 1: Command Deck (Central Map + Clean Incident Triage) */}
        {activeTab === 'command' && (
          <CommandDashboard
            issues={activeIssues}
            buses={activeBuses}
            isLive={mode === 'LIVE' && isLiveBackend}
            onRefresh={fetchLiveBackendData}
            city={currentCity}
          />
        )}

        {/* Tab 2: Fleet & AI */}
        {activeTab === 'fleet' && (
          <div className="h-full overflow-y-auto p-6 max-w-7xl mx-auto">
            <FleetPanel buses={activeBuses} />
          </div>
        )}

        {/* Tab 3: 16-Step Closed-Loop Hero Demo */}
        {activeTab === 'demo' && (
          <div className="h-full overflow-y-auto p-6 max-w-6xl mx-auto">
            <DemoMode />
          </div>
        )}

        {/* Tab 4: Civic Analytics */}
        {activeTab === 'analytics' && (
          <div className="h-full overflow-y-auto p-6 max-w-7xl mx-auto">
            <AnalyticsPanel />
          </div>
        )}

        {/* Tab 5: Evaluator System Audit & Deep Tech */}
        {activeTab === 'specs' && (
          <div className="h-full overflow-y-auto p-6 max-w-7xl mx-auto space-y-6">
            {/* Sub-selector for technical audit views */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-shield-halved text-cyan-400"></i>
                  SIH Technical Evaluator & System Audit Deck
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Inspect verified architecture specs, failure tolerance tests, and edge CV engine</p>
              </div>

              <div className="flex gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 font-mono text-xs">
                <button
                  onClick={() => setSubSpecTab('architecture')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    subSpecTab === 'architecture' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Architecture & Evidence
                </button>
                <button
                  onClick={() => setSubSpecTab('failures')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    subSpecTab === 'failures' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Failure Simulation
                </button>
                <button
                  onClick={() => setSubSpecTab('cv')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    subSpecTab === 'cv' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  YOLOv8 CV Engine
                </button>
              </div>
            </div>

            {subSpecTab === 'architecture' && <ArchitectureView />}
            {subSpecTab === 'failures' && <FailureScenarios />}
            {subSpecTab === 'cv' && <CVDemo />}
          </div>
        )}
      </main>
    </div>
  );
}
