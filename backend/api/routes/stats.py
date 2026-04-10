"""api/routes/stats.py — /api/stats endpoint."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class CountryCount(BaseModel):
    country: str
    count: int


class StatsResponse(BaseModel):
    attacks_per_min: int
    type_breakdown: dict[str, float]
    top_sources: list[CountryCount]
    top_targets: list[CountryCount]
    avg_severity: float
    avg_confidence: float
    unique_ips: int
    unique_countries: int
    total_events: int
    non_benign_events: int
    benign_events: int


@router.get('/stats', response_model=StatsResponse)
async def stats() -> StatsResponse:
    from api.main import streamer
    raw = streamer.get_stats()
    return StatsResponse(
        attacks_per_min=raw['attacks_per_min'],
        type_breakdown=raw['type_breakdown'],
        top_sources=[CountryCount(**x) for x in raw['top_sources']],
        top_targets=[CountryCount(**x) for x in raw['top_targets']],
        avg_severity=raw['avg_severity'],
        avg_confidence=raw['avg_confidence'],
        unique_ips=raw['unique_ips'],
        unique_countries=raw['unique_countries'],
        total_events=raw['total_events'],
        non_benign_events=raw['non_benign_events'],
        benign_events=raw['benign_events'],
    )
