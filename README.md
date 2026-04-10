# ThreatMapX v2.0

> Production-grade SOC visualization platform for real-time DDoS detection.

**Real-time DDoS Detection & SOC Visualization**

[![Research Gaps](https://img.shields.io/badge/Research_Gaps-G1_G2_G3_G4_G5_G6-00d4ff)](.)
[![ML](https://img.shields.io/badge/ML-RandomForest%20%2F%20XGBoost-purple)](.)
[![Dataset](https://img.shields.io/badge/Dataset-CIC--DDoS2019-orange)](.)
[![SHAP](https://img.shields.io/badge/Explainability-SHAP-green)](.)

---

## Academic Context

ThreatMapX addresses **3 critical gaps** identified across 10 published DDoS detection papers:

| Gap | Problem | Solution |
|-----|---------|----------|
| **G1** | No real-time streaming pipeline | WebSocket/FastAPI live stream |
| **G2** | No interactive visualization frontend | 3D WebGL globe + SOC dashboard |
| **G3** | No geographic / spatial context | IP → geolocation mapping + country heatmap |
| **G4** | No SOC integration | MITRE ATT&CK mapping, analyst-facing UI |
| **G5** | No continuous ingestion | DataStreamer replay engine |
| **G6** | No model interpretability | SHAP feature importance per prediction |

---

## Architecture

```
frontend/          ← Next.js 14 + TypeScript + react-globe.gl
backend/
  ml/              ← Random Forest + XGBoost + SMOTE + SHAP
  data/            ← CIC-DDoS2019 loader + synthetic fallback + geo_mapper
  api/             ← FastAPI + WebSocket
```

---

## Quick Start

### Option A — Docker (recommended)

```bash
docker-compose up --build
```

Open http://localhost:3000

### Option B — Local Dev

**Backend:**
```bash
cd backend
pip install -r requirements.txt

# Train model (first time only — auto-runs on startup too)
python ml/train.py

# Start API
uvicorn api.main:app --reload --port 8000
```

**Frontend:**
```bash
# In repo root
cp frontend/.env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

---

## Real Data (CIC-DDoS2019)

1. Download CSVs from [UNB CIC-DDoS2019](https://www.unb.ca/cic/datasets/ddos-2019.html) (requires registration)
2. Place CSV files in `backend/data/cicddos2019/`
3. Delete `backend/ml/models/model.joblib` to force retrain
4. Restart backend — it auto-detects real data

The synthetic dataset matches CICFlowMeter's 62 features with realistic class distributions (SYN 40%, UDP 30%, HTTP 20%, BENIGN 10%).

---

## ML Pipeline

| Component | Detail |
|-----------|--------|
| Models | Random Forest (100 trees) + XGBoost (100 estimators) |
| Winner selection | Weighted F1 on 20% holdout |
| Preprocessing | VarianceThreshold → correlation filter → StandardScaler |
| Imbalance | SMOTE on training set only (O'Brien et al. 2023) |
| Explainability | SHAP TreeExplainer — top 20 features |
| Target accuracy | ≥98.7% (Alashhab et al. 2024) |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `S` | Filter SYN attacks |
| `U` | Filter UDP attacks |
| `H` | Filter HTTP attacks |
| `A` | Show all |
| `Space` | Pause / resume stream |
| `F` | Fullscreen globe |
| `T` | Toggle dark/light theme |
| `Esc` | Close panels |
| `?` | This help |

---

## Label Mapping (CIC-DDoS2019)

| Raw Label | Mapped Class | Reason |
|-----------|-------------|--------|
| `Syn` | `SYN` | TCP SYN flood |
| `UDP`, `UDPLag`, `DrDoS_DNS`, `DrDoS_NTP`, `DrDoS_SNMP`, `DrDoS_SSDP`, `DrDoS_LDAP`, `DrDoS_MSSQL`, `DrDoS_NetBIOS`, `DrDoS_Portmap`, `LDAP`, `MSSQL`, `NetBIOS`, `Portmap`, `TFTP` | `UDP` | UDP/amplification attacks |
| `WebDDoS` | `HTTP` | HTTP application-layer flood |
| `BENIGN` | `BENIGN` | Normal traffic |

> **Note:** DrDoS (Distributed Reflection DoS) attacks including LDAP/MSSQL/NetBIOS are UDP amplification attacks, NOT HTTP. Mapping them to HTTP is a labelling error found in some repos.

---

## References

- Shieh (2021), Apostu (2025), Abu Bakar (2023), Arafat (2025), Patil (2023)
- Sharma (2024), O'Brien (2023), Al-Turjman (2023), Patel (2024), Chen (2023)
- Alashhab et al. (2024) — target accuracy benchmark
- Dong & Sarem (2020) — severity formula
- MITRE ATT&CK: T1498.001, T1498.002, T1499.003
