"""api/routes/metrics.py — /api/metrics endpoint (model metrics + SHAP)."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class FeatureImportanceItem(BaseModel):
    feature: str
    shap_value: float


class ModelMetrics(BaseModel):
    model_name: str
    accuracy: float
    weighted_f1: float
    per_class_f1: dict[str, float]
    training_timestamp: str
    dataset_type: str
    hardware_used: str
    smote_applied: bool
    n_features: int
    class_names: list[str]
    feature_importance_top10: list[FeatureImportanceItem]
    avg_latency_ms: float
    predictions_count: int


@router.get('/metrics', response_model=ModelMetrics)
async def get_metrics() -> ModelMetrics:
    from api.main import classifier

    metrics = classifier.metrics
    all_fi = classifier.feature_importance

    # Top 10 SHAP features
    top10 = sorted(all_fi.items(), key=lambda x: x[1], reverse=True)[:10]
    fi_items = [FeatureImportanceItem(feature=f, shap_value=v) for f, v in top10]

    return ModelMetrics(
        model_name=metrics.get('model_name', 'RandomForest'),
        accuracy=metrics.get('accuracy', 0.0),
        weighted_f1=metrics.get('weighted_f1', 0.0),
        per_class_f1=metrics.get('per_class_f1', {}),
        training_timestamp=metrics.get('training_timestamp', ''),
        dataset_type=metrics.get('dataset_type', 'synthetic'),
        hardware_used=metrics.get('hardware_used', 'CPU'),
        smote_applied=metrics.get('smote_applied', True),
        n_features=metrics.get('n_features', 0),
        class_names=metrics.get('class_names', []),
        feature_importance_top10=fi_items,
        avg_latency_ms=round(classifier.avg_latency_ms, 3),
        predictions_count=classifier.predictions_count,
    )
