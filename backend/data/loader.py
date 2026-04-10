"""
data/loader.py — Smart Dataset Loader for ThreatMapX
Loads CIC-DDoS2019 CSVs if present, otherwise generates synthetic data.
"""
from __future__ import annotations

import glob
import os
import random
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

# ── CICFlowMeter 60-feature list ──────────────────────────────────────────────
FEATURES: list[str] = [
    'Flow Duration', 'Total Fwd Packets', 'Total Backward Packets',
    'Total Length of Fwd Packets', 'Total Length of Bwd Packets',
    'Fwd Packet Length Max', 'Fwd Packet Length Min',
    'Fwd Packet Length Mean', 'Bwd Packet Length Max',
    'Bwd Packet Length Min', 'Bwd Packet Length Mean',
    'Flow Bytes/s', 'Flow Packets/s', 'Flow IAT Mean', 'Flow IAT Std',
    'Flow IAT Max', 'Flow IAT Min', 'Fwd IAT Mean', 'Fwd IAT Std',
    'Bwd IAT Mean', 'Bwd IAT Std', 'Fwd PSH Flags', 'Bwd PSH Flags',
    'Fwd URG Flags', 'Bwd URG Flags', 'Fwd Header Length',
    'Bwd Header Length', 'Fwd Packets/s', 'Bwd Packets/s',
    'Min Packet Length', 'Max Packet Length', 'Packet Length Mean',
    'Packet Length Std', 'Packet Length Variance', 'FIN Flag Count',
    'SYN Flag Count', 'RST Flag Count', 'PSH Flag Count',
    'ACK Flag Count', 'URG Flag Count', 'CWE Flag Count',
    'ECE Flag Count', 'Down/Up Ratio', 'Average Packet Size',
    'Avg Fwd Segment Size', 'Avg Bwd Segment Size',
    'Subflow Fwd Packets', 'Subflow Fwd Bytes', 'Subflow Bwd Packets',
    'Subflow Bwd Bytes', 'Init_Win_bytes_forward',
    'Init_Win_bytes_backward', 'act_data_pkt_fwd',
    'min_seg_size_forward', 'Active Mean', 'Active Std', 'Active Max',
    'Active Min', 'Idle Mean', 'Idle Std', 'Idle Max', 'Idle Min'
]

# ── Label mapping ──────────────────────────────────────────────────────────────
# CIC-DDoS2019 raw labels → 3 attack classes + BENIGN
# DrDoS_ types are UDP amplification attacks — NOT HTTP.
LABEL_MAP: dict[str, str] = {
    # SYN flood
    'Syn': 'SYN',
    # UDP / Amplification / Reflection
    'UDP': 'UDP',
    'UDPLag': 'UDP',
    'DrDoS_DNS': 'UDP',
    'DrDoS_NTP': 'UDP',
    'DrDoS_SNMP': 'UDP',
    'DrDoS_SSDP': 'UDP',
    'DrDoS_LDAP': 'UDP',
    'DrDoS_MSSQL': 'UDP',
    'DrDoS_NetBIOS': 'UDP',
    'DrDoS_Portmap': 'UDP',
    'LDAP': 'UDP',
    'MSSQL': 'UDP',
    'NetBIOS': 'UDP',
    'Portmap': 'UDP',
    'TFTP': 'UDP',
    # Application-layer HTTP flood
    'WebDDoS': 'HTTP',
    # Benign
    'BENIGN': 'BENIGN',
}


