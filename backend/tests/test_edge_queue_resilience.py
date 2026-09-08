"""
Edge Persistent Queue & Offline Resilience Tests.
"""

import pytest
import os
import tempfile
from app.edge.persistent_queue import PersistentEdgeQueue

def test_edge_queue_lifecycle():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test_edge_queue.db")
        queue = PersistentEdgeQueue(db_path=db_path)

        # 1. Enqueue events during simulated network outage
        for i in range(5):
            payload = {
                "event_id": f"evt-edge-offline-{i}",
                "timestamp": 1788880000.0 + i,
                "type": "pothole",
                "lat": 12.934,
                "lon": 77.610
            }
            assert queue.enqueue(payload) is True

        # 2. Duplicate suppression test
        duplicate_payload = {
            "event_id": "evt-edge-offline-0",
            "timestamp": 1788880000.0,
            "type": "pothole"
        }
        assert queue.enqueue(duplicate_payload) is False # Must suppress duplicate
        queue.close()

        # 3. Simulate hardware reboot: create new queue instance pointing to same file
        rebooted_queue = PersistentEdgeQueue(db_path=db_path)
        pending = rebooted_queue.get_pending(limit=10)
        assert len(pending) == 5

        # 4. Mark in flight & acknowledge
        rebooted_queue.mark_in_flight(["evt-edge-offline-0", "evt-edge-offline-1"])
        rebooted_queue.mark_acknowledged("evt-edge-offline-0")

        # 5. Check queue stats
        stats = rebooted_queue.get_queue_stats()
        assert stats["total"] == 5
        assert stats["acknowledged"] == 1
        assert stats["in_flight"] == 1
        assert stats["queued"] == 3

        # 6. Simulate unexpected crash while evt-edge-offline-1 is IN_FLIGHT
        rebooted_queue.close()
        crashed_recovery_queue = PersistentEdgeQueue(db_path=db_path)
        
        # After crash recovery, the in-flight event must have been rescued back to QUEUED
        pending_after_crash = crashed_recovery_queue.get_pending(limit=10)
        # 1 acknowledged, so 4 pending (3 previously queued + 1 recovered in-flight)
        assert len(pending_after_crash) == 4
        recovered_ids = {p["event_id"] for p in pending_after_crash}
        assert "evt-edge-offline-1" in recovered_ids
        crashed_recovery_queue.close()
