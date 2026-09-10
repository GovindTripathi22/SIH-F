"""
Real-Time WebSocket Feed for UrbanPulse Platform.
Provides authenticated, multi-client streaming of defect detections, fleet pings, and issue updates.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from typing import List, Dict, Any, Optional
import logging

from app.core.security import decode_access_token

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """
    Manages active WebSocket connections with safe concurrent broadcasting.
    Failed or broken connections are automatically pruned without breaking delivery to others.
    """
    _instance: Optional["ConnectionManager"] = None

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    @classmethod
    def get_instance(cls) -> "ConnectionManager":
        if cls._instance is None:
            cls._instance = ConnectionManager()
        return cls._instance

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total active: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        """
        Broadcast JSON message to all connected clients.
        Isolates client connection errors so one dead client does not impede others.
        """
        if not self.active_connections:
            return

        dead_connections: List[WebSocket] = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except (WebSocketDisconnect, RuntimeError, Exception) as exc:
                logger.warning(f"Error broadcasting to WebSocket client, scheduling removal: {exc}")
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)

    async def broadcast_text(self, text: str):
        """Broadcast raw text/ping to all clients."""
        if not self.active_connections:
            return

        dead_connections: List[WebSocket] = []
        for connection in list(self.active_connections):
            try:
                await connection.send_text(text)
            except Exception as exc:
                logger.warning(f"Error sending text to client: {exc}")
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)


# Global singleton instance
manager = ConnectionManager.get_instance()


@router.websocket("/ws/live-feed")
async def websocket_live_feed(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    Authenticated WebSocket endpoint for live defect ingestion and issue synchronization.
    Clients must supply a valid JWT token via query param (e.g. ?token=<JWT>).
    """
    if not token:
        logger.warning("WebSocket connection rejected: Missing token query parameter")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return

    try:
        payload = decode_access_token(token)
        username = payload.get("sub", "unknown")
        role = payload.get("role", "VIEWER")
    except Exception as exc:
        logger.warning(f"WebSocket authentication failed: {exc}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired token")
        return

    await manager.connect(websocket)

    # Send handshake confirmation
    try:
        await websocket.send_json({
            "type": "connection_established",
            "message": "Connected to UrbanPulse Real-Time Telemetry Feed",
            "user": username,
            "role": role
        })
    except Exception:
        manager.disconnect(websocket)
        return

    try:
        while True:
            # Keep-alive and client message reception
            data = await websocket.receive_text()
            if data.strip().lower() == "ping":
                await websocket.send_text("pong")
            elif data.startswith("{"):
                # Handle client-initiated ping or filter update
                try:
                    import json
                    msg = json.loads(data)
                    if msg.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})
                except Exception:
                    pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as exc:
        logger.debug(f"WebSocket session terminated: {exc}")
        manager.disconnect(websocket)
