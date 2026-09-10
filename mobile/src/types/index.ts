/**
 * Shared Mobile Types for UrbanPulse Edge Telemetry.
 */

export interface CVDetection {
  class: string;
  confidence: number;
  box: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    height: number;
  };
}

export interface CVDetectionResponse {
  status: string;
  event_id: string;
  event_type: string;
  confidence: number;
  verified_issue_id?: string;
  detections: CVDetection[];
  cv_performance: {
    latency_ms: number;
    fps: number;
    camera_health: 'NORMAL' | 'DEGRADED' | 'BLOCKED' | 'LOW_LIGHT';
    redactions: {
      faces_anonymized: number;
      plates_anonymized: number;
      total_redactions: number;
    };
  };
  evidence_preview?: string;
}

export interface QueuedEvent {
  id: string;
  busId: string;
  routeId: string;
  cameraId: string;
  latitude: number;
  longitude: number;
  gpsAccuracy: number;
  timestamp: string;
  frameBase64?: string;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  errorMessage?: string;
}

export interface UserSession {
  token: string;
  username: string;
  role: string;
  fullName: string;
}
