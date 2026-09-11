import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { OfflineQueue } from '../services/offlineQueue';
import { QueuedEvent } from '../types';

export const HistoryScreen: React.FC = () => {
  const [items, setItems] = useState<QueuedEvent[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [lastFailedCount, setLastFailedCount] = useState<number>(0);
  const [permissionError, setPermissionError] = useState<string>('');
  const [networkError, setNetworkError] = useState<string>('');

  const loadData = () => {
    try {
      const q = OfflineQueue.getQueue();
      setItems(q);
      const failedCount = q.filter((i) => i.status === 'FAILED').length;
      setLastFailedCount(failedCount);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleReplayAll = async () => {
    setIsSyncing(true);
    setPermissionError('');
    setNetworkError('');
    setSyncStatus('Flushing offline queue to backend...');
    try {
      const result = await OfflineQueue.replayAll((synced, total) => {
        setSyncStatus(`Syncing: ${synced}/${total} items ingested`);
      });
      setLastFailedCount(result.failed);
      setSyncStatus(`Sync finished: ${result.synced} uploaded, ${result.failed} failed`);
      if (result.failed > 0) {
        // Inspect if any failed with 401/403
        const queueItems = OfflineQueue.getQueue();
        const authFailed = queueItems.some((i) =>
          (i.errorMessage || '').toLowerCase().includes('401') ||
          (i.errorMessage || '').toLowerCase().includes('403') ||
          (i.errorMessage || '').toLowerCase().includes('unauthorized') ||
          (i.errorMessage || '').toLowerCase().includes('forbidden')
        );
        if (authFailed) {
          setPermissionError('Permission Denied: Session expired or unauthorized for event ingestion.');
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Replay failed';
      if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('unreachable') || msg.toLowerCase().includes('fetch')) {
        setNetworkError('Network Offline: Backend unreachable. Observations preserved in SQLite queue.');
      } else {
        setSyncStatus(`Sync error: ${msg}`);
      }
    } finally {
      setIsSyncing(false);
      loadData();
    }
  };

  const handleClearSynced = () => {
    OfflineQueue.clearSynced();
    loadData();
  };

  const pendingCount = items.filter(i => i.status === 'PENDING').length;
  const failedCount = items.filter(i => i.status === 'FAILED').length;
  const isQueueFull = OfflineQueue.isQueueFull();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scanned Telemetry Queue</Text>
        <Text style={styles.subtitle}>
          {items.length} observations ({pendingCount} pending, {failedCount} failed)
        </Text>
      </View>

      {/* Queue Full Alert Banner */}
      {isQueueFull && (
        <View style={styles.queueFullBanner}>
          <Text style={styles.queueFullBannerText}>
            ⚠️ SQLite Queue Full (500/500) — Storage ceiling reached. Tap SYNC PENDING QUEUE to upload evidence and resume capture.
          </Text>
        </View>
      )}

      {/* Permission Denied Banner */}
      {Boolean(permissionError) && (
        <View style={styles.permissionBanner}>
          <Text style={styles.permissionBannerText}>🚫 {permissionError}</Text>
        </View>
      )}

      {/* Network Offline Banner */}
      {Boolean(networkError) && (
        <View style={styles.networkBanner}>
          <Text style={styles.networkBannerText}>📡 {networkError}</Text>
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.syncButton, (isSyncing || (pendingCount === 0 && failedCount === 0)) && { opacity: 0.6 }]}
          onPress={handleReplayAll}
          disabled={isSyncing || (pendingCount === 0 && failedCount === 0)}
        >
          {isSyncing ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.syncButtonText}>SYNCING QUEUE...</Text>
            </View>
          ) : (
            <Text style={styles.syncButtonText}>
              {failedCount > 0 ? `SYNC QUEUE & RETRY (${pendingCount + failedCount})` : 'SYNC PENDING QUEUE'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.clearButton} onPress={handleClearSynced}>
          <Text style={styles.clearButtonText}>CLEAR SYNCED</Text>
        </TouchableOpacity>
      </View>

      {/* Intentional Retry Button when failures occur */}
      {failedCount > 0 && !isSyncing && (
        <TouchableOpacity style={styles.retryButton} onPress={handleReplayAll}>
          <Text style={styles.retryButtonText}>🔄 RETRY {failedCount} FAILED ITEM(S)</Text>
        </TouchableOpacity>
      )}

      {syncStatus ? <Text style={styles.statusText}>{syncStatus}</Text> : null}

      {/* Intentional Initial Loading State */}
      {isLoadingQueue ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#0284c7" size="large" />
          <Text style={styles.loadingText}>Reading durable SQLite offline queue...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardId}>{item.id}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        item.status === 'SYNCED'
                          ? '#059669'
                          : item.status === 'PENDING'
                          ? '#d97706'
                          : '#dc2626',
                    },
                  ]}
                >
                  <Text style={styles.statusBadgeText}>{item.status}</Text>
                </View>
              </View>

              <Text style={styles.cardDetail}>
                📍 GPS: {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
              </Text>
              <Text style={styles.cardDetail}>
                🚌 Bus: {item.busId} | Route: {item.routeId}
              </Text>
              {item.errorMessage ? (
                <Text style={styles.cardError}>⚠️ Error: {item.errorMessage}</Text>
              ) : null}
              <Text style={styles.cardTime}>
                ⏱ {new Date(item.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No scanned events in queue</Text>
              <Text style={styles.emptySubtext}>
                Start a scan on the dashcam tab to begin collecting edge observations
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1d',
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  queueFullBanner: {
    backgroundColor: '#450a0a',
    borderColor: '#f43f5e',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueFullBannerText: {
    color: '#ffe4e6',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  permissionBanner: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: '#eab308',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  permissionBannerText: {
    color: '#fef9c3',
    fontSize: 11,
    fontWeight: 'bold',
  },
  networkBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  networkBannerText: {
    color: '#fecaca',
    fontSize: 11,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  syncButton: {
    flex: 2,
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#f97316',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    minHeight: 44,
    minWidth: 44,
  },
  retryButtonText: {
    color: '#f97316',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 44,
    minWidth: 44,
  },
  clearButtonText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    color: '#38bdf8',
    fontSize: 11,
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardId: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardDetail: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  cardError: {
    color: '#f87171',
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  cardTime: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
    padding: 20,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
