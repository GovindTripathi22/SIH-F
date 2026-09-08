import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RoadEvent, Bus, Route } from '../types';

// Fix leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface GISIntelligenceLayerProps {
  issues: RoadEvent[];
  buses: Bus[];
  routes: Route[];
  onIssueSelect: (issue: RoadEvent) => void;
}

interface FilterState {
  priority: string[];
  status: string[];
  eventType: string[];
  timeRange: '1h' | '24h' | '7d' | '30d' | 'all';
  minObservations: number;
}

// Severity colors (based on severity number 1-10)
const getSeverityColor = (severity: number): string => {
  if (severity >= 9) return '#dc2626'; // Safety hazard - red
  if (severity >= 7) return '#ea580c'; // Severe - orange
  if (severity >= 5) return '#ca8a04'; // Moderate - yellow
  if (severity >= 3) return '#65a30d'; // Minor - green
  return '#0891b2'; // Cosmetic - cyan
};

// Priority sizes
const PRIORITY_SIZES: Record<string, number> = {
  critical: 18,
  high: 15,
  medium: 12,
  low: 10,
};

export default function GISIntelligenceLayer({ issues, buses, routes, onIssueSelect }: GISIntelligenceLayerProps) {
  const [filters, setFilters] = useState<FilterState>({
    priority: [],
    status: [],
    eventType: [],
    timeRange: '24h',
    minObservations: 1,
  });
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showBusCoverage, setShowBusCoverage] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showClusters, setShowClusters] = useState(true);

  // Filter issues based on criteria
  const filteredIssues = issues.filter(issue => {
    // Priority filter
    if (filters.priority.length > 0 && !filters.priority.includes(issue.priority)) {
      return false;
    }
    // Status filter
    if (filters.status.length > 0 && !filters.status.includes(issue.status)) {
      return false;
    }
    // Event type filter
    if (filters.eventType.length > 0 && !filters.eventType.includes(issue.type)) {
      return false;
    }
    // Time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date();
      const firstDetected = new Date(issue.firstDetected);
      const hoursDiff = (now.getTime() - firstDetected.getTime()) / (1000 * 60 * 60);
      
      if (filters.timeRange === '1h' && hoursDiff > 1) return false;
      if (filters.timeRange === '24h' && hoursDiff > 24) return false;
      if (filters.timeRange === '7d' && hoursDiff > 168) return false;
      if (filters.timeRange === '30d' && hoursDiff > 720) return false;
    }
    // Min observations filter
    if (issue.observations.length < filters.minObservations) {
      return false;
    }
    return true;
  });

  // Calculate hotspot clusters (simple grid-based clustering)
  const clusters = showClusters ? calculateClusters(filteredIssues) : [];

  // Calculate heatmap data
  const heatmapData = showHeatmap ? calculateHeatmap(filteredIssues) : [];

  return (
    <div className="h-full flex flex-col">
      {/* Filter Bar */}
      <div className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Time Range */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Time:</span>
            <select
              value={filters.timeRange}
              onChange={(e) => setFilters({ ...filters, timeRange: e.target.value as any })}
              className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-700"
            >
              <option value="1h">Last 1 hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Priority:</span>
            {['critical', 'high', 'medium', 'low'].map(p => (
              <button
                key={p}
                onClick={() => {
                  const newPriority = filters.priority.includes(p)
                    ? filters.priority.filter(x => x !== p)
                    : [...filters.priority, p];
                  setFilters({ ...filters, priority: newPriority });
                }}
                className={`text-xs px-2 py-1 rounded ${
                  filters.priority.includes(p)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Status:</span>
            {['unverified', 'verified', 'actioned', 'resolved'].map(s => (
              <button
                key={s}
                onClick={() => {
                  const newStatus = filters.status.includes(s)
                    ? filters.status.filter(x => x !== s)
                    : [...filters.status, s];
                  setFilters({ ...filters, status: newStatus });
                }}
                className={`text-xs px-2 py-1 rounded ${
                  filters.status.includes(s)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Min Observations */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Min Obs:</span>
            <input
              type="number"
              min="1"
              max="20"
              value={filters.minObservations}
              onChange={(e) => setFilters({ ...filters, minObservations: parseInt(e.target.value) })}
              className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-700 w-16"
            />
          </div>

          {/* Layer Toggles */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`text-xs px-3 py-1 rounded ${
                showHeatmap ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              Heatmap
            </button>
            <button
              onClick={() => setShowBusCoverage(!showBusCoverage)}
              className={`text-xs px-3 py-1 rounded ${
                showBusCoverage ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              Bus Coverage
            </button>
            <button
              onClick={() => setShowRoutes(!showRoutes)}
              className={`text-xs px-3 py-1 rounded ${
                showRoutes ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              Routes
            </button>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={[12.9716, 77.5946]}
          zoom={13}
          className="h-full w-full"
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Heatmap Circles */}
          {heatmapData.map((point, idx) => (
            <CircleMarker
              key={`heatmap-${idx}`}
              center={[point.lat, point.lng]}
              radius={point.intensity * 30}
              pathOptions={{
                color: 'transparent',
                fillColor: `rgba(220, 38, 38, ${point.intensity * 0.5})`,
                fillOpacity: 0.6,
              }}
            />
          ))}

          {/* Route Lines */}
          {showRoutes && routes.map(route => (
            <Polyline
              key={route.id}
              positions={[
                [route.startLocation.lat, route.startLocation.lng],
                [route.endLocation.lat, route.endLocation.lng],
              ]}
              pathOptions={{ color: '#06b6d4', weight: 3, opacity: 0.6 }}
            />
          ))}

          {/* Bus Coverage Circles */}
          {showBusCoverage && buses.filter(b => b.status === 'active').map(bus => (
            <CircleMarker
              key={`bus-${bus.id}`}
              center={[bus.currentLocation.lat, bus.currentLocation.lng]}
              radius={20}
              pathOptions={{
                color: '#10b981',
                fillColor: '#10b981',
                fillOpacity: 0.2,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-bold">{bus.id}</div>
                  <div>Route: {bus.routeNumber}</div>
                  <div>Status: {bus.status}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Cluster Markers */}
          {clusters.map((cluster, idx) => (
            <Marker
              key={`cluster-${idx}`}
              position={[cluster.lat, cluster.lng]}
              icon={L.divIcon({
                className: 'custom-cluster-icon',
                html: `<div style="
                  background: rgba(59, 130, 246, 0.8);
                  border: 3px solid white;
                  border-radius: 50%;
                  width: ${Math.min(cluster.count * 3 + 30, 60)}px;
                  height: ${Math.min(cluster.count * 3 + 30, 60)}px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-weight: bold;
                  font-size: 14px;
                ">${cluster.count}</div>`,
              })}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-bold">{cluster.count} issues in this area</div>
                  <div>Click to zoom in</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Issue Markers */}
          {filteredIssues.map(issue => (
            <CircleMarker
              key={issue.id}
              center={[issue.location.lat, issue.location.lng]}
              radius={PRIORITY_SIZES[issue.priority] || 10}
              pathOptions={{
                color: getSeverityColor(issue.severity),
                fillColor: getSeverityColor(issue.severity),
                fillOpacity: 0.7,
                weight: 2,
              }}
              eventHandlers={{
                click: () => onIssueSelect(issue),
              }}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-bold text-sm mb-1">{issue.type}</div>
                  <div><span className="font-semibold">Priority:</span> {issue.priority}</div>
                  <div><span className="font-semibold">Severity:</span> {issue.severity}/10</div>
                  <div><span className="font-semibold">Observations:</span> {issue.observations.length}</div>
                  <div><span className="font-semibold">Status:</span> {issue.status}</div>
                  <button
                    onClick={() => onIssueSelect(issue)}
                    className="mt-2 px-2 py-1 bg-blue-600 text-white rounded text-xs"
                  >
                    View Details
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Map Controls */}
          <MapControls />
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs">
          <div className="font-bold mb-2 text-white">Legend</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ background: getSeverityColor(9) }}></div>
              <span className="text-gray-300">Safety Hazard (9-10)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ background: getSeverityColor(7) }}></div>
              <span className="text-gray-300">Severe (7-8)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ background: getSeverityColor(5) }}></div>
              <span className="text-gray-300">Moderate (5-6)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ background: getSeverityColor(3) }}></div>
              <span className="text-gray-300">Minor (3-4)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-300">Active Bus</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-gray-300">Issue Cluster</span>
            </div>
          </div>
        </div>

        {/* Stats Overlay */}
        <div className="absolute top-4 right-4 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs">
          <div className="font-bold mb-2 text-white">Live Statistics</div>
          <div className="space-y-1 text-gray-300">
            <div>Total Issues: <span className="font-bold text-white">{filteredIssues.length}</span></div>
            <div>Critical: <span className="font-bold text-red-400">{filteredIssues.filter(i => i.priority === 'critical').length}</span></div>
            <div>High: <span className="font-bold text-orange-400">{filteredIssues.filter(i => i.priority === 'high').length}</span></div>
            <div>Active Buses: <span className="font-bold text-green-400">{buses.filter(b => b.status === 'active').length}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple grid-based clustering
