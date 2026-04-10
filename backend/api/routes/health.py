"""api/routes/health.py — /api/health endpoint."""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# Module-level start time
_START_TIME = time.time()


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    dataset_type: str
    uptime_seconds: float
    events_processed: int
    ws_clients: int


@router.get('/health', response_model=HealthResponse)
async def health(request: Any = None) -> HealthResponse:
    from api.main import classifier, streamer, ws_manager
    return HealthResponse(
        status='ok',
        model_loaded=classifier.loaded,
        dataset_type=classifier.dataset_type if classifier.loaded else 'none',
        uptime_seconds=round(time.time() - _START_TIME, 1),
        events_processed=streamer.get_stats()['total_events'] if streamer else 0,
        ws_clients=ws_manager.client_count if ws_manager else 0,
    )
