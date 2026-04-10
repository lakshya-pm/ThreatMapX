"""
api/websocket.py — WebSocket connection manager for ThreatMapX.
Handles multiple concurrent clients, circular buffer, heartbeat, graceful reconnect.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    """Manages all active WebSocket clients."""

    HEARTBEAT_INTERVAL = 10  # seconds
    MAX_BUFFER = 1000

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        self._buffer: list[dict[str, Any]] = []  # circular buffer of last 1000 events
        self._stats: dict[str, Any] = {}
        self._connected_at: dict[int, float] = {}  # ws id → timestamp

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active_connections.append(ws)
        self._connected_at[id(ws)] = time.time()

        # Burst last 8 events so client isn't empty on connect
        burst = self._buffer[-8:] if len(self._buffer) >= 8 else self._buffer[:]
        for event in burst:
            try:
                await ws.send_text(json.dumps(event))
            except Exception:
                break

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active_connections:
            self.active_connections.remove(ws)
        self._connected_at.pop(id(ws), None)

    async def broadcast(self, event: dict[str, Any]) -> None:
        """Broadcast a single event to all connected clients."""
        # Update circular buffer
        self._buffer.append(event)
        if len(self._buffer) > self.MAX_BUFFER:
            self._buffer.pop(0)

        message = json.dumps(event)
        dead: list[WebSocket] = []
        for ws in self.active_connections[:]:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def heartbeat_loop(self) -> None:
        """Send periodic heartbeat pings to all clients."""
        while True:
            await asyncio.sleep(self.HEARTBEAT_INTERVAL)
            ping = json.dumps({'type': 'heartbeat', 'ts': time.time()})
            dead: list[WebSocket] = []
            for ws in self.active_connections[:]:
                try:
                    await ws.send_text(ping)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.disconnect(ws)

    @property
    def client_count(self) -> int:
        return len(self.active_connections)

    def get_buffer(self) -> list[dict[str, Any]]:
        return list(self._buffer)
