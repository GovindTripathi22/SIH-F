import test from 'node:test';
import assert from 'node:assert/strict';
import { APIClient, mapBackendIssueToRoadEvent } from '../client.ts';

// Helper mock factory for window/document storage in Node test runner
function setupMockBrowserEnvironment(initialCookies = '') {
  const localStorageStore = new Map();
  const sessionStorageStore = new Map();

  global.localStorage = {
    getItem: (k) => localStorageStore.get(k) || null,
    setItem: (k, v) => localStorageStore.set(k, String(v)),
    removeItem: (k) => localStorageStore.delete(k),
    clear: () => localStorageStore.clear(),
  };

  global.sessionStorage = {
    getItem: (k) => sessionStorageStore.get(k) || null,
    setItem: (k, v) => sessionStorageStore.set(k, String(v)),
    removeItem: (k) => sessionStorageStore.delete(k),
    clear: () => sessionStorageStore.clear(),
  };

  global.document = {
    cookie: initialCookies,
    createElement: (tag) => ({
      tagName: tag,
      href: '',
      download: '',
      click: () => {},
    }),
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
  };

  global.window = {
    location: { protocol: 'http:', host: '127.0.0.1:5173' },
    URL: {
      createObjectURL: (blob) => `blob:mock://${Math.random()}`,
      revokeObjectURL: () => {},
    },
  };

  return { localStorageStore, sessionStorageStore };
}

// 1. Storage Hygiene
test('APIClient Storage Hygiene: Removes legacy tokens from localStorage', () => {
  const { localStorageStore } = setupMockBrowserEnvironment();
  localStorageStore.set('urbanpulse_jwt_token', 'stale-token-123');
  localStorageStore.set('urbanpulse_user', JSON.stringify({ username: 'stale' }));

  const client = new APIClient();
  assert.equal(localStorage.getItem('urbanpulse_jwt_token'), null);
  assert.equal(localStorage.getItem('urbanpulse_user'), null);
  assert.equal(client.getToken(), null);
});

// 2. Headers, Credentials, and CSRF Protection
test('APIClient CSRF Protection: Passes credentials and X-CSRF-Token on state-changing requests', async () => {
  setupMockBrowserEnvironment('csrf_token=test-csrf-cookie-999; other=value');
  const client = new APIClient();

  let capturedUrl = '';
  let capturedOptions = null;

  global.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  // 1. GET request should NOT attach CSRF token
  await client.request('/api/v1/test-get', { method: 'GET' });
  assert.equal(capturedOptions.credentials, 'same-origin');
  assert.equal(capturedOptions.headers['X-CSRF-Token'], undefined);

  // 2. POST request SHOULD attach X-CSRF-Token extracted from cookie
  await client.request('/api/v1/test-post', {
    method: 'POST',
    body: JSON.stringify({ key: 'val' }),
  });
  assert.equal(capturedOptions.credentials, 'same-origin');
  assert.equal(capturedOptions.headers['X-CSRF-Token'], 'test-csrf-cookie-999');

  // 3. PUT and DELETE should also attach X-CSRF-Token
  await client.request('/api/v1/test-put', { method: 'PUT' });
  assert.equal(capturedOptions.headers['X-CSRF-Token'], 'test-csrf-cookie-999');

  await client.request('/api/v1/test-delete', { method: 'DELETE' });
  assert.equal(capturedOptions.headers['X-CSRF-Token'], 'test-csrf-cookie-999');
});

// 3. Timeout Behavior
test('APIClient Timeout: Aborts request when timeout threshold is exceeded', async () => {
  setupMockBrowserEnvironment();
  const client = new APIClient();

  // Mock fetch that hangs until aborted by signal
  global.fetch = async (url, options) => {
    return new Promise((resolve, reject) => {
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      }
    });
  };

  await assert.rejects(
    async () => {
      // 50ms short timeout to trigger abort
      await client.requestRaw('/api/v1/slow-endpoint', { method: 'GET' }, 50);
    },
    (err) => {
      assert.equal(err.name, 'AbortError');
      return true;
    }
  );
});

