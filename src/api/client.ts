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
    // Prefer sessionStorage to reduce persistent XSS token exposure window
    try {
      this.token = sessionStorage.getItem('urbanpulse_jwt_token') || localStorage.getItem('urbanpulse_jwt_token');
      const savedUser = sessionStorage.getItem('urbanpulse_user') || localStorage.getItem('urbanpulse_user');
      if (savedUser) this.currentUser = JSON.parse(savedUser);
    } catch {
      this.currentUser = null;
    }
  }

  setToken(token: string | null) {
    this.token = token;
    try {
      if (token) {
        sessionStorage.setItem('urbanpulse_jwt_token', token);
      } else {
        sessionStorage.removeItem('urbanpulse_jwt_token');
        localStorage.removeItem('urbanpulse_jwt_token');
      }
    } catch {
      // Storage unavailable in restricted sandboxes
    }
  }

  getToken(): string | null {
    return this.token;
  }

  setCurrentUser(user: { username: string; role: string; full_name: string } | null) {
    this.currentUser = user;
    try {
      if (user) {
        sessionStorage.setItem('urbanpulse_user', JSON.stringify(user));
      } else {
        sessionStorage.removeItem('urbanpulse_user');
        localStorage.removeItem('urbanpulse_user');
      }
    } catch {
      // Storage unavailable
    }
  }

  getCurrentUser(): { username: string; role: string; full_name: string } | null {
    return this.currentUser;
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
   * Unified, resilient HTTP request helper with timeout and error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = 5000
  ): Promise<T> {
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = isFormData
      ? (this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
      : this.getHeaders(options.headers as Record<string, string> || {});

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        ...options,
        headers,
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async login(username: string, password: string): Promise<{ access_token: string; role: string; full_name: string; username: string }> {
    const data = await this.request<{ access_token: string; role: string; full_name: string; username: string }>(
      '/api/v1/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      },
      5000
    );
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

  /**
   * Check backend health and readiness
   */
  async checkHealth(): Promise<{ online: boolean; data?: BackendHealth }> {
    try {
      const data = await this.request<BackendHealth>('/health', {}, 3000);
      this.isOnline = true;
      return { online: true, data };
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
      const data = await this.request<any>('/api/v1/issues?page_size=100', {}, 4000);
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

        // Honest observation attribution without fabricating license plates
        const observations = (item.observations && Array.isArray(item.observations) && item.observations.length > 0)
          ? item.observations.map((obs: any, idx: number) => ({
              id: obs.observation_id || `obs-${item.issue_id}-${idx + 1}`,
              busId: obs.bus_id || `Fleet Unit #${idx + 1}`,
              timestamp: obs.timestamp || firstTime,
              confidence: obs.confidence || item.confidence || 0.88,
              location: {
                lat: obs.latitude || item.centroid_latitude,
                lng: obs.longitude || item.centroid_longitude
              }
            }))
          : Array.from({ length: Math.max(1, item.observation_count || 1) }, (_, idx) => ({
              id: `obs-${item.issue_id}-${idx + 1}`,
              busId: idx === 0 ? `Primary Probe` : `Corroborating Unit #${idx + 1}`,
              timestamp: idx === 0 ? firstTime : lastTime,
              confidence: item.confidence || 0.88,
              location: {
                lat: item.centroid_latitude,
                lng: item.centroid_longitude
              }
            }));

        return {
          id: item.issue_id,
          type: (item.event_type || 'pothole') as any,
          location: {
            lat: item.centroid_latitude,
            lng: item.centroid_longitude
          },
          firstDetected: firstTime,
          lastDetected: lastTime,
          observations,
          status: (item.status === 'PENDING' ? (item.observation_count >= 2 ? 'verified' : 'pending_verify') :
                   (item.status === 'RESOLVED' || item.status === 'RESOLUTION_VERIFIED' ? 'resolved' : 'actioned')) as any,
          priority: (item.priority?.toLowerCase() || 'medium') as any,
          severity: sevNum,
          description: reasons[0] || `Detected ${item.event_type} at coordinates (${item.centroid_latitude.toFixed(4)}, ${item.centroid_longitude.toFixed(4)})`,
          address: `Monitored Transit Corridor (${item.centroid_latitude.toFixed(3)}, ${item.centroid_longitude.toFixed(3)})`,
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
      const data = await this.request<any[]>('/api/v1/buses', {}, 3000);
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

    return await this.request<CVDetectionResponse>(
      '/api/v1/cv/detect',
      { method: 'POST', body: formData },
      8000
    );
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

    return await this.request<any>(
      '/api/v1/cv/detect-and-ingest',
      { method: 'POST', body: formData },
      8000
    );
  }

  /**
   * Generate and trigger download of official municipal PDF Work Order
   */
  async downloadWorkOrderPdf(issueId: string, department?: string): Promise<void> {
    const deptParam = department ? `?department=${encodeURIComponent(department)}` : '';
    const res = await fetch(`/api/v1/work-orders/${encodeURIComponent(issueId)}/pdf${deptParam}`, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(8000)
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
    return await this.request<any>(
      '/api/v1/work-orders/lifecycle',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue_id: issueId,
          target_status: targetStatus,
          actor,
          notes: notes || 'Lifecycle status update'
        })
      },
      5000
    );
  }

  /**
   * Fetch consolidated live database analytics KPIs
   */
  async getAnalyticsOverview(): Promise<{ overview: AnalyticsOverview; source: 'database' | 'offline_fallback' }> {
    try {
      const data = await this.request<AnalyticsOverview>('/api/v1/analytics/overview', {}, 4000);
      this.isOnline = true;
      return { overview: data, source: 'database' };
    } catch (err) {
      console.warn('Analytics API unavailable, compiling fallback metrics:', err);
      const totalIssues = simulatedEvents.length;
      const multiPass = simulatedEvents.filter(e => e.observations.length >= 2).length;
      const totalObs = simulatedEvents.reduce((s, e) => s + e.observations.length, 0);
      const allConf = simulatedEvents.flatMap(e => e.observations).map(o => Math.round(o.confidence * 100));
      const avgConf = allConf.length > 0 ? Math.round(allConf.reduce((a, b) => a + b, 0) / allConf.length) : 85;
      const verifiedCount = simulatedEvents.filter(e => e.status === 'verified' || e.status === 'actioned').length;
      const verRate = Math.round((verifiedCount / totalIssues) * 100);

      const typeDist = simulatedEvents.reduce((acc, e) => {
        const k = e.type.replace(/_/g, ' ');
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const fallbackOverview: AnalyticsOverview = {
        total_events: totalObs,
        total_issues: totalIssues,
        multi_pass_events: multiPass,
        total_observations: totalObs,
        avg_confidence: avgConf,
        verification_rate: verRate,
        type_data: Object.entries(typeDist).map(([name, value]) => ({ name, value })),
        status_data: [
          { name: 'Unverified', value: simulatedEvents.filter(e => e.status === 'unverified').length, color: '#6b7280' },
          { name: 'Pending', value: simulatedEvents.filter(e => e.status === 'pending_verify').length, color: '#eab308' },
          { name: 'Verified', value: simulatedEvents.filter(e => e.status === 'verified').length, color: '#3b82f6' },
          { name: 'Actioned', value: simulatedEvents.filter(e => e.status === 'actioned').length, color: '#22c55e' },
          { name: 'Resolved', value: 0, color: '#10b981' },
        ],
        priority_data: [
          { name: 'Critical', count: simulatedEvents.filter(e => e.priority === 'critical').length, color: '#ef4444' },
          { name: 'High', count: simulatedEvents.filter(e => e.priority === 'high').length, color: '#f97316' },
          { name: 'Medium', count: simulatedEvents.filter(e => e.priority === 'medium').length, color: '#eab308' },
          { name: 'Low', count: simulatedEvents.filter(e => e.priority === 'low').length, color: '#6b7280' },
        ],
        hourly_data: Array.from({ length: 24 }, (_, i) => ({
          hour: `${i}:00`,
          detections: Math.round((i >= 6 && i <= 22 ? 15 + Math.sin((i - 6) * 0.5) * 12 : 3) + (i >= 8 && i <= 10 ? 10 : 0)),
          verified: Math.round((i >= 6 && i <= 22 ? 8 + Math.sin((i - 6) * 0.5) * 6 : 1) + (i >= 8 && i <= 10 ? 5 : 0)),
        }))
      };

      return { overview: fallbackOverview, source: 'offline_fallback' };
    }
  }
}

export interface AnalyticsOverview {
  total_events: number;
  total_issues: number;
  multi_pass_events: number;
  total_observations: number;
  avg_confidence: number;
  verification_rate: number;
  type_data: Array<{ name: string; value: number }>;
  status_data: Array<{ name: string; value: number; color: string }>;
  priority_data: Array<{ name: string; count: number; color: string }>;
  hourly_data: Array<{ hour: string; detections: number; verified: number }>;
}

export const apiClient = new APIClient();
