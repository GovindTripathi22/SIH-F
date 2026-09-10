import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MobileAPI } from '../services/api';
import { OfflineQueue } from '../services/offlineQueue';
import { CVDetectionResponse } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<CVDetectionResponse | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [fps, setFps] = useState<number>(0);
  const [cameraHealth, setCameraHealth] = useState<string>('NORMAL');
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number }>({
    lat: 12.9352,
    lng: 77.6245,
    accuracy: 2.4,
  });
  const [statusMessage, setStatusMessage] = useState<string>('Dashcam Standby');

  const scanIntervalRef = useRef<any>(null);

  // Update pending queue badge
  useEffect(() => {
    const updateCount = () => setPendingQueueCount(OfflineQueue.getPendingCount());
    updateCount();
    const timer = setInterval(updateCount, 2000);
    return () => clearInterval(timer);
  }, []);

  // Frame simulation and edge ingest trigger
  const processEdgeFrame = async () => {
    // Advance simulated GPS slightly along transit corridor
    setCoords(prev => ({
      lat: prev.lat + (Math.random() - 0.48) * 0.0003,
      lng: prev.lng + (Math.random() - 0.48) * 0.0003,
      accuracy: 2.0 + Math.random() * 0.8,
    }));

    const startTime = Date.now();
    try {
      // 1x1 test pixel base64 jpeg for lightweight edge pipeline ping
      const dummyJpegUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

      const result = await MobileAPI.detectAndIngest({
        imageUri: dummyJpegUri,
        busId,
        routeId,
        cameraId,
        latitude: coords.lat,
        longitude: coords.lng,
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
      // Connection lost or slow: save into offline queue
      OfflineQueue.enqueue({
        busId,
        routeId,
        cameraId,
        latitude: coords.lat,
        longitude: coords.lng,
        gpsAccuracy: coords.accuracy,
        timestamp: new Date().toISOString(),
        frameBase64: 'cached_frame_placeholder',
      });
      setPendingQueueCount(OfflineQueue.getPendingCount());
      setStatusMessage('Network unavailable: Saved to offline queue');
    }
  };

  const toggleScanning = () => {
    if (isScanning) {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      setIsScanning(false);
      setStatusMessage('Dashcam Paused');
    } else {
      setIsScanning(true);
      setStatusMessage('Dashcam Active: 1 FPS Scanning');
      processEdgeFrame();
      scanIntervalRef.current = setInterval(processEdgeFrame, 1000);
    }
  };

  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
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
          <View style={[styles.badge, { backgroundColor: cameraHealth === 'NORMAL' ? '#0284c7' : '#d97706' }]}>
            <Text style={styles.badgeText}>CAM: {cameraHealth}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.queueBadge} onPress={onNavigateToHistory}>
          <Text style={styles.queueBadgeText}>📦 Queue: {pendingQueueCount}</Text>
        </TouchableOpacity>
      </View>

      {/* Dashcam Viewfinder */}
      <View style={styles.viewfinder}>
        <View style={styles.viewfinderOverlay}>
          {/* Simulated HUD Crosshairs */}
          <View style={styles.crosshair} />
          
          {/* Detection Bounding Boxes Overlay */}
          {lastResult?.detections?.map((det, idx) => (
            <View
              key={idx}
              style={[
                styles.boundingBox,
                {
                  left: (det.box.x1 / 640) * (SCREEN_WIDTH - 32),
                  top: (det.box.y1 / 480) * 240,
                  width: Math.max(40, ((det.box.x2 - det.box.x1) / 640) * (SCREEN_WIDTH - 32)),
                  height: Math.max(30, ((det.box.y2 - det.box.y1) / 480) * 240),
                },
              ]}
            >
              <Text style={styles.boxLabel}>
                {det.class} {(det.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          ))}

          {/* Telemetry HUD */}
          <View style={styles.hudOverlay}>
            <Text style={styles.hudText}>
              GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} (±{coords.accuracy.toFixed(1)}m)
            </Text>
            <Text style={styles.hudText}>
              BUS: {busId} | RT: {routeId} | {fps.toFixed(0)} FPS ({latencyMs.toFixed(0)}ms)
            </Text>
          </View>
        </View>
      </View>

      {/* Status Banner */}
      <View style={styles.statusBanner}>
        <Text style={styles.statusText}>{statusMessage}</Text>
      </View>

      {/* Scan Control Button */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: isScanning ? '#dc2626' : '#0891b2' }]}
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
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  queueBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  queueBadgeText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  viewfinder: {
    width: '100%',
    height: 260,
    backgroundColor: '#030712',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
    position: 'relative',
  },
  viewfinderOverlay: {
    flex: 1,
    position: 'relative',
  },
  crosshair: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 20,
    height: 20,
    marginLeft: -10,
    marginTop: -10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: 10,
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#f43f5e',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderRadius: 4,
  },
  boxLabel: {
    position: 'absolute',
    top: -16,
    left: -2,
    backgroundColor: '#f43f5e',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  hudOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    padding: 6,
    borderRadius: 6,
  },
  hudText: {
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  statusBanner: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
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
    marginTop: 16,
    gap: 10,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#0891b2',
    shadowOpacity: 0.3,
    shadowRadius: 5,
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