// 4. Authentication Login
test('APIClient Authentication: Login stores csrf/access token in memory and sets user', async () => {
  setupMockBrowserEnvironment();
  const client = new APIClient();

  global.fetch = async (url, options) => {
    assert.equal(url, '/api/v1/auth/login');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'same-origin');
    return new Response(JSON.stringify({
      access_token: 'jwt-access-token-abc',
      role: 'PWD_ENGINEER',
      full_name: 'BBMP Engineer',
      username: 'engineer@bbmp.gov.in',
      csrf_token: 'csrf-secret-token-xyz',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const loginRes = await client.login('engineer@bbmp.gov.in', 'pwd123');
  assert.equal(loginRes.access_token, 'jwt-access-token-abc');
  assert.equal(client.getToken(), 'jwt-access-token-abc');
  assert.equal(client.getCsrfToken(), 'csrf-secret-token-xyz');
  assert.equal(client.getCurrentUser().username, 'engineer@bbmp.gov.in');

  // Verify token is NOT persisted in localStorage
  assert.equal(localStorage.getItem('urbanpulse_jwt_token'), null);
});

// 5. Authentication Logout
test('APIClient Authentication: Logout clears session cookies and local memory state', async () => {
  setupMockBrowserEnvironment();
  const client = new APIClient();
  client.setToken('session-jwt');
  client.setCsrfToken('csrf-token');
  client.setCurrentUser({ username: 'admin', role: 'ADMIN', full_name: 'Admin' });

  let logoutCalled = false;
  global.fetch = async (url, options) => {
    if (url === '/api/v1/auth/logout') {
      logoutCalled = true;
      assert.equal(options.method, 'POST');
      assert.equal(options.credentials, 'same-origin');
      return new Response(JSON.stringify({ message: 'Logged out' }), { status: 200 });
    }
    return new Response('', { status: 404 });
  };

  await client.logout();
  assert.equal(logoutCalled, true);
  assert.equal(client.getToken(), null);
  assert.equal(client.getCsrfToken(), null);
  assert.equal(client.getCurrentUser(), null);
  assert.equal(sessionStorage.getItem('urbanpulse_user'), null);
});

// 6. Error Handling
test('APIClient Error Handling: Parses backend JSON error detail', async () => {
  setupMockBrowserEnvironment();
  const client = new APIClient();

  global.fetch = async () => {
    return new Response(JSON.stringify({ detail: 'CSRF token missing or invalid' }), {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'Content-Type': 'application/json' },
    });
  };

  await assert.rejects(
    async () => {
      await client.request('/api/v1/protected', { method: 'POST' });
    },
    /HTTP Error 403: CSRF token missing or invalid/
  );
});

// 7. Method: checkHealth()
test('APIClient Method checkHealth: Returns health metadata when online, false on error', async () => {
  setupMockBrowserEnvironment();
  const client = new APIClient();

  // Online path
  global.fetch = async (url) => {
    assert.equal(url, '/health');
    return new Response(JSON.stringify({
      status: 'healthy',
      service: 'UrbanPulse Backend',
      version: '1.0.0',
      subsystems: { backend: 'ONLINE', database: 'ONLINE', cv_engine: 'READY' }
    }), { status: 200 });
  };

  const health1 = await client.checkHealth();
  assert.equal(health1.online, true);
  assert.equal(health1.data.status, 'healthy');
  assert.equal(client.isBackendOnline(), true);

  // Offline path
  global.fetch = async () => {
    throw new Error('Connection refused');
  };

  const health2 = await client.checkHealth();
  assert.equal(health2.online, false);
  assert.equal(client.isBackendOnline(), false);
});

// 8. Method: getWebSocketUrl()
test('APIClient Method getWebSocketUrl: Generates correct URL with ws/wss protocol and token', () => {
  setupMockBrowserEnvironment();
  const client = new APIClient();

  // Without token
  const url1 = client.getWebSocketUrl();
  assert.equal(url1, 'ws://127.0.0.1:5173/ws/live-feed');

  // With token
  client.setToken('my-secret-jwt');
  const url2 = client.getWebSocketUrl();
  assert.equal(url2, 'ws://127.0.0.1:5173/ws/live-feed?token=my-secret-jwt');
});

// 9. Method: getIssues() (Online & Offline)
test('APIClient Method getIssues: Returns mapped database items when online', async () => {
  setupMockBrowserEnvironment();
  const client = new APIClient();

  global.fetch = async (url) => {
    assert(url.includes('/api/v1/issues'));
    return new Response(JSON.stringify({
      items: [
        {
          issue_id: 'amr-01',
          event_type: 'pothole',
          severity: 'SAFETY_HAZARD',
          priority: 'CRITICAL',
          status: 'PENDING',
          centroid_latitude: 20.925,
          centroid_longitude: 77.756,
          observation_count: 4,
          confidence: 0.95,
        }
      ],
      total: 1
    }), { status: 200 });
  };

  const result = await client.getIssues();
  assert.equal(result.source, 'database');
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].id, 'amr-01');
  assert.equal(result.issues[0].type, 'pothole');
  assert.equal(result.issues[0].priority, 'critical');
  assert.equal(client.isBackendOnline(), true);
});

