"""
ml/train.py — GPU-aware training pipeline for ThreatMapX.

Usage:
  python ml/train.py           # auto-detect GPU/CPU
  python ml/train.py --gpu     # force GPU
  python ml/train.py --cpu     # force CPU

Trains Random Forest + XGBoost, selects winner by weighted F1.
Computes SHAP values for top 20 features.
Saves: model.joblib, scaler.joblib, features.json, label_encoder.joblib,
       feature_importance.json, metrics.json
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split

# Add backend dir to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from data.loader import load_dataset
from ml.preprocess import preprocess, save_feature_list

MODEL_DIR = Path('./ml/models')
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# ── GPU detection ──────────────────────────────────────────────────────────────
def gpu_available() -> bool:
    try:
        import subprocess
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=name', '--format=csv,noheader'],
            capture_output=True, text=True, timeout=5
        )
        return result.returncode == 0 and result.stdout.strip() != ''
    except Exception:
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description='ThreatMapX ML Training')
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--gpu', action='store_true', help='Force GPU training')
    group.add_argument('--cpu', action='store_true', help='Force CPU training')
    args = parser.parse_args()

    use_gpu = args.gpu or (not args.cpu and gpu_available())
    hardware = 'RTX 4060 (GPU)' if use_gpu else 'CPU (i9-13900H, 20 cores)'
    print(f'\n{"="*60}')
    print(f'  ThreatMapX ML Training Pipeline')
    print(f'  Hardware: {hardware}')
    print(f'{"="*60}\n')

    # ── Load dataset ───────────────────────────────────────────────────────────
    df = load_dataset()
    dataset_type: str = df.attrs.get('dataset_type', 'synthetic')
    print(f'\n[TRAIN] Dataset type: {dataset_type} — {len(df):,} samples\n')

    # ── Train/test split ──────────────────────────────────────────────────────
    train_df, test_df = train_test_split(
        df, test_size=0.2, stratify=df['Attack_Type'], random_state=42
    )
    print(f'[TRAIN] Train: {len(train_df):,} | Test: {len(test_df):,}')

    # ── Preprocess (SMOTE on train only) ─────────────────────────────────────
    print('\n[TRAIN] Running preprocessing + SMOTE on training set...')
    X_train, y_train, scaler, le, selected_features = preprocess(train_df, fit=True)
    print(f'[TRAIN] Train set after SMOTE: {X_train.shape[0]:,} samples, {X_train.shape[1]} features')

    print('\n[TRAIN] Preprocessing test set (no SMOTE)...')
    X_test, y_test, _, _, _ = preprocess(
        test_df, fit=False,
        scaler=scaler, le=le,
        selected_features=selected_features
    )
    print(f'[TRAIN] Test set: {X_test.shape[0]:,} samples')

    class_names = list(le.classes_)

    # ── Model A — Random Forest ───────────────────────────────────────────────
    print('\n' + '='*60)
    print('  Model A — Random Forest')
    print('='*60)

    if use_gpu:
        try:
            from cuml.ensemble import RandomForestClassifier as cuRF
            rf_model = cuRF(n_estimators=100, max_depth=20, random_state=42)
            hardware_rf = 'RAPIDS cuML (GPU)'
            print('[GPU] Using RAPIDS cuML Random Forest on RTX 4060')
        except ImportError:
            from sklearn.ensemble import RandomForestClassifier
            rf_model = RandomForestClassifier(
                n_estimators=100, max_depth=20,
                min_samples_split=5, min_samples_leaf=2,
                class_weight='balanced', n_jobs=-1, random_state=42
            )
            hardware_rf = 'sklearn (CPU fallback)'
            print('[CPU fallback] cuML not installed — using sklearn Random Forest')
    else:
        from sklearn.ensemble import RandomForestClassifier
        rf_model = RandomForestClassifier(
            n_estimators=100, max_depth=20,
            min_samples_split=5, min_samples_leaf=2,
            class_weight='balanced', n_jobs=-1, random_state=42
        )
        hardware_rf = 'sklearn (CPU)'
        print('[CPU] sklearn Random Forest (i9-13900H, 20 cores)')

    t0 = time.time()
    rf_model.fit(X_train, y_train)
    rf_train_time = time.time() - t0
    print(f'[RF] Training time: {rf_train_time:.1f}s')

    rf_preds = rf_model.predict(X_test)
    rf_report = classification_report(y_test, rf_preds, target_names=class_names, output_dict=True)
    rf_f1 = f1_score(y_test, rf_preds, average='weighted')

    print('\n[RF] Classification Report:')
    print(classification_report(y_test, rf_preds, target_names=class_names))
    print(f'[RF] Confusion Matrix:\n{confusion_matrix(y_test, rf_preds)}')
    print(f'[RF] Weighted F1: {rf_f1:.4f}')

    # ── Model B — XGBoost ─────────────────────────────────────────────────────
    print('\n' + '='*60)
    print('  Model B — XGBoost')
    print('='*60)

    import xgboost as xgb
    device = 'cuda' if use_gpu else 'cpu'
    xgb_model = xgb.XGBClassifier(
        n_estimators=100, max_depth=6, learning_rate=0.1,
        device=device, tree_method='hist',
        eval_metric='mlogloss', n_jobs=-1,
        random_state=42,
        use_label_encoder=False
    )
    print(f'[XGB] Device: {device}')
    t0 = time.time()
    xgb_model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    xgb_train_time = time.time() - t0
    print(f'[XGB] Training time: {xgb_train_time:.1f}s')

    xgb_preds = xgb_model.predict(X_test)
    xgb_report = classification_report(y_test, xgb_preds, target_names=class_names, output_dict=True)
    xgb_f1 = f1_score(y_test, xgb_preds, average='weighted')

    print('\n[XGB] Classification Report:')
    print(classification_report(y_test, xgb_preds, target_names=class_names))
    print(f'[XGB] Confusion Matrix:\n{confusion_matrix(y_test, xgb_preds)}')
    print(f'[XGB] Weighted F1: {xgb_f1:.4f}')

    # ── Select winner ─────────────────────────────────────────────────────────
    print('\n' + '='*60)
    if rf_f1 >= xgb_f1:
        best_model = rf_model
        best_name = 'RandomForest'
        best_f1 = rf_f1
        best_report = rf_report
    else:
        best_model = xgb_model
        best_name = 'XGBoost'
        best_f1 = xgb_f1
        best_report = xgb_report

    print(f'  WINNER: {best_name} F1={best_f1:.4f}')
    print('='*60)

    # ── SHAP values ───────────────────────────────────────────────────────────
    print('\n[SHAP] Computing feature importance on test set (top 20)...')
    try:
        # Use a sample for speed
        sample_size = min(500, X_test.shape[0])
        X_sample = X_test[:sample_size]

        explainer = shap.TreeExplainer(best_model)
        shap_values_raw = explainer.shap_values(X_sample)

        # Handle all SHAP return formats
        if isinstance(shap_values_raw, list):
            # sklearn multi-class RF: list of (n_samples, n_features) arrays, one per class
            shap_abs = np.mean([np.abs(np.array(sv)) for sv in shap_values_raw], axis=0)
            mean_shap = shap_abs.mean(axis=0)
        elif hasattr(shap_values_raw, 'values'):
            # SHAP Explanation object
            sv = np.array(shap_values_raw.values)
            if sv.ndim == 3:  # (samples, features, classes)
                mean_shap = np.abs(sv).mean(axis=0).mean(axis=1)
            else:  # (samples, features)
                mean_shap = np.abs(sv).mean(axis=0)
        else:
            sv = np.array(shap_values_raw)
            if sv.ndim == 3:
                mean_shap = np.abs(sv).mean(axis=0).mean(axis=1)
            elif sv.ndim == 2:
                mean_shap = np.abs(sv).mean(axis=0)
            else:
                mean_shap = np.abs(sv)

        feat_shap = sorted(
            zip(selected_features, mean_shap.tolist()),
            key=lambda x: x[1], reverse=True
        )[:20]

        feature_importance = {feat: float(val) for feat, val in feat_shap}
        print('[SHAP] Top 10 features:')
        max_val = feat_shap[0][1] if feat_shap else 1.0
        for feat, val in feat_shap[:10]:
            bar = '█' * max(1, int(val * 30 / max(max_val, 1e-9)))
            print(f'  {feat:<35} {bar:<30} {val:.4f}')

    except Exception as e:
        print(f'[SHAP] Warning — SHAP computation failed: {e}. Falling back to feature_importances_.')
        # Fallback to sklearn .feature_importances_
        if hasattr(best_model, 'feature_importances_'):
            imp = best_model.feature_importances_
            feat_pairs = sorted(zip(selected_features, imp.tolist()), key=lambda x: x[1], reverse=True)[:20]
            feature_importance = {feat: float(val) for feat, val in feat_pairs}
            print('[SHAP] Using feature_importances_ as fallback:')
            for feat, val in feat_pairs[:10]:
                print(f'  {feat:<35} {val:.4f}')
        else:
            feature_importance = {f: round(1.0 / len(selected_features), 4) for f in selected_features[:20]}

    # ── Save artifacts ────────────────────────────────────────────────────────
    print('\n[SAVE] Saving model artifacts...')

    joblib.dump(best_model, MODEL_DIR / 'model.joblib')
    joblib.dump(scaler, MODEL_DIR / 'scaler.joblib')
    joblib.dump(le, MODEL_DIR / 'label_encoder.joblib')
    save_feature_list(selected_features, str(MODEL_DIR / 'features.json'))

    with open(MODEL_DIR / 'feature_importance.json', 'w') as f:
        json.dump(feature_importance, f, indent=2)

    accuracy = float(best_report.get('accuracy', 0.0))
    per_class_f1 = {
        cls: float(best_report[cls]['f1-score'])
        for cls in class_names
        if cls in best_report
    }

    metrics = {
        'model_name': best_name,
        'accuracy': accuracy,
        'weighted_f1': float(best_f1),
        'per_class_f1': per_class_f1,
        'training_timestamp': datetime.now(timezone.utc).isoformat(),
        'dataset_type': dataset_type,
        'hardware_used': hardware,
        'smote_applied': True,
        'n_features': len(selected_features),
        'class_names': class_names,
        'rf_f1': float(rf_f1),
        'xgb_f1': float(xgb_f1),
    }

    with open(MODEL_DIR / 'metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)

    print(f'\n[SAVE] All artifacts saved to {MODEL_DIR}/')
    print(f'  model.joblib              ({best_name})')
    print(f'  scaler.joblib')
    print(f'  label_encoder.joblib')
    print(f'  features.json             ({len(selected_features)} features)')
    print(f'  feature_importance.json   (top {len(feature_importance)} SHAP features)')
    print(f'  metrics.json')

    print(f'\n[ThreatMapX] Training complete.')
    print(f'[ThreatMapX] Model loaded: {best_name}, Accuracy: {accuracy*100:.1f}%, Dataset: {dataset_type}')


if __name__ == '__main__':
    main()
