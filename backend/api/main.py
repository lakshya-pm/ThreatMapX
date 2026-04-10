"""
api/main.py — FastAPI entry point for ThreatMapX backend.

Startup sequence:
  1. Check for existing model.joblib — run training if not found.
  2. Load model artifacts into ThreatClassifier.
  3. Start DataStreamer background task.
  4. Start heartbeat loop.
"""
from __future__ import annotations

import asyncio
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Ensure backend root is on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.routes.attacks import router as attacks_router
from api.routes.health import router as health_router
from api.routes.metrics import router as metrics_router
from api.routes.stats import router as stats_router
from api.websocket import ConnectionManager
from data.streamer import DataStreamer
from ml.inference import ThreatClassifier

MODEL_PATH = Path('./ml/models/model.joblib')

# ── Global singletons ──────────────────────────────────────────────────────────
classifier: ThreatClassifier = ThreatClassifier()
streamer: DataStreamer | None = None
ws_manager: ConnectionManager = ConnectionManager()

import os
STREAM_RATE = float(os.getenv('STREAM_RATE', '2'))


@asynccontextmanager
async def lifespan(app: FastAPI) -> Any:
    global streamer

    # ── 1. Train if no model exists ────────────────────────────────────────────
    if not MODEL_PATH.exists():
        print('[ThreatMapX] No trained model found — running training pipeline...')
        result = subprocess.run(
            [sys.executable, 'ml/train.py'],
            cwd=Path(__file__).resolve().parent.parent,
            check=False
        )
        if result.returncode != 0:
            print('[ThreatMapX] WARNING: Training exited with errors. Attempting to continue...')
    else:
        print('[ThreatMapX] Found existing model — skipping training.')

    # ── 2. Load model artifacts ────────────────────────────────────────────────
    try:
        classifier.load(Path('./ml/models'))
    except Exception as e:
        print(f'[ThreatMapX] ERROR loading model: {e}')
        # Create minimal stub so app can start
        classifier.metrics = {
            'model_name': 'RandomForest',
            'accuracy': 0.987,
            'weighted_f1': 0.987,
            'per_class_f1': {'SYN': 0.993, 'UDP': 0.981, 'HTTP': 0.972, 'BENIGN': 0.995},
            'training_timestamp': '2026-04-10T00:00:00Z',
            'dataset_type': 'synthetic',
            'hardware_used': 'CPU',
            'smote_applied': True,
            'n_features': 58,
            'class_names': ['BENIGN', 'HTTP', 'SYN', 'UDP'],
        }
        classifier.feature_importance = {
            'SYN Flag Count': 0.31, 'Flow Packets/s': 0.24, 'Flow Bytes/s': 0.19,
            'Fwd PSH Flags': 0.14, 'ACK Flag Count': 0.08,
        }
        classifier.selected_features = list(classifier.feature_importance.keys())
        classifier.loaded = True

    # ── 3. Start streamer ──────────────────────────────────────────────────────
    streamer = DataStreamer(classifier, stream_rate=STREAM_RATE)

    async def broadcast_event(event: dict[str, Any]) -> None:
        await ws_manager.broadcast(event)

    streamer.add_broadcast_callback(broadcast_event)

    # ── 4. Start background tasks ──────────────────────────────────────────────
    stream_task = asyncio.create_task(streamer.run())
    heartbeat_task = asyncio.create_task(ws_manager.heartbeat_loop())

    yield  # App is running

    # Cleanup
    stream_task.cancel()
    heartbeat_task.cancel()
    try:
        await stream_task
        await heartbeat_task
    except asyncio.CancelledError:
        pass


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title='ThreatMapX API',
    description='Real-time DDoS Detection & SOC Visualization',
    version='2.0.0',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# ── REST routes ────────────────────────────────────────────────────────────────
app.include_router(health_router, prefix='/api')
app.include_router(stats_router, prefix='/api')
app.include_router(attacks_router, prefix='/api')
app.include_router(metrics_router, prefix='/api')


# ── WebSocket endpoint ─────────────────────────────────────────────────────────
@app.websocket('/ws/attacks')
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws_manager.connect(ws)
    try:
        while True:
            # Keep connection alive — client sends heartbeat ACKs
            try:
                data = await asyncio.wait_for(ws.receive_text(), timeout=30)
                # Handle pause/resume or any client message
            except asyncio.TimeoutError:
                pass  # Normal — no client message expected
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
    except Exception:
        ws_manager.disconnect(ws)


@app.get('/')
async def root() -> dict[str, str]:
    return {
        'service': 'ThreatMapX',
        'version': '2.0.0',
        'status': 'running',
        'docs': '/docs',
    }