def load_dataset(data_dir: str = './data/cicddos2019') -> pd.DataFrame:
    """
    Priority 1: Load real CIC-DDoS2019 CSVs if present in data_dir.
    Priority 2: Generate synthetic data if CSVs not found.
    Returns a DataFrame with 'Attack_Type' column and dataset_type attribute.
    """
    csv_files = glob.glob(f'{data_dir}/**/*.csv', recursive=True)

    if csv_files:
        print(f'[REAL DATA] Found {len(csv_files)} CSV file(s). Loading...')
        dfs: list[pd.DataFrame] = []
        for fp in csv_files:
            try:
                df_chunk = pd.read_csv(fp, encoding='latin-1', low_memory=False)
                # Strip whitespace from column names
                df_chunk.columns = df_chunk.columns.str.strip()
                dfs.append(df_chunk)
                print(f'  Loaded {len(df_chunk):,} rows from {Path(fp).name}')
            except Exception as e:
                print(f'  [WARN] Could not load {fp}: {e}')

        if not dfs:
            print('[WARN] All CSVs failed to load — falling back to synthetic.')
            return generate_synthetic_dataset()

        df = pd.concat(dfs, ignore_index=True)
        print(f'[REAL DATA] Total rows before cleaning: {len(df):,}')

        # Identify label column (CIC-DDoS2019 uses ' Label' with leading space)
        label_col: Optional[str] = None
        for candidate in ['Label', ' Label', 'label']:
            if candidate in df.columns:
                label_col = candidate
                break
        if label_col is None:
            raise ValueError(
                'Could not find label column in CSV. '
                f'Columns found: {list(df.columns)[:20]}'
            )

        # Map labels
        df['Attack_Type'] = df[label_col].astype(str).str.strip().map(LABEL_MAP)

        # Drop rows with unmapped labels
        unknown_before = df['Attack_Type'].isna().sum()
        if unknown_before > 0:
            unknown_labels = df.loc[df['Attack_Type'].isna(), label_col].unique()
            print(f'[WARN] Dropping {unknown_before:,} rows with unknown labels: {unknown_labels[:10]}')
        df = df[df['Attack_Type'].notna()].copy()

        # Drop non-feature columns
        drop_cols = [label_col, 'Flow ID', 'Source IP', 'Destination IP',
                     'Source Port', 'Destination Port', 'Protocol', 'Timestamp']
        df = df.drop(columns=[c for c in drop_cols if c in df.columns], errors='ignore')

        # Keep only known features that exist in the CSV
        available_features = [f for f in FEATURES if f in df.columns]
        df = df[available_features + ['Attack_Type']].copy()

        # Replace Inf / -Inf with NaN then drop
        df.replace([np.inf, -np.inf], np.nan, inplace=True)
        df.dropna(inplace=True)

        print(f'[REAL DATA] Rows after cleaning: {len(df):,}')
        print(f'[REAL DATA] Label distribution:\n{df["Attack_Type"].value_counts()}')
        df.attrs['dataset_type'] = 'real_cicddos2019'
        return df

    else:
        print(f'[INFO] No CSVs found in {data_dir} — generating synthetic dataset.')
        return generate_synthetic_dataset()


