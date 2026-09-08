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

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('command');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<RoadEvent | null>(null);

  // Live backend data state
  const [issues, setIssues] = useState<RoadEvent[]>(simulatedEvents);
  const [buses, setBuses] = useState<Bus[]>(simulatedBuses);
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(false);
  const [healthData, setHealthData] = useState<BackendHealth | null>(null);

  const fetchLiveBackendData = useCallback(async () => {
    const health = await apiClient.checkHealth();
    if (health.online && health.data) {
      setIsLiveBackend(true);
      setHealthData(health.data);
      const issuesRes = await apiClient.getIssues();
      setIssues(issuesRes.issues);
      const busesRes = await apiClient.getBuses();
      setBuses(busesRes.buses);
    } else {
      setIsLiveBackend(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveBackendData();
    const interval = setInterval(fetchLiveBackendData, 6000);
    return () => clearInterval(interval);
  }, [fetchLiveBackendData]);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'command', label: 'Command', icon: 'fa-tower-broadcast' },
    { id: 'gis', label: 'GIS Map', icon: 'fa-map-location-dot' },
    { id: 'demo', label: 'SIH Demo', icon: 'fa-play-circle' },
    { id: 'failures', label: 'Failures', icon: 'fa-shield-halved' },
    { id: 'dashboard', label: 'Overview', icon: 'fa-gauge-high' },
    { id: 'events', label: 'Events', icon: 'fa-triangle-exclamation' },
    { id: 'fleet', label: 'Fleet', icon: 'fa-bus' },
    { id: 'pipeline', label: 'Pipeline', icon: 'fa-diagram-project' },
    { id: 'cv-demo', label: 'CV Engine', icon: 'fa-video' },
    { id: 'temporal', label: 'Temporal', icon: 'fa-clock-rotate-left' },
    { id: 'analytics', label: 'Analytics', icon: 'fa-chart-line' },
    { id: 'architecture', label: 'Architecture', icon: 'fa-sitemap' },
  ];

  // Command Dashboard is a full-page view
  if (activeTab === 'command') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        {/* Top bar with tab navigation and live status */}
        <div className="bg-gray-900 border-b border-gray-800 px-6 flex items-center justify-between">
          <div className="flex gap-1 overflow-x-auto py-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-xs font-medium flex items-center gap-2 border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <i className={`fa-solid ${tab.icon} text-[10px]`}></i>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <RoleSwitcher />
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
              isLiveBackend
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400'
                : 'bg-amber-950/80 border-amber-500/50 text-amber-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isLiveBackend ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              {isLiveBackend ? `LIVE DATABASE SYNC (${issues.length} Issues)` : 'OFFLINE MODE (FALLBACK)'}
            </span>
          </div>
        </div>
        <CommandDashboard
          issues={issues}
          buses={buses}
          isLive={isLiveBackend}
          onRefresh={fetchLiveBackendData}
        />
      </div>
    );
  }

  // GIS Intelligence Layer is a full-page view
  if (activeTab === 'gis') {
    return (
      <div className="h-screen flex flex-col bg-gray-950">
        {/* Top bar with tab navigation */}
        <div className="bg-gray-900 border-b border-gray-800 px-6 flex items-center justify-between shrink-0">
          <div className="flex gap-1 overflow-x-auto py-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-xs font-medium flex items-center gap-2 border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <i className={`fa-solid ${tab.icon} text-[10px]`}></i>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <RoleSwitcher />
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-full">
              PostGIS Spatial View • {issues.length} Hotspots
            </span>
          </div>
        </div>
        <div className="flex-1">
          <GISIntelligenceLayer
            issues={issues}
            buses={buses}
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
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <i className="fa-solid fa-city text-white text-sm"></i>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">UrbanPulse</h1>
            <p className="text-[10px] text-gray-400 -mt-0.5">AI Mobile Urban Intelligence • SIH26124</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <RoleSwitcher />
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>{buses.filter(b => b.status === 'active').length} buses active</span>
          </div>
          <div className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 border ${
            isLiveBackend ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/40' : 'bg-amber-950/70 text-amber-400 border-amber-500/40'
          }`}>
            <i className={`fa-solid ${isLiveBackend ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
            <span>{isLiveBackend ? 'Backend Connected' : 'Offline Mode'}</span>
          </div>
          <div className="text-xs text-gray-500">
            BEL × SIH 2026
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-gray-900/80 border-b border-gray-800 px-6 flex gap-1 shrink-0 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <i className={`fa-solid ${tab.icon} text-[10px]`}></i>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Stats Bar */}
      <StatsBar stats={{ ...dashboardStats, totalEvents: issues.length, activeBuses: buses.filter(b => b.status === 'active').length }} />

      {/* Main Content Area */}
      <main className="flex-1 p-6 overflow-auto">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <i className="fa-solid fa-map-location-dot text-blue-400"></i>
                    Live Infrastructure Hotspots
                  </h2>
                  <span className="text-[10px] text-gray-400">Bengaluru Metropolitan Region</span>
                </div>
                <div className="h-[420px] rounded-lg overflow-hidden border border-gray-800">
                  <MapView
                    events={issues}
                    buses={buses}
                    selectedEventId={selectedEventId}
                    onEventSelect={setSelectedEventId}
                  />
                </div>
              </div>
              <EventList
                events={issues}
                selectedEventId={selectedEventId}
                onEventSelect={setSelectedEventId}
              />
            </div>
            <div className="space-y-6">
              <FleetPanel buses={buses} />
              <PipelineView />
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-yellow-400"></i>
              Verified Infrastructure Issues ({issues.length})
            </h2>
            <EventList
              events={issues}
              selectedEventId={selectedEventId}
              onEventSelect={setSelectedEventId}
            />
          </div>
        )}

        {activeTab === 'fleet' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <i className="fa-solid fa-bus text-blue-400"></i>
                Active Bus Positions
              </h3>
              <div className="h-[500px] rounded-lg overflow-hidden border border-gray-800">
                <MapView
                  events={issues}
                  buses={buses}
                  selectedEventId={selectedEventId}
                  onEventSelect={setSelectedEventId}
                />
              </div>
            </div>
            <FleetPanel buses={buses} />
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
          issue={issues.find(e => e.id === selectedEventId) || null}
          onClose={() => setSelectedEventId(null)}
          onStatusUpdated={() => fetchLiveBackendData()}
        />
      )}
    </div>
  );
}
