import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RoadEvent, Bus } from '../types';

interface Props {
  events: RoadEvent[];
  buses: Bus[];
  selectedEventId: string | null;
  onEventSelect: (id: string | null) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
}

const EVENT_COLORS: Record<string, string> = {
  pothole: '#ef4444',
  road_crack: '#f97316',
  waterlogging: '#3b82f6',
  traffic_congestion: '#eab308',
  vehicle_count: '#8b5cf6',
  road_sign_damage: '#6b7280',
  zebra_crossing_deficiency: '#ec4899',
};

const STATUS_ICONS: Record<string, string> = {
  unverified: '?',
  pending_verify: '~',
  verified: '✓',
  actioned: '▶',
  resolved: '✓',
};

function createEventIcon(event: RoadEvent, isSelected: boolean): L.DivIcon {
  const color = EVENT_COLORS[event.type] || '#6b7280';
  const size = isSelected ? 32 : 24;
  const statusChar = STATUS_ICONS[event.status] || '?';

  return L.divIcon({
    className: 'custom-event-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 3px solid ${isSelected ? '#ffffff' : color + '80'};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: ${isSelected ? 14 : 10}px;
        font-weight: bold;
        box-shadow: 0 0 ${isSelected ? 16 : 8}px ${color}80;
        transition: all 0.2s;
      ">${statusChar}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createBusIcon(bus: Bus): L.DivIcon {
  const isActive = bus.status === 'active';
  const color = isActive ? '#22d3ee' : '#6b7280';

  return L.divIcon({
    className: 'custom-bus-marker',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background: ${color}20;
        border: 2px solid ${color};
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        box-shadow: 0 0 8px ${color}40;
      ">🚌</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function MapView({ events, buses, selectedEventId, onEventSelect, center, zoom }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter = center ? [center.lat, center.lng] : [20.9374, 77.7580];
    const initialZoom = zoom || 13;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter as L.LatLngExpression,
      zoom: initialZoom,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Smoothly fly to new city coordinates when center changes
  useEffect(() => {
    if (!mapRef.current || !center) return;
    mapRef.current.flyTo([center.lat, center.lng], zoom || 13, {
      duration: 1.2
    });
  }, [center?.lat, center?.lng, zoom]);

  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    // Add event markers
    events.forEach(event => {
      const isSelected = event.id === selectedEventId;
      const marker = L.marker(
        [event.location.lat, event.location.lng],
        { icon: createEventIcon(event, isSelected) }
      );

      marker.bindPopup(`
        <div style="font-family: system-ui; min-width: 200px;">
          <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px;">
            ${event.type.replace(/_/g, ' ').toUpperCase()}
          </div>
          <div style="font-size: 11px; color: #666; margin-bottom: 6px;">${event.address || 'Location'}</div>
          <div style="font-size: 11px; margin-bottom: 4px;">
            <strong>Status:</strong> ${event.status.replace(/_/g, ' ')}
          </div>
          <div style="font-size: 11px; margin-bottom: 4px;">
            <strong>Observations:</strong> ${event.observations.length}
          </div>
          <div style="font-size: 11px; margin-bottom: 4px;">
            <strong>Priority:</strong> ${event.priority}
          </div>
          <div style="font-size: 11px;">
            <strong>Severity:</strong> ${event.severity}/10
          </div>
          <div style="font-size: 11px; margin-top: 6px; color: #444;">
            ${event.description}
          </div>
        </div>
      `);

      marker.on('click', () => onEventSelect(event.id));
      marker.addTo(markersRef.current!);
    });

    // Add bus markers
    buses.forEach(bus => {
      const marker = L.marker(
        [bus.currentLocation.lat, bus.currentLocation.lng],
        { icon: createBusIcon(bus) }
      );

      marker.bindPopup(`
        <div style="font-family: system-ui; min-width: 180px;">
          <div style="font-weight: bold; font-size: 13px;">🚌 ${bus.id}</div>
          <div style="font-size: 11px; color: #666; margin: 4px 0;">${bus.routeName}</div>
          <div style="font-size: 11px;"><strong>Route:</strong> ${bus.routeNumber}</div>
          <div style="font-size: 11px;"><strong>Status:</strong> ${bus.status}</div>
          <div style="font-size: 11px;"><strong>Speed:</strong> ${bus.speed} km/h</div>
          <div style="font-size: 11px;"><strong>Events:</strong> ${bus.eventsDetected}</div>
          <div style="font-size: 11px;"><strong>Camera:</strong> ${bus.cameraStatus}</div>
        </div>
      `);

      marker.addTo(markersRef.current!);
    });
  }, [events, buses, selectedEventId, onEventSelect]);

  return (
    <div className="relative h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
      {/* Map Legend */}
      {/* Empty corridor notification overlay */}
      {events.length === 0 && buses.length === 0 && (
        <div className="absolute top-4 left-64 bg-slate-900/90 backdrop-blur-md border border-cyan-500/30 rounded-xl px-4 py-2 z-[1000] shadow-xl text-xs font-mono text-slate-300 flex items-center gap-2.5">
          <i className="fa-solid fa-satellite-dish text-cyan-400 animate-pulse"></i>
          <span>Corridor clear: 0 distress events or fleet pings recorded</span>
        </div>
      )}

      {/* Map Legend */}
      <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg p-3 z-[1000]">
        <div className="text-[10px] font-semibold text-gray-300 mb-2 uppercase tracking-wider">Event Types</div>
        <div className="space-y-1.5">
          {Object.entries(EVENT_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: color }}></div>
              <span className="text-[10px] text-gray-400">{type.replace(/_/g, ' ')}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-700">
            <div className="w-3 h-3 rounded border-2 border-cyan-400 flex items-center justify-center text-[8px]">🚌</div>
            <span className="text-[10px] text-gray-400">Active Bus</span>
          </div>
        </div>
        <div className="text-[10px] font-semibold text-gray-300 mt-3 mb-1 uppercase tracking-wider">Status</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">? Unverified</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">~ Pending Verify</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">✓ Verified</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">▶ Actioned</span>
          </div>
        </div>
      </div>
    </div>
  );
}
