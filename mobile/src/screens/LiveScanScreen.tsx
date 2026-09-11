import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { MobileAPI } from '../services/api';
import { OfflineQueue } from '../services/offlineQueue';
import { CVDetectionResponse } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIEWFINDER_WIDTH = SCREEN_WIDTH - 32;
const VIEWFINDER_HEIGHT = 260;

interface Props {
  busId: string;
  routeId: string;
  cameraId: string;
  onNavigateToHistory: () => void;
}

export const LiveScanScreen: React.FC<Props> = ({
  busId,
  routeId,
  cameraId,
  onNavigateToHistory,
}) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<CVDetectionResponse | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);
  const [cameraHealth, setCameraHealth] = useState<string>('NORMAL');
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [wsNotification, setWsNotification] = useState<string>('');

  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number }>({
    lat: 12.9352,
    lng: 77.6245,
    accuracy: 2.5,
  });
  const [statusMessage, setStatusMessage] = useState<string>('Dashcam Standby');

  const cameraRef = useRef<CameraView>(null);
  const scanIntervalRef = useRef<any>(null);
  const isProcessingRef = useRef<boolean>(false);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  // Mutable refs to prevent React stale closure bugs inside interval ticks
  const coordsRef = useRef(coords);
  const busIdRef = useRef(busId);
  const routeIdRef = useRef(routeId);
  const cameraIdRef = useRef(cameraId);
  const isScanningRef = useRef(isScanning);

  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  useEffect(() => {
    busIdRef.current = busId;
    routeIdRef.current = routeId;
    cameraIdRef.current = cameraId;
  }, [busId, routeId, cameraId]);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  // Initialize GPS Location tracking via expo-location
  useEffect(() => {
    let mounted = true;

    async function initLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (mounted) {
            setLocationPermission(false);
            setStatusMessage('GPS Permission Denied: Operating with last fix');
          }
          return;
        }

        if (mounted) setLocationPermission(true);

        // Fetch initial high-accuracy GPS fix
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (mounted && initialLoc?.coords) {
          const fresh = {
            lat: initialLoc.coords.latitude,
            lng: initialLoc.coords.longitude,
            accuracy: initialLoc.coords.accuracy ?? 3.0,
          };
          coordsRef.current = fresh;
          setCoords(fresh);
        }

        // Start continuous GPS tracking along transit corridor
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 2,
          },
          (newLoc) => {
            if (mounted && newLoc?.coords) {
              const fresh = {
                lat: newLoc.coords.latitude,
                lng: newLoc.coords.longitude,
                accuracy: newLoc.coords.accuracy ?? 2.5,
              };
              coordsRef.current = fresh;
              setCoords(fresh);
            }
          }
        );

        locationSubRef.current = sub;
      } catch (err) {
        console.warn('Location initialization error:', err);
      }
    }

    initLocation();

    return () => {
      mounted = false;
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
    };
  }, []);

  // Update pending queue badge from SQLite
  useEffect(() => {
    const updateCount = () => setPendingQueueCount(OfflineQueue.getPendingCount());
    updateCount();
    const timer = setInterval(updateCount, 2000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to live WebSocket feed for this route corridor
  useEffect(() => {
    const unsubscribe = MobileAPI.subscribeLiveFeed(
      {
        onOpen: () => setWsConnected(true),
        onClose: () => setWsConnected(false),
        onError: () => setWsConnected(false),
        onMessage: (msg: any) => {
          if (msg.type === 'issue_update') {
            const issueId = msg.issue?.issue_id || msg.event_id || 'new';
            setWsNotification(`📡 Live Corridor Alert: Issue ${issueId} verified`);
            setTimeout(() => setWsNotification(''), 4000);
          }
        },
      },
      routeId
    );

    return () => {
      unsubscribe();
    };
  }, [routeId]);

  // Genuine camera capture and edge inference pipeline
  const processEdgeFrame = async () => {
    // Prevent overlapping capture ticks if inference/network takes longer than 1s
    if (isProcessingRef.current) {
      return;
    }
    isProcessingRef.current = true;

    const startTime = Date.now();
    let frameUri: string | null = null;
    const currentGps = coordsRef.current;
    const currentBus = busIdRef.current;
    const currentRoute = routeIdRef.current;
    const currentCam = cameraIdRef.current;

    try {
      if (!cameraPermission?.granted) {
        setStatusMessage('Camera access required. Please enable camera.');
        return;
      }

      // Capture genuine photo from phone camera
      if (cameraRef.current) {
        try {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.7,
            shutterSound: false,
          });

          if (photo?.uri) {
            // Resize to 640px JPEG at 1 FPS interval for real-time edge processing
            try {
              const resized = await manipulateAsync(
                photo.uri,
                [{ resize: { width: 640 } }],
                { compress: 0.7, format: SaveFormat.JPEG, base64: true }
              );
              frameUri = resized.uri;
            } catch (manipErr) {
              console.warn('Resize fallback to raw photo:', manipErr);
              frameUri = photo.uri;
            }
          }
        } catch (captureErr) {
          console.warn('Camera capture error:', captureErr);
        }
      }

      if (!frameUri) {
        setStatusMessage('Waiting for camera sensor frame...');
        return;
      }

      const result = await MobileAPI.detectAndIngest({
        imageUri: frameUri,
        busId: currentBus,
        routeId: currentRoute,
        cameraId: currentCam,
        latitude: currentGps.lat,
        longitude: currentGps.lng,
      });

      const elapsed = Date.now() - startTime;
      setLatencyMs(result.cv_performance?.latency_ms || elapsed);
      setFps(result.cv_performance?.fps || Math.round(1000 / Math.max(elapsed, 1)));
      setCameraHealth(result.cv_performance?.camera_health || 'NORMAL');
      setLastResult(result);

      if (result.detections && result.detections.length > 0) {
        setStatusMessage(`🚨 Detected ${result.detections.length} defect(s): ${result.event_type}`);
      } else {
        setStatusMessage('Clear corridor — no defects detected');
      }
    } catch (err: any) {
      // Network drop or edge disconnect: persist into durable SQLite offline queue
      if (frameUri) {
        OfflineQueue.enqueue({
          busId: currentBus,
          routeId: currentRoute,
          cameraId: currentCam,
          latitude: currentGps.lat,
          longitude: currentGps.lng,
          gpsAccuracy: currentGps.accuracy,
          timestamp: new Date().toISOString(),
          frameBase64: frameUri,
        });
        setPendingQueueCount(OfflineQueue.getPendingCount());
        setStatusMessage(`Network dropped: Saved to SQLite queue (${err?.message || 'offline'})`);
      } else {
        setStatusMessage(`Edge error: ${err?.message || 'Scan failed'}`);
      }
    } finally {
      isProcessingRef.current = false;
    }
  };

  const toggleScanning = async () => {
    if (isScanning) {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      setIsScanning(false);
      setStatusMessage('Dashcam Paused');
    } else {
      if (!cameraPermission?.granted) {
        const perm = await requestCameraPermission();
        if (!perm.granted) {
          setStatusMessage('Camera permission denied. Cannot start dashcam scan.');
          return;
        }
      }
      setIsScanning(true);
      setStatusMessage('Dashcam Active: 1 FPS Scanning (640px JPEG)');
      processEdgeFrame();
      scanIntervalRef.current = setInterval(processEdgeFrame, 1000);
    }
  };

  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Viewfinder Header Badges */}
      <View style={styles.headerBar}>
        <View style={styles.badgeGroup}>
          <View style={[styles.badge, { backgroundColor: isScanning ? '#059669' : '#475569' }]}>
            <Text style={styles.badgeText}>{isScanning ? 'LIVE 1s' : 'STANDBY'}</Text>
          </View>
          <View
            style={[
              styles.badge,
              { backgroundColor: cameraHealth === 'NORMAL' ? '#0284c7' : '#d97706' },
            ]}
          >
            <Text style={styles.badgeText}>CAM: {cameraHealth}</Text>
          </View>
          <View
            style={[
              styles.badge,
              { backgroundColor: wsConnected ? '#10b981' : '#64748b' },
            ]}
          >
            <Text style={styles.badgeText}>{wsConnected ? 'WS LIVE' : 'WS OFF'}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.queueBadge} onPress={onNavigateToHistory}>
          <Text style={styles.queueBadgeText}>📦 SQLite: {pendingQueueCount}</Text>
        </TouchableOpacity>
      </View>

      {/* Dashcam Viewfinder */}
      <View style={styles.viewfinder}>
        {cameraPermission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
          />
        ) : (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionTitle}>Camera Access Needed</Text>
            <Text style={styles.permissionSubtitle}>
              Live scanning requires camera feed to detect road defects.
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestCameraPermission}
            >
              <Text style={styles.permissionButtonText}>ENABLE CAMERA</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Viewfinder HUD Overlay */}
        <View style={styles.viewfinderOverlay} pointerEvents="none">
          {/* HUD Crosshairs */}
          <View style={styles.crosshair} />

          {/* Detection Bounding Boxes Overlay */}
          {lastResult?.detections?.map((det, idx) => {
            const left = (det.box.x1 / 640) * VIEWFINDER_WIDTH;
            const top = (det.box.y1 / 480) * VIEWFINDER_HEIGHT;
            const width = Math.max(
              36,
              ((det.box.x2 - det.box.x1) / 640) * VIEWFINDER_WIDTH
            );
            const height = Math.max(
              24,
              ((det.box.y2 - det.box.y1) / 480) * VIEWFINDER_HEIGHT
            );

            const isPothole = det.class.toLowerCase().includes('pothole');
            const boxColor = isPothole ? '#f43f5e' : '#f59e0b';

            return (
              <View
                key={idx}
                style={[
                  styles.boundingBox,
                  {
                    left,
                    top,
                    width,
                    height,
                    borderColor: boxColor,
                    backgroundColor: isPothole
                      ? 'rgba(244, 63, 94, 0.2)'
                      : 'rgba(245, 158, 11, 0.2)',
                  },
                ]}
              >
                <Text style={[styles.boxLabel, { backgroundColor: boxColor }]}>
                  {det.class} {(det.confidence * 100).toFixed(0)}%
                </Text>
              </View>
            );
          })}

          {/* Telemetry HUD */}
          <View style={styles.hudOverlay}>
            <Text style={styles.hudText}>
              GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} (±{coords.accuracy.toFixed(1)}m)
              {locationPermission ? ' [HARDWARE]' : ' [CORRIDOR]'}
            </Text>
            <Text style={styles.hudText}>
              BUS: {busId} | RT: {routeId} | {fps.toFixed(0)} FPS ({latencyMs.toFixed(0)}ms)
            </Text>
          </View>
        </View>
      </View>

      {/* WebSocket Live Notification Banner */}
      {wsNotification ? (
        <View style={styles.wsNotificationBanner}>
          <Text style={styles.wsNotificationText}>{wsNotification}</Text>
        </View>
      ) : null}

      {/* Status Banner */}
      <View style={styles.statusBanner}>
        <Text style={styles.statusText}>{statusMessage}</Text>
      </View>

      {/* Scan Control Buttons */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: isScanning ? '#dc2626' : '#0891b2' },
          ]}
          onPress={toggleScanning}
        >
          <Text style={styles.actionButtonText}>
            {isScanning ? 'STOP EDGE DASHCAM' : 'START CONTINUOUS SCAN'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={processEdgeFrame}>
          <Text style={styles.secondaryButtonText}>CAPTURE SINGLE FRAME</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1d',
    padding: 16,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  queueBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  queueBadgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  viewfinder: {
    width: '100%',
    height: VIEWFINDER_HEIGHT,
    backgroundColor: '#030712',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
    position: 'relative',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0f172a',
  },
  permissionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  permissionSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
  },
  permissionButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewfinderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  crosshair: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 24,
    height: 24,
    marginLeft: -12,
    marginTop: -12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: 12,
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
  },
  boxLabel: {
    position: 'absolute',
    top: -16,
    left: -2,
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  hudOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 6,
    borderRadius: 6,
  },
  hudText: {
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  wsNotificationBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
    borderWidth: 1,
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  wsNotificationText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '600',
  },
  statusBanner: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  statusText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '500',
  },
  controls: {
    marginTop: 14,
    gap: 10,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 4,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
});
