"""
ml/preprocess.py — Feature Engineering and Preprocessing Pipeline
Includes StandardScaler + SMOTE (training only).
SMOTE reference: O'Brien et al. 2023 (Paper 7 in gap analysis).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.feature_selection import VarianceThreshold
from sklearn.preprocessing import LabelEncoder, StandardScaler


def preprocess(
    df: pd.DataFrame,
    fit: bool = True,
    scaler: StandardScaler | None = None,
    le: LabelEncoder | None = None,
    selected_features: list[str] | None = None,
) -> tuple[np.ndarray, np.ndarray, StandardScaler, LabelEncoder, list[str]]:
    """
    Full preprocessing pipeline.

    Steps:
      1. Drop features with >50% missing values
      2. Drop low-variance features (VarianceThreshold)
      3. Drop highly correlated feature pairs (threshold 0.95, keep one)
      4. StandardScaler — fit on train only, transform both
      5. SMOTE — apply ONLY on training set (fit=True) to handle class imbalance
      6. LabelEncoder for Attack_Type

    Args:
        df:               Input DataFrame with 'Attack_Type' column.
        fit:              True = training phase (fit+transform + apply SMOTE).
                          False = inference/test phase (transform only, no SMOTE).
        scaler:           Pre-fitted scaler (required when fit=False).
        le:               Pre-fitted LabelEncoder (required when fit=False).
        selected_features: Feature list after selection (required when fit=False).

    Returns:
        X, y, scaler, label_encoder, selected_features
    """
    df = df.copy()

    # ── Separate target ────────────────────────────────────────────────────────
    y_raw: pd.Series = df['Attack_Type']
    X: pd.DataFrame = df.drop(columns=['Attack_Type'])

    # ── 1. Drop features with >50% missing ────────────────────────────────────
    if fit:
        thresh = len(X) * 0.5
        missing_mask = X.isnull().sum() < thresh
        X = X.loc[:, missing_mask]
        print(f'[PREPROCESS] After missing filter: {X.shape[1]} features')

    # ── Align features to selected_features if provided ───────────────────────
    if selected_features is not None:
        available = [f for f in selected_features if f in X.columns]
        X = X[available]

    # ── 2. Drop low-variance features ─────────────────────────────────────────
    if fit:
        vt = VarianceThreshold(threshold=0.0)
        vt.fit(X)
        X = X.loc[:, vt.get_support()]
        print(f'[PREPROCESS] After variance filter: {X.shape[1]} features')

    # ── 3. Drop highly correlated features ────────────────────────────────────
    if fit:
        corr_matrix = X.corr().abs()
        upper = corr_matrix.where(
            np.triu(np.ones(corr_matrix.shape), k=1).astype(bool)
        )
        to_drop = [col for col in upper.columns if any(upper[col] > 0.95)]
        X = X.drop(columns=to_drop, errors='ignore')
        print(f'[PREPROCESS] After correlation filter: {X.shape[1]} features (dropped {len(to_drop)})')
        selected_features = list(X.columns)

    # ── 4. StandardScaler ─────────────────────────────────────────────────────
    if fit:
        scaler = StandardScaler()
        X_scaled: np.ndarray = scaler.fit_transform(X)
    else:
        assert scaler is not None, 'Scaler must be provided when fit=False'
        X_scaled = scaler.transform(X)

    # ── 5. Label encoding ─────────────────────────────────────────────────────
    if fit:
        le = LabelEncoder()
        y: np.ndarray = le.fit_transform(y_raw)
    else:
        assert le is not None, 'LabelEncoder must be provided when fit=False'
        y = le.transform(y_raw)

    # ── 6. SMOTE — training only ───────────────────────────────────────────────
    # Apply ONLY when fit=True (training phase), never on test set or inference.
    # Reference: O'Brien et al. 2023 — addresses class imbalance in CICDDoS2019.
    if fit:
        class_counts = pd.Series(y).value_counts()
        min_count = class_counts.min()
        if min_count < 6:
            print(f'[SMOTE] Skipping SMOTE — min class count {min_count} < 6 neighbours required.')
        else:
            print(f'[SMOTE] Applying SMOTE to training set (min class: {min_count} samples)...')
            smote = SMOTE(random_state=42, k_neighbors=min(5, min_count - 1))
            X_scaled, y = smote.fit_resample(X_scaled, y)
            print(f'[SMOTE] After SMOTE: {X_scaled.shape[0]:,} samples')

    return X_scaled, y, scaler, le, selected_features  # type: ignore[return-value]


def preprocess_single(
    features: dict[str, Any],
    scaler: StandardScaler,
    le: LabelEncoder,
    selected_features: list[str],
) -> np.ndarray:
    """
    Preprocess a single inference sample (dict of feature values).
    Returns a 2-D array ready for model.predict_proba().
    """
    row = {f: features.get(f, 0.0) for f in selected_features}
    X = pd.DataFrame([row])
    X_scaled: np.ndarray = scaler.transform(X)
    return X_scaled


def save_feature_list(selected_features: list[str], path: str = './ml/models/features.json') -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w') as f:
        json.dump(selected_features, f, indent=2)
    print(f'[PREPROCESS] Saved feature list → {path} ({len(selected_features)} features)')


def load_feature_list(path: str = './ml/models/features.json') -> list[str]:
    with open(path) as f:
        return json.load(f)
