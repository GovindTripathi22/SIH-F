/**
 * Offline Resilience Queue for Mobile Dashcam.
 * Ensures observations captured during cellular blind spots are preserved and safely replayed.
 */

import { QueuedEvent } from '../types';
import { MobileAPI } from './api';

let queue: QueuedEvent[] = [];
let isReplaying = false;

export const OfflineQueue = {
  getQueue(): QueuedEvent[] {
    return [...queue];
  },

  getPendingCount(): number {
    return queue.filter(item => item.status === 'PENDING').length;
  },

  enqueue(event: Omit<QueuedEvent, 'id' | 'status' | 'retryCount'>): QueuedEvent {
    const newEntry: QueuedEvent = {
      ...event,
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      status: 'PENDING',
      retryCount: 0,
    };
    queue.push(newEntry);
    return newEntry;
  },

  async replayAll(onProgress?: (synced: number, total: number) => void): Promise<{ synced: number; failed: number }> {
    if (isReplaying) return { synced: 0, failed: 0 };
    isReplaying = true;

    let synced = 0;
    let failed = 0;
    const pendingItems = queue.filter(item => item.status === 'PENDING');

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      try {
        if (item.frameBase64) {
          await MobileAPI.detectAndIngest({
            imageUri: item.frameBase64,
            busId: item.busId,
            routeId: item.routeId,
            cameraId: item.cameraId,
            latitude: item.latitude,
            longitude: item.longitude,
          });
          item.status = 'SYNCED';
          synced++;
        }
      } catch (err: any) {
        item.retryCount += 1;
        item.errorMessage = err.message || 'Sync failed';
        if (item.retryCount >= 5) {
          item.status = 'FAILED';
        }
        failed++;
      }
      onProgress?.(synced, pendingItems.length);
    }

    isReplaying = false;
    return { synced, failed };
  },

  clearSynced() {
    queue = queue.filter(item => item.status === 'PENDING');
  }
};