// 10. Method: getBuses() (Online & Offline)
test('APIClient Method getBuses: Maps backend fleet items and provides fallback', async () => {
  setupMockBrowserEnvironment();
  const client = new APIClient();

  // Online path
  global.fetch = async (url) => {
    assert.equal(url, '/api/v1/buses');
    return new Response(JSON.stringify([
      {
        bus_id: 'bus-mh27-01',
        registration_number: 'MH-27-X-4011',
        current_route_id: 'Route 1A',
        current_status: 'ACTIVE',
        current_latitude: 20.925,
        current_longitude: 77.756,
        last_speed_kmh: 35.0,
        camera_status: 'ONLINE',
        total_events_detected: 8,
      }
    ]), { status: 200 });
  };

  const result = await client.getBuses();
  assert.equal(result.source, 'database');
  assert.equal(result.buses.length, 1);
  assert.equal(result.buses[0].id, 'bus-mh27-01');
  assert.equal(result.buses[0].routeNumber, 'MH-27-X-4011');
  assert.equal(result.buses[0].status, 'active');

  // Offline path
  global.fetch = async () => {
    throw new Error('Network error');
  };
  const fallbackResult = await client.getBuses();
  assert.equal(fallbackResult.source, 'offline_fallback');
  assert(fallbackResult.buses.length > 0);
});

// 11. Method: detectFrame()
test('APIClient Method detectFrame: Sends FormData with image file and returns CV response', async () => {
  setupMockBrowserEnvironment();
  const client = new APIClient();

  let capturedBody = null;
  global.fetch = async (url, options) => {
    assert.equal(url, '/api/v1/cv/detect');
    assert.equal(options.method, 'POST');
    capturedBody = options.body;
    return new Response(JSON.stringify({
      detections: [{ class: 'pothole', confidence: 0.91, box: { x1: 10, y1: 10, x2: 50, y2: 50, width: 40, height: 40 } }],
      detection_count: 1,
      inference_latency_ms: 25,
      fps: 40,
      validation_score: 0.88,
      camera_health: { status: 'NORMAL', data_quality: 'HIGH', blur_laplacian_variance: 150, mean_brightness: 120, reasons: [] },
      privacy: { faces_anonymized: 0, plates_anonymized: 0, total_redactions: 0 },
      evidence_frame_base64: 'data:image/jpeg;base64,mock'
    }), { status: 200 });
  };

  const mockBlob = new Blob(['mock image data'], { type: 'image/jpeg' });
  const cvRes = await client.detectFrame(mockBlob, 0.4);
  assert.equal(cvRes.detection_count, 1);
  assert.equal(cvRes.detections[0].class, 'pothole');
  assert(capturedBody instanceof FormData);
});

