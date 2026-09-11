/**
 * Persistent SQLite Offline Resilience Queue for Mobile Dashcam.
 * Ensures observations captured during cellular blind spots are durable and safely survive
 * app terminations, device reboots, and network dropouts.
 */

import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import { QueuedEvent } from '../types';
import { MobileAPI } from './api';

let dbInstance: SQLiteDatabase | null = null;
let isReplaying = false;

function getDatabase(): SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = openDatabaseSync('urbanpulse_edge_queue.db');
    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS queued_events (
        id TEXT PRIMARY KEY,
        busId TEXT NOT NULL,
        routeId TEXT NOT NULL,
        cameraId TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        gpsAccuracy REAL,
        timestamp TEXT NOT NULL,
        frameBase64 TEXT,
        status TEXT NOT NULL,
        retryCount INTEGER NOT NULL DEFAULT 0,
        errorMessage TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_queued_events_status ON queued_events(status);
    `);
  }
  return dbInstance;
}

export const OfflineQueue = {
  getQueue(): QueuedEvent[] {
    try {
      const db = getDatabase();
      const rows = db.getAllSync<any>(
        'SELECT * FROM queued_events ORDER BY timestamp DESC'
      );
      return rows.map((r) => ({
        id: r.id,
        busId: r.busId,
        routeId: r.routeId,
        cameraId: r.cameraId,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        gpsAccuracy: r.gpsAccuracy != null ? Number(r.gpsAccuracy) : 2.5,
        timestamp: r.timestamp,
        frameBase64: r.frameBase64 || undefined,
        status: r.status as 'PENDING' | 'SYNCED' | 'FAILED',
        retryCount: Number(r.retryCount || 0),
        errorMessage: r.errorMessage || undefined,
      }));
    } catch (err) {
      console.warn('Error reading offline queue from SQLite:', err);
      return [];
    }
  },

  getPendingCount(): number {
    try {
      const db = getDatabase();
      const row = db.getFirstSync<{ count: number }>(
        'SELECT COUNT(*) as count FROM queued_events WHERE status = "PENDING"'
      );
      return row?.count ?? 0;
    } catch (err) {
      console.warn('Error reading pending count from SQLite:', err);
      return 0;
    }
  },

  enqueue(event: Omit<QueuedEvent, 'id' | 'status' | 'retryCount'>): QueuedEvent {
    const newEntry: QueuedEvent = {
      ...event,
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      status: 'PENDING',
      retryCount: 0,
    };

    try {
      const db = getDatabase();
      db.runSync(
        `INSERT INTO queued_events (
          id, busId, routeId, cameraId, latitude, longitude,
          gpsAccuracy, timestamp, frameBase64, status, retryCount, errorMessage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newEntry.id,
          newEntry.busId,
          newEntry.routeId,
          newEntry.cameraId,
          newEntry.latitude,
          newEntry.longitude,
          newEntry.gpsAccuracy ?? null,
          newEntry.timestamp,
          newEntry.frameBase64 ?? null,
          newEntry.status,
          newEntry.retryCount,
          null,
        ]
      );
    } catch (err) {
      console.error('Failed to persist queued event in SQLite:', err);
    }

    return newEntry;
  },

  async replayAll(
    onProgress?: (synced: number, total: number) => void
  ): Promise<{ synced: number; failed: number }> {
    if (isReplaying) return { synced: 0, failed: 0 };
    isReplaying = true;

    let synced = 0;
    let failed = 0;

    try {
      const db = getDatabase();
      const pendingItems = db.getAllSync<any>(
        'SELECT * FROM queued_events WHERE status = "PENDING" ORDER BY timestamp ASC'
      );

      for (let i = 0; i < pendingItems.length; i++) {
        const item = pendingItems[i];
        if (!item.frameBase64) {
          // Mark invalid item with missing frame data as FAILED so it doesn't block the queue forever
          db.runSync(
            'UPDATE queued_events SET status = "FAILED", errorMessage = "Missing frame image data" WHERE id = ?',
            [item.id]
          );
          failed++;
          onProgress?.(synced, pendingItems.length);
          continue;
        }

        try {
          await MobileAPI.detectAndIngest({
            imageUri: item.frameBase64,
            busId: item.busId,
            routeId: item.routeId,
            cameraId: item.cameraId,
            latitude: Number(item.latitude),
            longitude: Number(item.longitude),
          });
          db.runSync(
            'UPDATE queued_events SET status = "SYNCED", errorMessage = NULL WHERE id = ?',
            [item.id]
          );
          synced++;
        } catch (err: any) {
          const nextRetry = Number(item.retryCount || 0) + 1;
          const status = nextRetry >= 5 ? 'FAILED' : 'PENDING';
          const msg = err?.message || 'Sync failed';
          db.runSync(
            'UPDATE queued_events SET retryCount = ?, status = ?, errorMessage = ? WHERE id = ?',
            [nextRetry, status, msg, item.id]
          );
          failed++;
        }
        onProgress?.(synced, pendingItems.length);
      }
    } catch (err) {
      console.error('OfflineQueue replayAll encountered error:', err);
    } finally {
      isReplaying = false;
    }

    return { synced, failed };
  },

  clearSynced() {
    try {
      const db = getDatabase();
      db.runSync('DELETE FROM queued_events WHERE status = "SYNCED"');
    } catch (err) {
      console.error('Error clearing synced records from SQLite:', err);
    }
  },

  clearAll() {
    try {
      const db = getDatabase();
      db.runSync('DELETE FROM queued_events');
    } catch (err) {
      console.error('Error clearing all records from SQLite:', err);
    }
  },
};
