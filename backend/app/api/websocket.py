"""
Real-Time WebSocket Feed for UrbanPulse Platform.
Provides authenticated, multi-client streaming of defect detections, fleet pings, and issue updates.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from typing import List, Dict, Any, Optional, Set
import logging

from app.core.security import decode_access_token, Role

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """
    Manages active WebSocket connections with safe concurrent broadcasting.
    Supports role-based and corridor-based broadcast filtering.
    Failed or broken connections are automatically pruned without breaking delivery to others.
    """
    _instance: Optional["ConnectionManager"] = None

    def __init__(self):
        # Map websocket to client metadata: {"user": str, "role": str, "corridors": Set[str]}
        self.active_connections: Dict[WebSocket, Dict[str, Any]] = {}

    @classmethod
    def get_instance(cls) -> "ConnectionManager":
        if cls._instance is None:
            cls._instance = ConnectionManager()
        return cls._instance

    async def connect(
        self,
        websocket: WebSocket,
        user: str = "unknown",
        role: str = Role.VIEWER,
        corridors: Optional[List[str]] = None
    ):
        await websocket.accept()
        self.active_connections[websocket] = {
            "user": user,
            "role": role,
            "corridors": set(corridors or [])
        }
        logger.info(f"WebSocket client connected ({user}, role={role}). Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            del self.active_connections[websocket]
            logger.info(f"WebSocket client disconnected. Total active: {len(self.active_connections)}")

    def update_subscriptions(self, websocket: WebSocket, corridors: List[str]):
        if websocket in self.active_connections:
            self.active_connections[websocket]["corridors"] = set(corridors)
            logger.info(f"Updated WebSocket subscriptions for {self.active_connections[websocket].get('user')}: {corridors}")

    def get_subscriptions(self, websocket: WebSocket) -> Set[str]:
        if websocket in self.active_connections:
            return self.active_connections[websocket].get("corridors", set())
        return set()

    def can_deliver(self, meta: Dict[str, Any], message: Dict[str, Any]) -> bool:
        """Check whether a client is authorized to receive this broadcast message."""
        client_role = meta.get("role", Role.VIEWER)
        client_corridors = meta.get("corridors", set())

        # ADMIN bypasses all filters
        if client_role == Role.ADMIN:
            return True

        # 1. Explicit target roles check
        target_roles = message.get("target_roles")
        if target_roles is not None:
            if client_role not in target_roles:
                return False

        # 2. Role-based restrictions by message type
        msg_type = message.get("type")
        if msg_type == "work_order_update":
            if client_role not in (Role.ADMIN, Role.PWD_ENGINEER, Role.FIELD_ENGINEER):
                return False
        elif msg_type == "telemetry_update":
            if client_role not in (Role.ADMIN, Role.TRANSPORT_OPERATOR, Role.FIELD_ENGINEER):
                return False

        # 3. Corridor / Route filtering
        if client_corridors:
            msg_corridor = message.get("corridor_id") or message.get("route_id") or message.get("corridor")
            issue = message.get("issue")
            if not msg_corridor and isinstance(issue, dict):
                msg_corridor = issue.get("corridor_id") or issue.get("route_id") or issue.get("corridor")

            if msg_corridor and msg_corridor not in client_corridors:
                return False

        return True

    async def broadcast(
        self,
        message: Dict[str, Any],
        target_roles: Optional[List[str]] = None,
        corridor: Optional[str] = None
    ):
        """
        Broadcast JSON message to authorized connected clients based on role and corridor.
        Isolates client connection errors so one dead client does not impede others.
        """
        if not self.active_connections:
            return

        if corridor and "corridor_id" not in message and "route_id" not in message:
            message["corridor_id"] = corridor

        dead_connections: List[WebSocket] = []
        for connection, meta in list(self.active_connections.items()):
            if target_roles and meta.get("role") != Role.ADMIN and meta.get("role") not in target_roles:
                continue
            if corridor and meta.get("corridors") and corridor not in meta.get("corridors"):
                continue
            if not self.can_deliver(meta, message):
                continue

            try:
                await connection.send_json(message)
            except Exception as exc:
                logger.warning(f"Error broadcasting to WebSocket client, scheduling removal: {exc}")
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)

    async def broadcast_text(self, text: str):
        """Broadcast raw text/ping to all clients."""
        if not self.active_connections:
            return

        dead_connections: List[WebSocket] = []
        for connection in list(self.active_connections.keys()):
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
    token: Optional[str] = Query(None),
    corridor: Optional[str] = Query(None)
):
    """
    Authenticated WebSocket endpoint for live defect ingestion and issue synchronization.
    Clients must supply a valid JWT token via query param (e.g. ?token=<JWT>).
    Clients can optionally specify a corridor (e.g. ?corridor=route-1).
    """
    if not token:
        logger.warning("WebSocket connection rejected: Missing token query parameter")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return

    try:
        payload = decode_access_token(token)
        username = payload.get("sub", "unknown")
        role = payload.get("role", Role.VIEWER)
    except Exception as exc:
        logger.warning(f"WebSocket authentication failed: {exc}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired token")
        return

    initial_corridors = [corridor] if corridor else []
    await manager.connect(websocket, user=username, role=role, corridors=initial_corridors)

    # Send handshake confirmation
    try:
        await websocket.send_json({
            "type": "connection_established",
            "message": "Connected to UrbanPulse Real-Time Telemetry Feed",
            "user": username,
            "role": role,
            "corridors": initial_corridors
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
                    msg_type = msg.get("type")
                    if msg_type == "ping":
                        await websocket.send_json({"type": "pong"})
                    elif msg_type in ("subscribe", "filter", "set_corridors"):
                        raw_corridors = msg.get("corridors") or ([msg.get("corridor")] if msg.get("corridor") else [])
                        manager.update_subscriptions(websocket, raw_corridors)
                        await websocket.send_json({
                            "type": "subscription_ack",
                            "corridors": list(manager.get_subscriptions(websocket))
                        })
                except Exception as err:
                    logger.debug(f"Invalid client message received: {err}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as exc:
        logger.debug(f"WebSocket session terminated: {exc}")
        manager.disconnect(websocket)
