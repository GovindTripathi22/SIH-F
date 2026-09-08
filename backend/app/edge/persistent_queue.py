"""
Durable SQLite-Backed Persistent Edge Event Queue.
Guarantees zero event loss during network severance, power interruptions, or edge system reboots.
"""

import sqlite3
import json
import time
from typing import List, Dict, Optional, Tuple
import os
import logging

logger = logging.getLogger(__name__)


class PersistentEdgeQueue:
    """
    ACID-compliant local FIFO queue for edge bus devices.
    Retains events in SQLite local disk storage until central API server acknowledges delivery.
    """

    def __init__(self, db_path: str = "./edge_queue.db"):
        self.db_path = db_path
        self._conn = sqlite3.connect(self.db_path)
        self._conn.row_factory = sqlite3.Row
        self._init_db()

    def close(self):
        """Explicitly close database connection"""
        if self._conn:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None

    def __del__(self):
        self.close()

    def _init_db(self):
        """Create persistent queue schema with indexes and perform crash recovery"""
        with self._conn:
            self._conn.execute("""
                CREATE TABLE IF NOT EXISTS edge_event_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT UNIQUE NOT NULL,
                    payload_json TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'QUEUED',  -- QUEUED, IN_FLIGHT, ACKNOWLEDGED, FAILED
                    attempts INTEGER NOT NULL DEFAULT 0,
                    created_at REAL NOT NULL,
                    last_attempt_at REAL,
                    error_message TEXT
                )
            """)
            self._conn.execute("CREATE INDEX IF NOT EXISTS idx_edge_status ON edge_event_queue(status, created_at)")
            # Crash recovery: Reset any unacknowledged in-flight events from previous process crashes
            self._conn.execute("UPDATE edge_event_queue SET status = 'QUEUED' WHERE status = 'IN_FLIGHT'")

    def enqueue(self, event_payload: dict) -> bool:
        """Atomically persist event to local disk"""
        event_id = event_payload.get("event_id")
        if not event_id:
            raise ValueError("Payload missing required event_id")

        try:
            with self._conn:
                self._conn.execute(
                    """
                    INSERT INTO edge_event_queue (event_id, payload_json, status, created_at)
                    VALUES (?, ?, 'QUEUED', ?)
                    """,
                    (event_id, json.dumps(event_payload), time.time())
                )
            logger.info(f"Persisted event {event_id} to edge disk queue")
            return True
        except sqlite3.IntegrityError:
            logger.warning(f"Event {event_id} already exists in persistent queue (duplicate suppressed)")
            return False

    def get_pending(self, limit: int = 20, in_flight_timeout_seconds: float = 60.0) -> List[Dict[str, any]]:
        """Retrieve oldest pending events ready for transmission, recovering any timed-out in-flight items"""
        now = time.time()
        with self._conn:
            # Reclaim any abandoned in-flight events that timed out
            self._conn.execute(
                """
                UPDATE edge_event_queue
                SET status = 'QUEUED'
                WHERE status = 'IN_FLIGHT' AND (last_attempt_at IS NULL OR last_attempt_at < ?)
                """,
                (now - in_flight_timeout_seconds,)
            )

        cursor = self._conn.execute(
            """
            SELECT id, event_id, payload_json, attempts
            FROM edge_event_queue
            WHERE status IN ('QUEUED', 'FAILED')
            ORDER BY created_at ASC
            LIMIT ?
            """,
            (limit,)
        )
        rows = cursor.fetchall()
        items = []
        for row in rows:
            items.append({
                "id": row["id"],
                "event_id": row["event_id"],
                "payload": json.loads(row["payload_json"]),
                "attempts": row["attempts"]
            })
        return items

    def mark_in_flight(self, event_ids: List[str]):
        """Mark events as currently transmitting over cellular network"""
        if not event_ids:
            return
        with self._conn:
            placeholders = ",".join("?" for _ in event_ids)
            self._conn.execute(
                f"""
                UPDATE edge_event_queue
                SET status = 'IN_FLIGHT', attempts = attempts + 1, last_attempt_at = ?
                WHERE event_id IN ({placeholders})
                """,
                [time.time()] + event_ids
            )

    def mark_acknowledged(self, event_id: str):
        """Mark event as verified received by central server (safe to purge or archive)"""
        with self._conn:
            self._conn.execute(
                "UPDATE edge_event_queue SET status = 'ACKNOWLEDGED' WHERE event_id = ?",
                (event_id,)
            )
            logger.info(f"ACK received for event {event_id}")

    def mark_failed(self, event_id: str, error: str):
        """Mark event transmission as failed; eligible for exponential retry"""
        with self._conn:
            self._conn.execute(
                """
                UPDATE edge_event_queue
                SET status = 'FAILED', error_message = ?, last_attempt_at = ?
                WHERE event_id = ?
                """,
                (error, time.time(), event_id)
            )

    def get_queue_stats(self) -> Dict[str, int]:
        """Return counts by queue status"""
        cursor = self._conn.execute(
            "SELECT status, COUNT(*) as cnt FROM edge_event_queue GROUP BY status"
        )
        counts = {row["status"]: row["cnt"] for row in cursor.fetchall()}
        return {
            "total": sum(counts.values()),
            "queued": counts.get("QUEUED", 0),
            "in_flight": counts.get("IN_FLIGHT", 0),
            "failed": counts.get("FAILED", 0),
            "acknowledged": counts.get("ACKNOWLEDGED", 0)
        }