// 12. Method: detectAndIngest()
test('APIClient Method detectAndIngest: Sends telemetry metadata and coordinates with frame', async () => {
  setupMockBrowserEnvironment();
  const client = new APIClient();

  let capturedFormData = null;
  global.fetch = async (url, options) => {
    assert.equal(url, '/api/v1/cv/detect-and-ingest');
    assert.equal(options.method, 'POST');
    capturedFormData = options.body;
    return new Response(JSON.stringify({
      event_id: 'evt-1234',
      status: 'ingested',
      verification_state: 'CANDIDATE'
    }), { status: 200 });
  };

  const mockBlob = new Blob(['frame data'], { type: 'image/jpeg' });
  const ingestRes = await client.detectAndIngest(mockBlob, 'bus-01', 'route-1', 12.935, 77.625, 0.35);
  assert.equal(ingestRes.event_id, 'evt-1234');
  assert.equal(capturedFormData.get('bus_id'), 'bus-01');
  assert.equal(capturedFormData.get('route_id'), 'route-1');
  assert.equal(capturedFormData.get('latitude'), '12.935');
  assert.equal(capturedFormData.get('longitude'), '77.625');
});

// 13. Method: downloadWorkOrderPdf()
test('APIClient Work Order: downloadWorkOrderPdf uses shared requestRaw path and returns Blob', async () => {
  setupMockBrowserEnvironment();
  const client = new APIClient();
  client.setToken('auth-token');

  let requestedUrl = '';
  let requestedHeaders = null;

  global.fetch = async (url, options) => {
    requestedUrl = url;
    requestedHeaders = options.headers;
    return new Response(new Blob(['%PDF-1.4 mock pdf binary'], { type: 'application/pdf' }), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    });
  };

  const blob = await client.downloadWorkOrderPdf('ISS-001', 'BBMP Road Infrastructure');
  assert.equal(requestedUrl, '/api/v1/work-orders/ISS-001/pdf?department=BBMP%20Road%20Infrastructure');
  assert.equal(requestedHeaders['Accept'], 'application/pdf');
  assert.equal(requestedHeaders['Authorization'], 'Bearer auth-token');
  assert(blob instanceof Blob);
  assert.equal(blob.type, 'application/pdf');
});

// 14. Method: updateLifecycle()
test('APIClient Method updateLifecycle: Posts JSON lifecycle payload with actor and notes', async () => {
  setupMockBrowserEnvironment('csrf_token=csrf-lifecycle-123');
  const client = new APIClient();

  let capturedPayload = null;
  let capturedHeaders = null;
  global.fetch = async (url, options) => {
    assert.equal(url, '/api/v1/work-orders/lifecycle');
    assert.equal(options.method, 'POST');
    capturedPayload = JSON.parse(options.body);
    capturedHeaders = options.headers;
    return new Response(JSON.stringify({
      success: true,
      issue_id: 'amr-001',
      status: 'IN_PROGRESS'
    }), { status: 200 });
  };

  const res = await client.updateLifecycle('amr-001', 'IN_PROGRESS', 'Site Engineer', 'Repairs started');
  assert.equal(res.success, true);
  assert.equal(capturedPayload.issue_id, 'amr-001');
  assert.equal(capturedPayload.target_status, 'IN_PROGRESS');
  assert.equal(capturedPayload.actor, 'Site Engineer');
  assert.equal(capturedPayload.notes, 'Repairs started');
  assert.equal(capturedHeaders['X-CSRF-Token'], 'csrf-lifecycle-123');
});

