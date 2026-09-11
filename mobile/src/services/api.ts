/**
 * Mobile Edge API Client for UrbanPulse Backend.
 * Handles authenticated CV inference, telemetry upload, secure credential storage,
 * and WebSocket live feed subscriptions with resilient auto-reconnect.
 */

import * as SecureStore from 'expo-secure-store';
import { CVDetectionResponse, UserSession } from '../types';

const SECURE_STORE_TOKEN_KEY = 'urbanpulse_auth_token';
const SECURE_STORE_EDGE_KEY = 'urbanpulse_edge_key';
const SECURE_STORE_BASE_URL_KEY = 'urbanpulse_base_url';
const SECURE_STORE_SESSION_KEY = 'urbanpulse_user_session';

let currentBaseUrl = 'http://10.0.2.2:8001'; // Default for Android Emulator (127.0.0.1 on host)
let currentToken: string | null = null;
let currentEdgeKey: string = ''; // No hardcoded fallback — configured in Settings or Login
let activeWs: WebSocket | null = null;

export const MobileAPI = {
  /**
   * Restore persisted credentials, configurations, and user session from secure storage.
   */
  async init(): Promise<{
    token: string | null;
    edgeKey: string;
    baseUrl: string;
    session: UserSession | null;
  }> {
    let restoredSession: UserSession | null = null;
    try {
      const storedToken = await SecureStore.getItemAsync(SECURE_STORE_TOKEN_KEY);
      if (storedToken) {
        currentToken = storedToken;
      }
      const storedKey = await SecureStore.getItemAsync(SECURE_STORE_EDGE_KEY);
      if (storedKey) {
        currentEdgeKey = storedKey;
      }
      const storedUrl = await SecureStore.getItemAsync(SECURE_STORE_BASE_URL_KEY);
      if (storedUrl) {
        currentBaseUrl = storedUrl.replace(/\/+$/, '');
      }
      const storedSessionJson = await SecureStore.getItemAsync(SECURE_STORE_SESSION_KEY);
      if (storedSessionJson) {
        try {
          restoredSession = JSON.parse(storedSessionJson);
        } catch {}
      }
    } catch (err) {
      console.warn('Could not restore credentials from SecureStore:', err);
    }
    return {
      token: currentToken,
      edgeKey: currentEdgeKey,
      baseUrl: currentBaseUrl,
      session: restoredSession,
    };
  },

  async setBaseUrl(url: string): Promise<void> {
    currentBaseUrl = url.replace(/\/+$/, '');
    try {
      await SecureStore.setItemAsync(SECURE_STORE_BASE_URL_KEY, currentBaseUrl);
    } catch {}
  },

  getBaseUrl(): string {
    return currentBaseUrl;
  },

  async setToken(token: string | null): Promise<void> {
    currentToken = token;
    try {
      if (token) {
        await SecureStore.setItemAsync(SECURE_STORE_TOKEN_KEY, token);
      } else {
        await SecureStore.deleteItemAsync(SECURE_STORE_TOKEN_KEY);
        await SecureStore.deleteItemAsync(SECURE_STORE_SESSION_KEY);
      }
    } catch {}
  },

  getToken(): string | null {
    return currentToken;
  },

  async setEdgeKey(key: string): Promise<void> {
    currentEdgeKey = key.trim();
    try {
      if (currentEdgeKey) {
        await SecureStore.setItemAsync(SECURE_STORE_EDGE_KEY, currentEdgeKey);
      } else {
        await SecureStore.deleteItemAsync(SECURE_STORE_EDGE_KEY);
      }
    } catch {}
  },

  getEdgeKey(): string {
    return currentEdgeKey;
  },

  async checkHealth(): Promise<{ online: boolean; data?: any }> {
    try {
      const response = await fetch(`${currentBaseUrl}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
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

  async login(username: string, password: string, edgeKey?: string): Promise<UserSession> {
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
    const session: UserSession = {
      token: data.access_token,
      username: data.username,
      role: data.role,
      fullName: data.full_name,
    };

    await this.setToken(data.access_token);
    try {
      await SecureStore.setItemAsync(SECURE_STORE_SESSION_KEY, JSON.stringify(session));
    } catch {}

    if (edgeKey && edgeKey.trim()) {
      await this.setEdgeKey(edgeKey);
    }

    return session;
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
    if (!currentEdgeKey && !currentToken) {
      throw new Error(
        'Authentication required: Please log in or configure an Edge Device Key in Settings.'
      );
    }

    const formData = new FormData();

    if (params.imageUri.startsWith('data:')) {
      const res = await fetch(params.imageUri);
      const blob = await res.blob();
      formData.append('file', blob as any, `dashcam_${Date.now()}.jpg`);
    } else {
      formData.append('file', {
        uri: params.imageUri,
        name: `dashcam_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);
    }

    formData.append('bus_id', params.busId);
    formData.append('route_id', params.routeId);
    formData.append('camera_id', params.cameraId);
    formData.append('latitude', String(params.latitude));
    formData.append('longitude', String(params.longitude));
    formData.append('confidence_threshold', String(params.confidenceThreshold || 0.3));

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (currentEdgeKey) {
      headers['X-Edge-Device-Key'] = currentEdgeKey;
    }

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

  getWebSocketUrl(corridor?: string): string {
    const wsUrl = currentBaseUrl.replace(/^http/, 'ws');
    const params: string[] = [];
    if (currentToken) {
      params.push(`token=${encodeURIComponent(currentToken)}`);
    }
    if (corridor) {
      params.push(`corridor=${encodeURIComponent(corridor)}`);
    }
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    return `${wsUrl}/ws/live-feed${query}`;
  },

  /**
   * Subscribe to live WebSocket updates from backend with automatic reconnect and message handlers.
   */
  subscribeLiveFeed(
    callbacks: {
      onMessage?: (event: any) => void;
      onOpen?: () => void;
      onClose?: () => void;
      onError?: (err: any) => void;
    },
    corridor?: string
  ): () => void {
    let isClosedByClient = false;
    let reconnectAttempts = 0;
    let reconnectTimeout: any = null;
    let ws: WebSocket | null = null;

    function connect() {
      if (isClosedByClient || !currentToken) return;

      const url = MobileAPI.getWebSocketUrl(corridor);
      ws = new WebSocket(url);
      activeWs = ws;

      ws.onopen = () => {
        reconnectAttempts = 0;
        callbacks.onOpen?.();
        if (corridor && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'subscribe', corridors: [corridor] }));
        }
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          callbacks.onMessage?.(data);
        } catch {}
      };

      ws.onerror = (e) => {
        callbacks.onError?.(e);
      };

      ws.onclose = () => {
        callbacks.onClose?.();
        if (activeWs === ws) {
          activeWs = null;
        }
        if (!isClosedByClient) {
          reconnectAttempts++;
          const delay = Math.min(10000, 1000 * Math.pow(1.5, reconnectAttempts));
          reconnectTimeout = setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      isClosedByClient = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
      if (activeWs === ws) {
        activeWs = null;
      }
    };
  },
};
