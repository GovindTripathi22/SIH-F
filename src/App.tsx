import { useState } from 'react';
import { MapView } from './components/MapView';
import { EventList } from './components/EventList';
import { FleetPanel } from './components/FleetPanel';
import { PipelineView } from './components/PipelineView';
import { StatsBar } from './components/StatsBar';
import ArchitectureView from './components/ArchitectureView';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { simulatedEvents, simulatedBuses, dashboardStats } from './data';

type Tab = 'dashboard' | 'events' | 'fleet' | 'pipeline' | 'analytics' | 'architecture';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
    { id: 'events', label: 'Events', icon: 'fa-triangle-exclamation' },
    { id: 'fleet', label: 'Fleet', icon: 'fa-bus' },
    { id: 'pipeline', label: 'Pipeline', icon: 'fa-diagram-project' },
    { id: 'analytics', label: 'Analytics', icon: 'fa-chart-line' },
    { id: 'architecture', label: 'Architecture', icon: 'fa-sitemap' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <i className="fa-solid fa-city text-white text-sm"></i>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">UrbanPulse</h1>
            <p className="text-[10px] text-gray-400 -mt-0.5">AI Mobile Urban Intelligence • SIH26124</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>{simulatedBuses.filter(b => b.status === 'active').length} buses active</span>
          </div>
          <div className="text-xs text-gray-500">
            BEL × SIH 2026
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-gray-900/50 border-b border-gray-800 px-6 flex gap-1 shrink-0">
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
      </nav>

      {/* Stats Bar */}
      <StatsBar stats={dashboardStats} />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-0">
            <div className="lg:col-span-2 h-[calc(100vh-180px)]">
              <MapView
                events={simulatedEvents}
                buses={simulatedBuses}
                selectedEventId={selectedEventId}
                onEventSelect={setSelectedEventId}
              />
            </div>
            <div className="h-[calc(100vh-180px)] overflow-y-auto border-l border-gray-800">
              <EventList
                events={simulatedEvents}
                selectedEventId={selectedEventId}
                onEventSelect={setSelectedEventId}
                compact
              />
            </div>
          </div>
        )}
        {activeTab === 'events' && (
          <div className="h-[calc(100vh-180px)] overflow-y-auto p-6">
            <EventList
              events={simulatedEvents}
              selectedEventId={selectedEventId}
              onEventSelect={setSelectedEventId}
            />
          </div>
        )}
        {activeTab === 'fleet' && (
          <div className="h-[calc(100vh-180px)] overflow-y-auto p-6">
            <FleetPanel buses={simulatedBuses} />
          </div>
        )}
        {activeTab === 'pipeline' && <PipelineView />}
        {activeTab === 'analytics' && (
          <div className="h-[calc(100vh-180px)] overflow-y-auto p-6">
            <AnalyticsPanel />
          </div>
        )}
        {activeTab === 'architecture' && <ArchitectureView />}
      </main>
    </div>
  );
}
