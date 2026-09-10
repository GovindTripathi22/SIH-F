/**
 * Mobile Edge API Client for UrbanPulse Backend.
 * Handles authenticated CV inference, telemetry upload, and WebSocket subscription.
 */

import { CVDetectionResponse, UserSession } from '../types';

let currentBaseUrl = 'http://10.0.2.2:8001'; // Default for Android Emulator (127.0.0.1 on host)
let currentToken: string | null = null;
let currentEdgeKey = 'edge_k8s_prod_key_77a94f';

export const MobileAPI = {
  setBaseUrl(url: string) {
    currentBaseUrl = url.replace(/\/+$/, '');
  },

  getBaseUrl(): string {
    return currentBaseUrl;
  },

  setToken(token: string | null) {
    currentToken = token;
  },

  getToken(): string | null {
    return currentToken;
  },

  setEdgeKey(key: string) {
    currentEdgeKey = key;
  },

  getEdgeKey(): string {
    return currentEdgeKey;
  },

  async checkHealth(): Promise<{ online: boolean; data?: any }> {
    try {
      const response = await fetch(`${currentBaseUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        return { online: true, data };
      }
      return { online: false };
    } catch {
      return { online: false };
    }
  },

  async login(username: string, password: string): Promise<UserSession> {
    const response = await fetch(`${currentBaseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Authentication failed' }));
      throw new Error(err.detail || 'Authentication failed');
    }

    const data = await response.json();
    currentToken = data.access_token;
    return {
      token: data.access_token,
      username: data.username,
      role: data.role,
      fullName: data.full_name,
    };
  },

  async detectAndIngest(params: {
    imageUri: string;
    busId: string;
    routeId: string;
    cameraId: string;
    latitude: number;
    longitude: number;
    confidenceThreshold?: number;
  }): Promise<CVDetectionResponse> {
    const formData = new FormData();

    // Append file
    formData.append('file', {
      uri: params.imageUri,
      name: `frame_${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);

    formData.append('bus_id', params.busId);
    formData.append('route_id', params.routeId);
    formData.append('camera_id', params.cameraId);
    formData.append('latitude', String(params.latitude));
    formData.append('longitude', String(params.longitude));
    formData.append('confidence_threshold', String(params.confidenceThreshold || 0.30));

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-Edge-Device-Key': currentEdgeKey,
    };

    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const response = await fetch(`${currentBaseUrl}/api/v1/cv/detect-and-ingest`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'CV Ingestion failed' }));
      throw new Error(err.detail || `Server error: ${response.status}`);
    }

    return await response.json();
  },

  getWebSocketUrl(): string {
    const wsUrl = currentBaseUrl.replace(/^http/, 'ws');
    return currentToken
      ? `${wsUrl}/ws/live-feed?token=${encodeURIComponent(currentToken)}`
      : `${wsUrl}/ws/live-feed`;
  }
};
