/**
 * UrbanPulse Typed API Client
 * Connects the React municipal frontend directly to the FastAPI/PostGIS backend.
 * Provides live synchronization with graceful fallback for offline demonstration.
 */

import { RoadEvent, Bus, Route } from '../types';
import { simulatedEvents, simulatedBuses } from '../data';

const BASE_URL = ''; // Relative to take advantage of Vite proxy, or http://127.0.0.1:8001 fallback

export interface BackendHealth {
  status: string;
  service: string;
  version: string;
  subsystems: {
    backend: string;
    database: string;
    database_stats?: {
      verified_issues: number;
      fleet_buses: number;
    };
    cv_engine: string;
    cv_details?: {
      model_name: string;
      weights_size_mb: number;
      supported_classes: string[];
    };
    privacy_engine: string;
    work_order_engine: string;
    multi_pass_consensus: string;
    edge_resilience: string;
  };
}

export interface CVDetectionResponse {
  detections: Array<{
    class: string;
    confidence: number;
    box: { x1: number; y1: number; x2: number; y2: number; width: number; height: number };
  }>;
  detection_count: number;
  inference_latency_ms: number;
  fps: number;
  validation_score: number;
  camera_health: {
    status: 'NORMAL' | 'DEGRADED' | 'BLOCKED' | 'LOW_LIGHT';
    data_quality: 'HIGH' | 'LOW' | 'DEGRADED' | 'UNUSABLE';
    blur_laplacian_variance: number;
    mean_brightness: number;
    reasons: string[];
  };
  privacy: {
    faces_anonymized: number;
    plates_anonymized: number;
    total_redactions: number;
  };
  evidence_frame_base64: string;
}

class APIClient {
  private isOnline = false;
  private token: string | null = null;
  private currentUser: { username: string; role: string; full_name: string } | null = null;

  constructor() {
    this.token = localStorage.getItem('urbanpulse_jwt_token');
    try {
      const savedUser = localStorage.getItem('urbanpulse_user');
      if (savedUser) this.currentUser = JSON.parse(savedUser);
    } catch {
      this.currentUser = null;
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('urbanpulse_jwt_token', token);
    } else {
      localStorage.removeItem('urbanpulse_jwt_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  setCurrentUser(user: { username: string; role: string; full_name: string } | null) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem('urbanpulse_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('urbanpulse_user');
    }
  }

  getCurrentUser(): { username: string; role: string; full_name: string } | null {
    return this.currentUser;
  }

  async login(username: string, password: string): Promise<{ access_token: string; role: string; full_name: string; username: string }> {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      throw new Error(`Authentication failed with HTTP ${res.status}`);
    }
    const data = await res.json();
    this.setToken(data.access_token);
    this.setCurrentUser({
      username: data.username,
      role: data.role,
      full_name: data.full_name
    });
    return data;
  }

  logout() {
    this.setToken(null);
    this.setCurrentUser(null);
  }

