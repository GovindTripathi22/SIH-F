// ============================================================
// UrbanPulse — Core Type Definitions
// SIH26124: AI-Powered Mobile Urban Intelligence Platform
// ============================================================

export type EventType =
  | 'pothole'
  | 'road_crack'
  | 'waterlogging'
  | 'traffic_congestion'
  | 'vehicle_count'
  | 'road_sign_damage'
  | 'zebra_crossing_deficiency';

export type VerificationStatus =
  | 'unverified'      // Single observation — possible event
  | 'pending_verify'  // 2 observations — awaiting spatial match
  | 'verified'        // Multi-pass confirmed — strong evidence
  | 'actioned'        // Sent to authority — maintenance queued
  | 'resolved';       // Authority confirmed fix

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type BusStatus = 'active' | 'idle' | 'maintenance' | 'offline';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Observation {
  id: string;
  busId: string;
  timestamp: string;
  confidence: number;
  location: GeoPoint;
  frameRef?: string;
}

export interface RoadEvent {
  id: string;
  type: EventType;
  location: GeoPoint;
  firstDetected: string;
  lastDetected: string;
  observations: Observation[];
  status: VerificationStatus;
  priority: Priority;
  severity: number; // 1-10
  description: string;
  address?: string;
}

export interface Bus {
  id: string;
  routeNumber: string;
  routeName: string;
  status: BusStatus;
  currentLocation: GeoPoint;
  lastPing: string;
  eventsDetected: number;
  speed: number; // km/h
  cameraStatus: 'online' | 'offline' | 'error';
}

export interface PipelineStage {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'processing' | 'idle' | 'error';
  throughput: number; // events/minute
  lastProcessed?: string;
}

export interface DashboardStats {
  totalEvents: number;
  verifiedEvents: number;
  activeBuses: number;
  criticalIssues: number;
  eventsToday: number;
  avgConfidence: number;
  multiPassRate: number;
}
