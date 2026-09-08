/**
 * Connectivity Resilience Module
 * 
 * Handles network loss scenarios for bus-mounted edge devices.
 * Ensures no detections are lost during connectivity outages.
 * 
 * Pipeline:
 * EDGE EVENT BUFFER → LOCAL STORAGE → NETWORK RETURNS → SYNC → CENTRAL SERVER
 */

export type ConnectionStatus = 'LIVE' | 'DELAYED' | 'OFFLINE' | 'SYNCING';

export interface BufferedEvent {
  id: string;
  event_data: any;
  created_at: string;
  retry_count: number;
  max_retries: number;
  priority: 'high' | 'medium' | 'low';
  synced: boolean;
  sync_timestamp?: string;
}

export interface SyncStatus {
  connection_status: ConnectionStatus;
  buffered_events: number;
  last_sync_timestamp: string | null;
  pending_sync_count: number;
  failed_sync_count: number;
  total_synced_today: number;
}

export interface ConnectivityConfig {
  max_buffer_size: number;
  retry_interval_seconds: number;
  max_retries: number;
  sync_batch_size: number;
  priority_order: ('high' | 'medium' | 'low')[];
  deduplication_window_seconds: number;
}

const DEFAULT_CONFIG: ConnectivityConfig = {
  max_buffer_size: 1000,
  retry_interval_seconds: 30,
  max_retries: 5,
  sync_batch_size: 50,
  priority_order: ['high', 'medium', 'low'],
  deduplication_window_seconds: 300, // 5 minutes
};

/**
 * Event buffer for offline resilience
 */
export class EventBuffer {
  private buffer: BufferedEvent[] = [];
  private config: ConnectivityConfig;
  private connectionStatus: ConnectionStatus = 'LIVE';
  private eventIds: Set<string> = new Set(); // For deduplication
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<ConnectivityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add an event to the buffer
   */
  addEvent(eventId: string, eventData: any, priority: 'high' | 'medium' | 'low' = 'medium'): boolean {
    // Deduplication check
    if (this.eventIds.has(eventId)) {
      console.warn(`[EventBuffer] Duplicate event rejected: ${eventId}`);
      return false;
    }

    // Buffer size check
    if (this.buffer.length >= this.config.max_buffer_size) {
      // Remove oldest low-priority event
      const oldestLowPriority = this.buffer.findIndex(e => e.priority === 'low');
      if (oldestLowPriority >= 0) {
        this.buffer.splice(oldestLowPriority, 1);
      } else {
        console.warn('[EventBuffer] Buffer full, event rejected');
        return false;
      }
    }

    const buffered: BufferedEvent = {
      id: eventId,
      event_data: eventData,
      created_at: new Date().toISOString(),
      retry_count: 0,
      max_retries: this.config.max_retries,
      priority,
      synced: false,
    };

    this.buffer.push(buffered);
    this.eventIds.add(eventId);
    
    // Clean up old event IDs (beyond deduplication window)
    this.cleanupEventIds();
    
    return true;
  }

  /**
   * Get events ready for sync (ordered by priority)
   */
  getEventsForSync(): BufferedEvent[] {
    return this.buffer
      .filter(e => !e.synced && e.retry_count < e.max_retries)
      .sort((a, b) => {
        const priorityOrder = this.config.priority_order;
        const aIdx = priorityOrder.indexOf(a.priority);
        const bIdx = priorityOrder.indexOf(b.priority);
        if (aIdx !== bIdx) return aIdx - bIdx;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      })
      .slice(0, this.config.sync_batch_size);
  }

  /**
   * Mark events as synced
   */
  markSynced(eventIds: string[]): void {
    eventIds.forEach(id => {
      const event = this.buffer.find(e => e.id === id);
      if (event) {
        event.synced = true;
        event.sync_timestamp = new Date().toISOString();
      }
    });

    // Remove synced events older than 1 hour
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    this.buffer = this.buffer.filter(e => !e.synced || e.created_at > oneHourAgo);
  }

  /**
   * Increment retry count for failed events
   */
  markFailed(eventIds: string[]): void {
    eventIds.forEach(id => {
      const event = this.buffer.find(e => e.id === id);
      if (event) {
        event.retry_count++;
      }
    });
  }

  /**
   * Update connection status
   */
  setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    const pendingEvents = this.buffer.filter(e => !e.synced);
    const failedEvents = pendingEvents.filter(e => e.retry_count >= e.max_retries);
    
    return {
      connection_status: this.connectionStatus,
      buffered_events: this.buffer.length,
      last_sync_timestamp: this.getLastSyncTimestamp(),
      pending_sync_count: pendingEvents.length,
      failed_sync_count: failedEvents.length,
      total_synced_today: this.buffer.filter(e => e.synced && this.isToday(e.sync_timestamp!)).length,
    };
  }

  /**
   * Get buffer contents (for debugging/monitoring)
   */
  getBuffer(): BufferedEvent[] {
    return [...this.buffer];
  }

  /**
   * Clear all buffered events
   */
  clear(): void {
    this.buffer = [];
    this.eventIds.clear();
  }

  // Private helpers
  private getLastSyncTimestamp(): string | null {
    const syncedEvents = this.buffer.filter(e => e.synced && e.sync_timestamp);
    if (syncedEvents.length === 0) return null;
    return syncedEvents.sort((a, b) => 
      new Date(b.sync_timestamp!).getTime() - new Date(a.sync_timestamp!).getTime()
    )[0].sync_timestamp!;
  }

  private isToday(timestamp: string): boolean {
    const date = new Date(timestamp);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  private cleanupEventIds(): void {
    const cutoff = new Date(Date.now() - this.config.deduplication_window_seconds * 1000).toISOString();
    const recentIds = new Set(
      this.buffer
        .filter(e => e.created_at > cutoff)
        .map(e => e.id)
    );
    this.eventIds = recentIds;
  }
}

/**
 * Connection monitor that detects network status changes
 */
export class ConnectionMonitor {
  private status: ConnectionStatus = 'LIVE';
  private lastOnline: Date = new Date();
  private listeners: Array<(status: ConnectionStatus) => void> = [];
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private checkIntervalMs: number = 5000) {}

  /**
   * Start monitoring connection
   */
  start(): void {
    this.checkInterval = setInterval(() => {
      this.checkConnection();
    }, this.checkIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Register a status change listener
   */
  onStatusChange(listener: (status: ConnectionStatus) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Manually set connection status (for testing)
   */
  setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      if (status === 'LIVE') {
        this.lastOnline = new Date();
      }
      this.notifyListeners();
    }
  }

  /**
   * Get current status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Get time since last online
   */
  getTimeSinceLastOnline(): number {
    return Date.now() - this.lastOnline.getTime();
  }

  // Private
  private checkConnection(): void {
    // In a real implementation, this would ping the server
    // For now, status is managed externally
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.status));
  }
}