def generate_synthetic_dataset(n_samples: int = 200_000) -> pd.DataFrame:
    """
    Generates a synthetic CIC-DDoS2019-like dataset using realistic distributions.
    Class distribution: SYN 40%, UDP 30%, HTTP 20%, BENIGN 10%.
    """
    synthetic_path = Path('./data/synthetic_data.csv')
    if synthetic_path.exists():
        print('[SYNTHETIC] Loading cached synthetic_data.csv...')
        df = pd.read_csv(synthetic_path)
        df.attrs['dataset_type'] = 'synthetic'
        return df

    print(f'[SYNTHETIC] Generating {n_samples:,} synthetic samples...')
    rng = np.random.default_rng(42)

    class_sizes = {
        'SYN':    int(n_samples * 0.40),
        'UDP':    int(n_samples * 0.30),
        'HTTP':   int(n_samples * 0.20),
        'BENIGN': int(n_samples * 0.10),
    }
    # Ensure we hit exactly n_samples
    total_so_far = sum(class_sizes.values())
    class_sizes['SYN'] += n_samples - total_so_far

    rows: list[dict] = []

    for attack_type, size in class_sizes.items():
        # packets_per_sec ranges per class
        if attack_type == 'SYN':
            pps = rng.uniform(10_000, 80_000, size)
        elif attack_type == 'UDP':
            pps = rng.uniform(8_000, 60_000, size)
        elif attack_type == 'HTTP':
            pps = rng.uniform(5_000, 50_000, size)
        else:  # BENIGN
            pps = rng.uniform(10, 1_000, size)

        for i in range(size):
            row: dict[str, float | str] = {}
            p = float(pps[i])

            row['Flow Duration'] = float(rng.uniform(100, 120_000))
            row['Total Fwd Packets'] = float(rng.integers(1, 5000))
            row['Total Backward Packets'] = float(rng.integers(0, 3000))
            row['Total Length of Fwd Packets'] = float(rng.uniform(0, 5_000_000))
            row['Total Length of Bwd Packets'] = float(rng.uniform(0, 3_000_000))
            row['Fwd Packet Length Max'] = float(rng.uniform(20, 1500))
            row['Fwd Packet Length Min'] = float(rng.uniform(20, 60))
            row['Fwd Packet Length Mean'] = float(rng.uniform(20, 800))
            row['Bwd Packet Length Max'] = float(rng.uniform(0, 1500))
            row['Bwd Packet Length Min'] = float(rng.uniform(0, 60))
            row['Bwd Packet Length Mean'] = float(rng.uniform(0, 800))
            row['Flow Bytes/s'] = float(p * rng.uniform(40, 1500))
            row['Flow Packets/s'] = p
            row['Flow IAT Mean'] = float(rng.uniform(0, 5000))
            row['Flow IAT Std'] = float(rng.uniform(0, 3000))
            row['Flow IAT Max'] = float(rng.uniform(0, 100_000))
            row['Flow IAT Min'] = float(rng.uniform(0, 500))
            row['Fwd IAT Mean'] = float(rng.uniform(0, 5000))
            row['Fwd IAT Std'] = float(rng.uniform(0, 3000))
            row['Bwd IAT Mean'] = float(rng.uniform(0, 5000))
            row['Bwd IAT Std'] = float(rng.uniform(0, 3000))

            # Attack-specific flags
            if attack_type == 'SYN':
                row['Fwd PSH Flags'] = 0.0
                row['Bwd PSH Flags'] = 0.0
                row['SYN Flag Count'] = float(rng.integers(1, 10))
                row['ACK Flag Count'] = 0.0
                row['FIN Flag Count'] = 0.0
            elif attack_type == 'UDP':
                row['Fwd PSH Flags'] = 0.0
                row['Bwd PSH Flags'] = 0.0
                row['SYN Flag Count'] = 0.0
                row['ACK Flag Count'] = 0.0
                row['FIN Flag Count'] = 0.0
            elif attack_type == 'HTTP':
                row['Fwd PSH Flags'] = float(rng.integers(0, 3))
                row['Bwd PSH Flags'] = float(rng.integers(0, 2))
                row['SYN Flag Count'] = float(rng.integers(0, 2))
                row['ACK Flag Count'] = float(rng.integers(1, 8))
                row['FIN Flag Count'] = float(rng.integers(0, 2))
            else:  # BENIGN
                row['Fwd PSH Flags'] = float(rng.integers(0, 2))
                row['Bwd PSH Flags'] = float(rng.integers(0, 1))
                row['SYN Flag Count'] = float(rng.integers(0, 2))
                row['ACK Flag Count'] = float(rng.integers(0, 5))
                row['FIN Flag Count'] = float(rng.integers(0, 2))

            row['Fwd URG Flags'] = 0.0
            row['Bwd URG Flags'] = 0.0
            row['Fwd Header Length'] = float(rng.uniform(20, 60))
            row['Bwd Header Length'] = float(rng.uniform(0, 60))
            row['Fwd Packets/s'] = p * rng.uniform(0.4, 0.8)
            row['Bwd Packets/s'] = p * rng.uniform(0.0, 0.4)
            row['Min Packet Length'] = float(rng.uniform(20, 60))
            row['Max Packet Length'] = float(rng.uniform(60, 1500))
            row['Packet Length Mean'] = float(rng.uniform(40, 800))
            row['Packet Length Std'] = float(rng.uniform(0, 400))
            row['Packet Length Variance'] = row['Packet Length Std'] ** 2
            row['RST Flag Count'] = float(rng.integers(0, 2))
            row['PSH Flag Count'] = float(row['Fwd PSH Flags'] + row['Bwd PSH Flags'])
            row['URG Flag Count'] = 0.0
            row['CWE Flag Count'] = 0.0
            row['ECE Flag Count'] = 0.0
            row['Down/Up Ratio'] = float(rng.uniform(0, 2))
            row['Average Packet Size'] = row['Packet Length Mean']
            row['Avg Fwd Segment Size'] = row['Fwd Packet Length Mean']
            row['Avg Bwd Segment Size'] = row['Bwd Packet Length Mean']
            row['Subflow Fwd Packets'] = row['Total Fwd Packets']
            row['Subflow Fwd Bytes'] = row['Total Length of Fwd Packets']
            row['Subflow Bwd Packets'] = row['Total Backward Packets']
            row['Subflow Bwd Bytes'] = row['Total Length of Bwd Packets']
            row['Init_Win_bytes_forward'] = float(rng.integers(-1, 65535))
            row['Init_Win_bytes_backward'] = float(rng.integers(-1, 65535))
            row['act_data_pkt_fwd'] = float(rng.integers(0, 100))
            row['min_seg_size_forward'] = float(rng.uniform(8, 32))
            row['Active Mean'] = float(rng.uniform(0, 1_000_000))
            row['Active Std'] = float(rng.uniform(0, 500_000))
            row['Active Max'] = float(rng.uniform(0, 2_000_000))
            row['Active Min'] = float(rng.uniform(0, 500_000))
            row['Idle Mean'] = float(rng.uniform(0, 1_000_000))
            row['Idle Std'] = float(rng.uniform(0, 500_000))
            row['Idle Max'] = float(rng.uniform(0, 2_000_000))
            row['Idle Min'] = float(rng.uniform(0, 500_000))
            row['Attack_Type'] = attack_type
            rows.append(row)

    df = pd.DataFrame(rows)
    # Shuffle
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    # Save for caching
    synthetic_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(synthetic_path, index=False)
    print(f'[SYNTHETIC] Saved to {synthetic_path}')
    print(f'[SYNTHETIC] Label distribution:\n{df["Attack_Type"].value_counts()}')

    df.attrs['dataset_type'] = 'synthetic'
    return df
