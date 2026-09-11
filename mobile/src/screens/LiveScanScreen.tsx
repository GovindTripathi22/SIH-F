import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  Animated,
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
  const [achievedFps, setAchievedFps] = useState<number>(1.0);
  const [captureIntervalMs, setCaptureIntervalMs] = useState<number>(1000);
  const [rollingLatencyMs, setRollingLatencyMs] = useState<number>(0);
  const [cameraHealth, setCameraHealth] = useState<string>('NORMAL');
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [isQueueFull, setIsQueueFull] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [wsNotification, setWsNotification] = useState<string>('');

  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number }>({
    lat: 12.9385,
    lng: 77.6280,
    accuracy: 2.5,
  });

  const [statusMessage, setStatusMessage] = useState<string>('Dashcam Standby');

  const cameraRef = useRef<CameraView>(null);
  const scanTimerRef = useRef<any>(null);
  const isProcessingRef = useRef<boolean>(false);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  // Capture pacing hysteresis state
  const latencyBufferRef = useRef<number[]>([]);
  const slowStreakRef = useRef<number>(0);
  const fastStreakRef = useRef<number>(0);
  const activeIntervalRef = useRef<number>(1000);
  const lastCaptureTimeRef = useRef<number>(Date.now());

  // iOS non-audio viewfinder flash animation
  const flashAnim = useRef(new Animated.Value(0)).current;

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

  // Initial pending queue sync check
  useEffect(() => {
    const count = OfflineQueue.getPendingCount();
    setPendingQueueCount(count);
    setIsQueueFull(OfflineQueue.isQueueFull());
  }, []);

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
          setCoords({
            lat: initialLoc.coords.latitude,
            lng: initialLoc.coords.longitude,
            accuracy: initialLoc.coords.accuracy || 2.5,
          });
        }

        // Subscribe to ongoing GPS stream with 2-meter threshold
        locationSubRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 2,
            timeInterval: 1000,
          },
          (loc) => {
            if (mounted && loc?.coords) {
              setCoords({
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
                accuracy: loc.coords.accuracy || 2.5,
              });
            }
          }
        );
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

  // Subscribe to backend WebSocket live feed
  useEffect(() => {
    let mounted = true;

    const unsubscribe = MobileAPI.subscribeLiveFeed({
      onOpen: () => {
        if (mounted) setWsConnected(true);
      },
      onClose: () => {
        if (mounted) setWsConnected(false);
      },
      onError: () => {
        if (mounted) setWsConnected(false);
      },
      onMessage: (msg: any) => {
        if (!mounted) return;
        if (msg.type === 'corridor_alert' || msg.type === 'verified_issue') {
          setWsNotification(`📡 Corridor broadcast: ${msg.event_type || 'Road hazard'} verified`);
          setTimeout(() => {
            if (mounted) setWsNotification('');
          }, 4000);
        }
      },
    }, routeId);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [routeId]);

  const triggerViewfinderFlash = () => {
    if (Platform.OS === 'ios') {
      flashAnim.setValue(0.7);
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  };

  // Edge Frame Capture and Inference Loop with Hysteresis Pacing
  const processEdgeFrame = async () => {
    if (isProcessingRef.current) return;

    // Check if offline queue is full
    const currentPending = OfflineQueue.getPendingCount();
    setPendingQueueCount(currentPending);
    const queueFull = OfflineQueue.isQueueFull();
    setIsQueueFull(queueFull);
    if (queueFull) {
      setStatusMessage('⚠️ SQLite Queue Full (500/500) — Capturing paused until synced');
      // Timeout-chained scheduling: continue polling so capturing automatically resumes when replay creates capacity
      if (isScanningRef.current) {
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        scanTimerRef.current = setTimeout(() => {
          processEdgeFrame();
        }, activeIntervalRef.current);
      }
      return;
    }

    isProcessingRef.current = true;
    const startTime = Date.now();
    let frameUri: string | null = null;

    const currentBus = busIdRef.current;
    const currentRoute = routeIdRef.current;
    const currentCam = cameraIdRef.current;
    const currentGps = coordsRef.current;

    try {
      if (cameraRef.current) {
        try {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.7,
            shutterSound: false,
          });

          // Trigger iOS non-audio visual flash
          triggerViewfinderFlash();

          if (photo?.uri) {
            // Resize to 640px JPEG for edge processing
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
      const now = Date.now();
      const intervalSinceLast = Math.max(1, now - lastCaptureTimeRef.current);
      lastCaptureTimeRef.current = now;
      const instantFps = Math.min(2.0, Number((1000 / intervalSinceLast).toFixed(1)));
      setAchievedFps(instantFps);

      setLatencyMs(result.cv_performance?.latency_ms || elapsed);
      setFps(result.cv_performance?.fps || Math.round(1000 / Math.max(elapsed, 1)));
      setCameraHealth(result.cv_performance?.camera_health || 'NORMAL');
      setLastResult(result);

      // Pacing hysteresis: maintain 5-frame rolling latency average
      // 5 consecutive slow frames (> 1000ms) back off to 1.5s
      // 10 consecutive fast frames (<= 1000ms) return to 1.0s
      latencyBufferRef.current.push(elapsed);
      if (latencyBufferRef.current.length > 5) latencyBufferRef.current.shift();
      const rollingAvg = Math.round(
        latencyBufferRef.current.reduce((sum, val) => sum + val, 0) / latencyBufferRef.current.length
      );
      setRollingLatencyMs(rollingAvg);

      if (elapsed > 1000) {
        slowStreakRef.current += 1;
        fastStreakRef.current = 0;
        if (slowStreakRef.current >= 5 && activeIntervalRef.current === 1000) {
          activeIntervalRef.current = 1500;
          setCaptureIntervalMs(1500);
        }
      } else {
        fastStreakRef.current += 1;
        slowStreakRef.current = 0;
        if (fastStreakRef.current >= 10 && activeIntervalRef.current === 1500) {
          activeIntervalRef.current = 1000;
          setCaptureIntervalMs(1000);
        }
      }

      if (result.detections && result.detections.length > 0) {
        setStatusMessage(`🚨 Detected ${result.detections.length} defect(s): ${result.event_type}`);
      } else {
        setStatusMessage('Clear corridor — no defects detected');
      }
    } catch (err: any) {
      // Network drop or edge disconnect: persist into durable SQLite offline queue
      if (frameUri) {
        try {
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
          const newPending = OfflineQueue.getPendingCount();
          setPendingQueueCount(newPending);
          setIsQueueFull(OfflineQueue.isQueueFull());
          setStatusMessage(`Network dropped: Saved to SQLite queue (${err?.message || 'offline'})`);
        } catch (queueErr: any) {
          setIsQueueFull(true);
          setStatusMessage(`Offline Queue Full: ${queueErr.message}`);
        }
      } else {
        setStatusMessage(`Edge error: ${err?.message || 'Scan failed'}`);
      }
    } finally {
      isProcessingRef.current = false;
      // Timeout-chained scheduling: guarantees zero overlapping captures
      if (isScanningRef.current) {
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        scanTimerRef.current = setTimeout(() => {
          processEdgeFrame();
        }, activeIntervalRef.current);
      }
    }
  };

  const toggleScanning = async () => {
    if (isScanning) {
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
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
      setStatusMessage(`Dashcam Active: ${(1000 / activeIntervalRef.current).toFixed(1)} FPS Scanning`);
      processEdgeFrame();
    }
  };

  useEffect(() => {
    return () => {
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Viewfinder Header Badges */}
      <View style={styles.headerBar}>
        <View style={styles.badgeGroup}>
          <View style={[styles.badge, { backgroundColor: isScanning ? '#059669' : '#475569' }]}>
            <Text style={styles.badgeText}>
              {isScanning ? `${achievedFps.toFixed(1)} FPS (${(captureIntervalMs / 1000).toFixed(1)}s • ${rollingLatencyMs}ms avg)` : 'STANDBY'}
            </Text>
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

      {/* Queue Full Warning Banner */}
      {isQueueFull && (
        <TouchableOpacity style={styles.queueFullBanner} onPress={onNavigateToHistory}>
          <Text style={styles.queueFullBannerText}>
            ⚠️ SQLite Queue Full (500/500) — Capturing paused until queue is synced
          </Text>
        </TouchableOpacity>
      )}

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

        {/* Top and Bottom Gradient Scrims for High-Contrast Visibility */}
        <View style={styles.topScrim} pointerEvents="none" />
        <View style={styles.bottomScrim} pointerEvents="none" />

        {/* iOS Non-Audio Viewfinder Flash Overlay */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: '#ffffff', opacity: flashAnim },
          ]}
          pointerEvents="none"
        />

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
            const isCrack = det.class.toLowerCase().includes('crack');
            const boxColor = isPothole ? '#f43f5e' : (isCrack ? '#f97316' : '#06b6d4');

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
                      ? 'rgba(244, 63, 94, 0.22)'
                      : 'rgba(249, 115, 22, 0.22)',
                  },
                ]}
              >
                <View style={[styles.boxLabelContainer, { backgroundColor: boxColor }]}>
                  <Text style={styles.boxLabelText}>
                    {det.class.toUpperCase()} {(det.confidence * 100).toFixed(0)}%
                  </Text>
                </View>
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
              BUS: {busId} | RT: {routeId} | Achieved: {achievedFps.toFixed(1)} FPS ({latencyMs.toFixed(0)}ms)
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
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 28,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  queueBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueBadgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  queueFullBanner: {
    backgroundColor: '#450a0a',
    borderColor: '#f43f5e',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueFullBannerText: {
    color: '#ffe4e6',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  viewfinder: {
    width: VIEWFINDER_WIDTH,
    height: VIEWFINDER_HEIGHT,
    backgroundColor: '#000000',
    borderRadius: 14,
    overflow: 'hidden',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    position: 'relative',
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: 'rgba(10, 15, 29, 0.75)',
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: 'rgba(10, 15, 29, 0.75)',
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
  boxLabelContainer: {
    position: 'absolute',
    top: -18,
    left: -2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#000000',
  },
  boxLabelText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  hudOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
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
    minHeight: 44,
    justifyContent: 'center',
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
    justifyContent: 'center',
    minHeight: 44,
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
    justifyContent: 'center',
    elevation: 4,
    minHeight: 48,
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
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 48,
  },
  secondaryButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
});
