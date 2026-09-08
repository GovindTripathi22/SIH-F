// ============================================================
// UrbanPulse — Type Definitions
// Aligned with ARCHITECTURE.md data contracts
// ============================================================

// ---------- Enums ----------

export type EventType =
  | 'pothole'
  | 'road_crack'
  | 'waterlogging'
  | 'traffic_congestion'
  | 'vehicle_count'
  | 'road_sign_damage'
  | 'zebra_crossing_deficiency';

export type EventStatus =
  | 'unverified'
  | 'pending_verify'
  | 'verified'
  | 'actioned'
  | 'resolved';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type BusStatus = 'active' | 'idle' | 'maintenance' | 'offline';

export type CameraStatus = 'online' | 'offline' | 'error';

// ---------- Core Data Objects ----------

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface DetectionBBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Observation: A single raw detection from one bus pass.
 * Multiple observations of the same location are aggregated into an Event.
 */
export interface Observation {
  id: string;
  busId: string;
  timestamp: string;
  confidence: number;
  location: GeoLocation;
  frameReference?: string;
  rawDetection?: {
    bbox: number[];
    className: string;
    modelVersion: string;
  };
}

/**
 * Event: An aggregated, geotagged urban infrastructure issue.
 * Created from one or more observations of the same location.
 */
export interface RoadEvent {
  id: string;
  type: EventType;
  location: GeoLocation;
  firstDetected: string;
  lastDetected: string;
  observations: Observation[];
  status: EventStatus;
  priority: Priority;
  severity: number; // 1-10
  description: string;
  address?: string;
  frameReference?: string;
  cameraId?: string;
  speedKmh?: number;
  heading?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Bus: A public transport vehicle acting as a mobile sensor unit.
 */
export interface Bus {
  id: string;
  routeNumber: string;
  routeName: string;
  status: BusStatus;
  currentLocation: GeoLocation;
  lastPing: string;
  eventsDetected: number;
  speed: number;
  cameraStatus: CameraStatus;
  firmwareVersion?: string;
}

// ---------- Pipeline ----------

export interface PipelineStage {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'processing' | 'active' | 'error';
  throughput: number; // events per second
  lastProcessed: string;
}

// ---------- Dashboard ----------

export interface DashboardStats {
  totalEvents: number;
  verifiedEvents: number;
  activeBuses: number;
  criticalIssues: number;
  eventsToday: number;
  avgConfidence: number;
  multiPassRate: number;
}

// ---------- API Contracts ----------

export interface CreateEventPayload {
  bus_id: string;
  route_id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  event_type: EventType;
  confidence: number;
  frame_reference?: string;
  camera_id: string;
  speed_kmh?: number;
  heading?: number;
  detection_bbox?: number[];
}

export interface EventQueryParams {
  bbox?: [number, number, number, number]; // [west, south, east, north]
  event_type?: EventType;
  status?: EventStatus;
  priority?: Priority;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  total?: number;
  page?: number;
  limit?: number;
  error?: string;
}

// ---------- Verification Rules ----------

export interface VerificationRule {
  id: string;
  eventType: EventType;
  minObservations: number;
  timeWindowSeconds: number;
  spatialRadiusMeters: number;
  minConfidence: number;
}

// ---------- WebSocket Events ----------

export type WSEventType =
  | 'new_event'
  | 'event_verified'
  | 'event_updated'
  | 'bus_location'
  | 'pipeline_status';

export interface WSEvent {
  type: WSEventType;
  payload: unknown;
  timestamp: string;
}

// ---------- Architecture Status ----------

export type ModuleStatus = 'built' | 'in_progress' | 'future';

export interface ArchitectureModule {
  name: string;
  layer: string;
  status: ModuleStatus;
  description: string;
  techStack: string[];
}