  private getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...customHeaders
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * Check backend health and readiness
   */
  async checkHealth(): Promise<{ online: boolean; data?: BackendHealth }> {
    try {
      const res = await fetch('/health', {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        this.isOnline = true;
        return { online: true, data };
      }
      this.isOnline = false;
      return { online: false };
    } catch {
      this.isOnline = false;
      return { online: false };
    }
  }

  isBackendOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Fetch all verified issues from database
   */
  async getIssues(): Promise<{ issues: RoadEvent[]; source: 'database' | 'offline_fallback' }> {
    try {
      const res = await fetch('/api/v1/issues?page_size=100', {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.isOnline = true;

      // Transform backend VerifiedIssue into frontend RoadEvent format
      const mapped: RoadEvent[] = (data.items || []).map((item: any) => {
        let reasons: string[] = [];
        try {
          if (item.priority_reasons) reasons = JSON.parse(item.priority_reasons);
        } catch {
          reasons = [item.priority_reasons || 'Verified observation'];
        }

        const sevNum = item.severity === 'SAFETY_HAZARD' ? 9 : (item.severity === 'SEVERE' ? 7 : (item.severity === 'MODERATE' ? 5 : 3));
        const firstTime = item.first_observed || new Date().toISOString();
        const lastTime = item.last_observed || new Date().toISOString();

        return {
          id: item.issue_id,
          type: (item.event_type || 'pothole') as any,
          location: {
            lat: item.centroid_latitude,
            lng: item.centroid_longitude
          },
          firstDetected: firstTime,
          lastDetected: lastTime,
          observations: [
            {
              id: `obs-${item.issue_id}-1`,
              busId: `BUS-KA01-001`,
              timestamp: firstTime,
              confidence: item.confidence || 0.88,
              location: {
                lat: item.centroid_latitude,
                lng: item.centroid_longitude
              }
            },
            ...(item.observation_count > 1 ? [{
              id: `obs-${item.issue_id}-2`,
              busId: `BUS-KA01-002`,
              timestamp: lastTime,
              confidence: item.confidence || 0.92,
              location: {
                lat: item.centroid_latitude,
                lng: item.centroid_longitude
              }
            }] : [])
          ],
          status: (item.status === 'PENDING' ? (item.observation_count >= 2 ? 'verified' : 'pending_verify') :
                   (item.status === 'RESOLVED' || item.status === 'RESOLUTION_VERIFIED' ? 'resolved' : 'actioned')) as any,
          priority: (item.priority?.toLowerCase() || 'medium') as any,
          severity: sevNum,
          description: reasons[0] || `Detected ${item.event_type} at coordinates (${item.centroid_latitude.toFixed(4)}, ${item.centroid_longitude.toFixed(4)})`,
          address: `Bengaluru Public Transport Corridor`,
          createdAt: firstTime,
          updatedAt: lastTime
        };
      });

      return { issues: mapped, source: 'database' };
    } catch (err) {
      console.warn('Backend unavailable, falling back to cached simulated events:', err);
      this.isOnline = false;
      return { issues: simulatedEvents, source: 'offline_fallback' };
    }
  }

  /**
   * Fetch fleet buses
   */
  async getBuses(): Promise<{ buses: Bus[]; source: 'database' | 'offline_fallback' }> {
    try {
      const res = await fetch('/api/v1/buses', {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.isOnline = true;

      const mapped: Bus[] = data.map((b: any) => ({
        id: b.bus_id,
        routeNumber: b.registration_number,
        routeName: b.current_route_id || 'Route 201-C',
        status: (b.current_status?.toLowerCase() || 'active') as any,
        currentLocation: {
          lat: b.current_latitude || 12.9385,
          lng: b.current_longitude || 77.6280
        },
        lastPing: b.last_ping || new Date().toISOString(),
        eventsDetected: b.total_events_detected || 0,
        speed: b.last_speed_kmh || 30.0,
        cameraStatus: (b.camera_status?.toLowerCase() || 'online') as any
      }));

      return { buses: mapped, source: 'database' };
    } catch {
      return { buses: simulatedBuses, source: 'offline_fallback' };
    }
  }

  /**
   * Run real deep-learning inference on an image frame
   */
  async detectFrame(imageBlob: Blob, confidenceThreshold: number = 0.35): Promise<CVDetectionResponse> {
    const formData = new FormData();
    formData.append('file', imageBlob, 'frame.jpg');
    formData.append('confidence_threshold', String(confidenceThreshold));
    formData.append('apply_privacy', 'true');

    const res = await fetch('/api/v1/cv/detect', {
      method: 'POST',
      body: formData,
      headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
    });

    if (!res.ok) {
      throw new Error(`Detection request failed: HTTP ${res.status}`);
    }
    return res.json();
  }

  /**
   * Ingest detection frame and run multi-pass verification in PostGIS/SQLite
   */
  async detectAndIngest(
    imageBlob: Blob,
    busId: string,
    routeId: string,
    lat: number,
    lon: number,
    confidenceThreshold: number = 0.35
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', imageBlob, 'frame.jpg');
    formData.append('bus_id', busId);
    formData.append('route_id', routeId);
    formData.append('latitude', String(lat));
    formData.append('longitude', String(lon));
    formData.append('confidence_threshold', String(confidenceThreshold));

    const res = await fetch('/api/v1/cv/detect-and-ingest', {
      method: 'POST',
      body: formData,
      headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
    });

    if (!res.ok) {
      throw new Error(`Ingest failed: HTTP ${res.status}`);
    }
    return res.json();
  }

  /**
   * Generate and trigger download of official municipal PDF Work Order
   */
  async downloadWorkOrderPdf(issueId: string, department?: string): Promise<void> {
    const deptParam = department ? `?department=${encodeURIComponent(department)}` : '';
    const res = await fetch(`/api/v1/work-orders/${encodeURIComponent(issueId)}/pdf${deptParam}`, {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      throw new Error(`Failed to generate work order PDF: HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WorkOrder_${issueId.toUpperCase()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Advance maintenance lifecycle (IN_PROGRESS, REPAIRED, RESOLUTION_VERIFIED)
   */
  async updateLifecycle(issueId: string, targetStatus: string, actor: string, notes?: string): Promise<any> {
    const res = await fetch('/api/v1/work-orders/lifecycle', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        issue_id: issueId,
        target_status: targetStatus,
        actor,
        notes: notes || 'Lifecycle status update'
      })
    });

    if (!res.ok) {
      throw new Error(`Failed to update lifecycle: HTTP ${res.status}`);
    }
    return res.json();
  }
}

export const apiClient = new APIClient();