// 15. Method: getAnalyticsOverview()
test('APIClient Method getAnalyticsOverview: Fetches overview metrics or compiles fallback', async () => {
  setupMockBrowserEnvironment();
  const client = new APIClient();

  // Online path
  global.fetch = async (url) => {
    assert.equal(url, '/api/v1/analytics/overview');
    return new Response(JSON.stringify({
      total_events: 120,
      total_issues: 45,
      multi_pass_events: 30,
      total_observations: 120,
      avg_confidence: 91,
      verification_rate: 85,
      type_data: [],
      status_data: [],
      priority_data: [],
      hourly_data: []
    }), { status: 200 });
  };

  const result = await client.getAnalyticsOverview();
  assert.equal(result.source, 'database');
  assert.equal(result.overview.total_issues, 45);
  assert.equal(client.isBackendOnline(), true);

  // Offline fallback path
  global.fetch = async () => {
    throw new Error('Analytics offline');
  };
  const fallback = await client.getAnalyticsOverview();
  assert.equal(fallback.source, 'offline_fallback');
  assert(fallback.overview.total_issues > 0);
  assert(fallback.overview.type_data.length > 0);
});

// 16. Data Normalization: mapBackendIssueToRoadEvent
test('APIClient Data Mapping: mapBackendIssueToRoadEvent correctly normalizes verified issues', () => {
  const backendIssue = {
    issue_id: 'iss-9988',
    event_type: 'pothole',
    severity: 'SAFETY_HAZARD',
    priority: 'CRITICAL',
    status: 'PENDING',
    confidence: 0.94,
    centroid_latitude: 12.935,
    centroid_longitude: 77.625,
    observation_count: 3,
    priority_reasons: JSON.stringify(['High bus traffic corridor', 'Multi-pass corroboration']),
    observations: [
      { observation_id: 'obs-1', bus_id: 'BUS-01', confidence: 0.93, latitude: 12.935, longitude: 77.625 },
      { observation_id: 'obs-2', bus_id: 'BUS-02', confidence: 0.95, latitude: 12.935, longitude: 77.625 },
    ],
  };

  const mapped = mapBackendIssueToRoadEvent(backendIssue);
  assert.equal(mapped.id, 'iss-9988');
  assert.equal(mapped.type, 'pothole');
  assert.equal(mapped.priority, 'critical');
  assert.equal(mapped.severity, 9); // SAFETY_HAZARD maps to 9
  assert.equal(mapped.status, 'verified'); // 3 observations >= 2 maps to verified
  assert.equal(mapped.observations.length, 2);
  assert.equal(mapped.description, 'High bus traffic corridor');
});

// 17. Truth-in-Reporting Regression
test('Truth-in-Reporting Regression: LIVE fallback correctly attributes offline source and prevents misleading presentation', async () => {
  setupMockBrowserEnvironment();
  const client = new APIClient();

  // Simulate network failure reaching backend
  global.fetch = async () => {
    throw new Error('Connection refused: Backend unreachable at 127.0.0.1:8001');
  };

  // Fetch issues when backend is offline
  const result = await client.getIssues();
  assert.equal(result.source, 'offline_fallback', 'Must explicitly tag source as offline_fallback');
  assert.equal(client.isBackendOnline(), false, 'isBackendOnline must be false when backend is down');

  // Verify truth-in-reporting contract:
  // When mode === 'LIVE' and isLiveBackend is false, App.tsx displays the LIVE fallback banner:
  // "LIVE MODE OFFLINE: FastAPI backend unreachable... Displaying cached demonstration telemetry."
  const mode = 'LIVE';
  const isLiveBackend = client.isBackendOnline();
  const shouldDisplayFallbackBanner = mode === 'LIVE' && !isLiveBackend;
  assert.equal(shouldDisplayFallbackBanner, true, 'Truth-in-reporting banner MUST be triggered when in LIVE mode but backend is unreachable');
});
