"""
ml/inference.py — Real-time prediction class for ThreatMapX.
Loads model artifacts and provides low-latency prediction with confidence scores.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler

MODEL_DIR = Path('./ml/models')


class ThreatClassifier:
    """Wraps model.joblib + scaler + label_encoder for real-time inference."""

    def __init__(self) -> None:
        self.model: Any = None
        self.scaler: StandardScaler | None = None
        self.le: LabelEncoder | None = None
        self.selected_features: list[str] = []
        self.feature_importance: dict[str, float] = {}
        self.metrics: dict[str, Any] = {}
        self.predictions_count: int = 0
        self.total_latency_ms: float = 0.0
        self.loaded: bool = False

    def load(self, model_dir: str | Path = MODEL_DIR) -> None:
        model_dir = Path(model_dir)
        self.model = joblib.load(model_dir / 'model.joblib')
        self.scaler = joblib.load(model_dir / 'scaler.joblib')
        self.le = joblib.load(model_dir / 'label_encoder.joblib')

        with open(model_dir / 'features.json') as f:
            self.selected_features = json.load(f)

        fi_path = model_dir / 'feature_importance.json'
        if fi_path.exists():
            with open(fi_path) as f:
                self.feature_importance = json.load(f)

        metrics_path = model_dir / 'metrics.json'
        if metrics_path.exists():
            with open(metrics_path) as f:
                self.metrics = json.load(f)

        self.loaded = True
        model_name = self.metrics.get('model_name', 'Unknown')
        accuracy = self.metrics.get('accuracy', 0.0) * 100
        dataset_type = self.metrics.get('dataset_type', 'unknown')
        print(f'[ThreatMapX] Model loaded: {model_name}, Accuracy: {accuracy:.1f}%, Dataset: {dataset_type}')

    def predict(self, features: dict[str, float]) -> dict[str, Any]:
        """
        Predict attack type for a single feature dict.

        Returns:
            {
              'attack_type': str,       # e.g. 'SYN'
              'confidence': float,      # 0.0–1.0
              'probabilities': dict,    # per-class probabilities
              'latency_ms': float,
            }
        """
        if not self.loaded or self.model is None:
            raise RuntimeError('Model not loaded. Call load() first.')

        t0 = time.perf_counter()

        # Build feature vector aligned to selected_features (as DataFrame to match scaler training)
        import pandas as pd
        row_dict = {f: features.get(f, 0.0) for f in self.selected_features}
        row_df = pd.DataFrame([row_dict], columns=self.selected_features)
        scaled = self.scaler.transform(row_df)  # type: ignore[union-attr]

        proba = self.model.predict_proba(scaled)[0]
        pred_idx = int(np.argmax(proba))
        attack_type: str = self.le.classes_[pred_idx]  # type: ignore[index]
        confidence = float(proba[pred_idx])

        latency_ms = (time.perf_counter() - t0) * 1000
        self.predictions_count += 1
        self.total_latency_ms += latency_ms

        probabilities = {
            cls: float(p)
            for cls, p in zip(self.le.classes_, proba)  # type: ignore[union-attr]
        }

        return {
            'attack_type': attack_type,
            'confidence': confidence,
            'probabilities': probabilities,
            'latency_ms': round(latency_ms, 3),
        }

    def get_top_shap_features(self, n: int = 3) -> tuple[list[str], list[float]]:
        """Return top-n features by SHAP importance (names + values)."""
        sorted_feats = sorted(
            self.feature_importance.items(), key=lambda x: x[1], reverse=True
        )[:n]
        names = [f for f, _ in sorted_feats]
        values = [v for _, v in sorted_feats]
        return names, values

    @property
    def avg_latency_ms(self) -> float:
        if self.predictions_count == 0:
            return 0.0
        return self.total_latency_ms / self.predictions_count

    @property
    def model_name(self) -> str:
        return self.metrics.get('model_name', 'Unknown')

    @property
    def accuracy(self) -> float:
        return self.metrics.get('accuracy', 0.0)

    @property
    def dataset_type(self) -> str:
        return self.metrics.get('dataset_type', 'synthetic')