function calculateClusters(issues: RoadEvent[]): Array<{ lat: number; lng: number; count: number }> {
  const gridSize = 0.01; // ~1km grid
  const grid: Record<string, { lat: number; lng: number; count: number }> = {};

  issues.forEach(issue => {
    const gridKey = `${Math.floor(issue.location.lat / gridSize)},${Math.floor(issue.location.lng / gridSize)}`;
    
    if (!grid[gridKey]) {
      grid[gridKey] = {
        lat: issue.location.lat,
        lng: issue.location.lng,
        count: 0,
      };
    }
    grid[gridKey].count++;
  });

  return Object.values(grid).filter(g => g.count >= 2);
}

// Simple heatmap calculation
function calculateHeatmap(issues: RoadEvent[]): Array<{ lat: number; lng: number; intensity: number }> {
  return issues.map(issue => ({
    lat: issue.location.lat,
    lng: issue.location.lng,
    intensity: Math.min(issue.observations.length / 10, 1), // Normalize to 0-1
  }));
}

// Map controls
function MapControls() {
  const map = useMap();

  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control leaflet-bar">
        <button
          onClick={() => map.zoomIn()}
          className="bg-gray-800 text-white px-2 py-1 border-b border-gray-700 hover:bg-gray-700"
        >
          +
        </button>
        <button
          onClick={() => map.zoomOut()}
          className="bg-gray-800 text-white px-2 py-1 hover:bg-gray-700"
        >
          -
        </button>
      </div>
    </div>
  );
}
