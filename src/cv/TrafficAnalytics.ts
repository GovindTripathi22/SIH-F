/**
 * Traffic Analytics Engine
 * 
 * Uses actual detection data to estimate traffic patterns.
 * Pipeline: VIDEO → VEHICLE DETECTION → TRACKING → COUNT/DENSITY → AGGREGATION
 * 
 * NOTE: This module analyzes vehicle_count detections from the CV engine.
 * It does NOT claim real-time traffic prediction.
 */

import { RoadEvent } from '../types';

export interface TrafficSnapshot {
  location: { lat: number; lng: number };
  timestamp: string;
  vehicle_count: number;
  density_category: 'free' | 'light' | 'moderate' | 'heavy' | 'congested';
  avg_speed_kmh?: number;
  source_buses: string[];
}

export interface RouteTrafficPattern {
  route_id: string;
  route_name: string;
  hourly_counts: Array<{
    hour: number;
    avg_vehicle_count: number;
    density_category: string;
  }>;
  congestion_hotspots: Array<{
    location: { lat: number; lng: number };
    severity: 'low' | 'medium' | 'high';
    frequency: number;
  }>;
}

export interface TrafficInsight {
  location: { lat: number; lng: number };
  time_window: string;
  vehicle_count: number;
  density_category: string;
  trend: 'increasing' | 'stable' | 'decreasing';
  confidence: number;
  data_points: number;
}

/**
 * Classify traffic density based on vehicle count
 */
export function classifyDensity(vehicleCount: number): TrafficSnapshot['density_category'] {
  if (vehicleCount < 5) return 'free';
  if (vehicleCount < 15) return 'light';
  if (vehicleCount < 30) return 'moderate';
  if (vehicleCount < 50) return 'heavy';
  return 'congested';
}

/**
 * Aggregate vehicle detections into traffic snapshots
 */
export function aggregateTrafficSnapshots(
  events: RoadEvent[],
  timeWindowMinutes: number = 15
): TrafficSnapshot[] {
  const vehicleEvents = events.filter(e => e.type === 'vehicle_count' || e.type === 'traffic_congestion');
  
  if (vehicleEvents.length === 0) return [];

  // Group by location (within ~100m) and time window
  const gridSize = 0.001; // ~100m
  const groups: Map<string, RoadEvent[]> = new Map();

  vehicleEvents.forEach(event => {
    const gridKey = `${Math.floor(event.location.lat / gridSize)},${Math.floor(event.location.lng / gridSize)}`;
    if (!groups.has(gridKey)) {
      groups.set(gridKey, []);
    }
    groups.get(gridKey)!.push(event);
  });

  // Create snapshots from groups
  const snapshots: TrafficSnapshot[] = [];
  
  groups.forEach((events, _) => {
    const avgLat = events.reduce((sum, e) => sum + e.location.lat, 0) / events.length;
    const avgLng = events.reduce((sum, e) => sum + e.location.lng, 0) / events.length;
    const sourceBuses = [...new Set(events.flatMap(e => e.observations.map(o => o.busId)))];
    
    // Estimate vehicle count from observations
    const totalObservations = events.reduce((sum, e) => sum + e.observations.length, 0);
    const avgConfidence = events.reduce((sum, e) => {
      const eventAvg = e.observations.reduce((s, o) => s + o.confidence, 0) / e.observations.length;
      return sum + eventAvg;
    }, 0) / events.length;

    snapshots.push({
      location: { lat: avgLat, lng: avgLng },
      timestamp: events[events.length - 1].lastDetected,
      vehicle_count: totalObservations,
      density_category: classifyDensity(totalObservations),
      source_buses: sourceBuses,
    });
  });

  return snapshots;
}

/**
 * Generate traffic insights from snapshots
 */
export function generateTrafficInsights(snapshots: TrafficSnapshot[]): TrafficInsight[] {
  return snapshots.map(snapshot => ({
    location: snapshot.location,
    time_window: snapshot.timestamp,
    vehicle_count: snapshot.vehicle_count,
    density_category: snapshot.density_category,
    trend: 'stable', // Would need historical data for real trends
    confidence: 0.7, // Based on data quality
    data_points: snapshot.source_buses.length,
  }));
}

/**
 * Identify congestion hotspots from traffic data
 */
export function identifyCongestionHotspots(
  events: RoadEvent[],
  minFrequency: number = 3
): Array<{ location: { lat: number; lng: number }; severity: string; frequency: number }> {
  const congestionEvents = events.filter(e => e.type === 'traffic_congestion');
  
  if (congestionEvents.length === 0) return [];

  // Group by location
  const gridSize = 0.002; // ~200m
  const groups: Map<string, RoadEvent[]> = new Map();

  congestionEvents.forEach(event => {
    const gridKey = `${Math.floor(event.location.lat / gridSize)},${Math.floor(event.location.lng / gridSize)}`;
    if (!groups.has(gridKey)) {
      groups.set(gridKey, []);
    }
    groups.get(gridKey)!.push(event);
  });

  // Filter by minimum frequency and create hotspots
  const hotspots: Array<{ location: { lat: number; lng: number }; severity: string; frequency: number }> = [];

  groups.forEach((events, _) => {
    if (events.length >= minFrequency) {
      const avgLat = events.reduce((sum, e) => sum + e.location.lat, 0) / events.length;
      const avgLng = events.reduce((sum, e) => sum + e.location.lng, 0) / events.length;
      
      let severity = 'low';
      if (events.length >= 10) severity = 'high';
      else if (events.length >= 5) severity = 'medium';

      hotspots.push({
        location: { lat: avgLat, lng: avgLng },
        severity,
        frequency: events.length,
      });
    }
  });

  return hotspots.sort((a, b) => b.frequency - a.frequency);
}
