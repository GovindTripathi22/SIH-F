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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');

  const loadData = () => {
    setItems(OfflineQueue.getQueue());
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleReplayAll = async () => {
    setIsSyncing(true);
    setSyncStatus('Flushing offline queue to backend...');
    const result = await OfflineQueue.replayAll((synced, total) => {
      setSyncStatus(`Syncing: ${synced}/${total} items ingested`);
    });
    setIsSyncing(false);
    setSyncStatus(`Sync finished: ${result.synced} uploaded, ${result.failed} failed`);
    loadData();
  };

  const handleClearSynced = () => {
    OfflineQueue.clearSynced();
    loadData();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scanned Telemetry Queue</Text>
        <Text style={styles.subtitle}>
          {items.length} observations ({items.filter(i => i.status === 'PENDING').length} pending)
        </Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.syncButton, isSyncing && { opacity: 0.6 }]}
          onPress={handleReplayAll}
          disabled={isSyncing || items.filter(i => i.status === 'PENDING').length === 0}
        >
          {isSyncing ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.syncButtonText}>SYNC PENDING QUEUE</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.clearButton} onPress={handleClearSynced}>
          <Text style={styles.clearButtonText}>CLEAR SYNCED</Text>
        </TouchableOpacity>
      </View>

      {syncStatus ? <Text style={styles.statusText}>{syncStatus}</Text> : null}

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
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  syncButton: {
    flex: 2,
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  clearButtonText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  statusText: {
    color: '#38bdf8',
    fontSize: 11,
    marginBottom: 10,
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
