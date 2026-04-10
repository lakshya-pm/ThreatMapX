"""api/routes/attacks.py — /api/attacks endpoint (paginated, filterable)."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()


class FeatureSnapshot(BaseModel):
    top_3_features: list[str]
    top_3_values: list[float]
    top_3_shap: list[float]


class AttackEvent(BaseModel):
    id: str
    timestamp: str
    source_ip: str
    source_country: str
    source_lat: float
    source_lng: float
    target_ip: str
    target_country: str
    target_lat: float
    target_lng: float
    attack_type: str
    raw_label: str
    packets_per_sec: int
    bytes_per_sec: int
    flow_duration_ms: int
    severity: int
    confidence: float
    model_used: str
    dataset_type: str
    mitre_id: Optional[str] = None
    mitre_tactic: Optional[str] = None
    mitre_name: str
    feature_snapshot: FeatureSnapshot


class AttacksResponse(BaseModel):
    events: list[AttackEvent]
    total: int
    offset: int
    limit: int


@router.get('/attacks', response_model=AttacksResponse)
async def get_attacks(
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    type: Optional[str] = Query(default=None, description='Filter by attack type: SYN, UDP, HTTP'),
    min_severity: Optional[int] = Query(default=None, ge=0, le=100),
) -> AttacksResponse:
    from api.main import streamer
    events = streamer.get_recent_attacks(
        limit=limit, offset=offset,
        filter_type=type, min_severity=min_severity
    )
    # Total before pagination (approximate from buffer)
    total_buffer = len(streamer.event_buffer)
    return AttacksResponse(
        events=[AttackEvent(**e) for e in events],
        total=total_buffer,
        offset=offset,
        limit=limit,
    )
