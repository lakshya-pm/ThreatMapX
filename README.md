# 🌐 ThreatMapX
**Real-Time DDoS Attack Visualization System**

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![MIT License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)

ThreatMapX is a real-time, 3D WebGL-powered interactive visualization system for tracking and analyzing Distributed Denial of Service (DDoS) attacks. Driven by a Random Forest Classifier trained on the CIC-DDoS2019 dataset, the system bridges the gap between raw machine learning output and cybersecurity analyst workflows by offering geographic spatial context, live statistics, and immediate threat intelligence.

---

## 🚀 Key Features

*   **1. Interactive 3D Globe:** WebGL globe powered by `react-globe.gl` and `Three.js` with animated, comet-like attack arcs.
*   **2. Color-Coded Threat Indicators:** Visual classification by attack type: `SYN = Red`, `UDP = Orange`, `HTTP = Cyan`.
*   **3. Country Heatmap:** Dynamic base map glows based on attack frequency and intensity.
*   **4. Target Pulses:** Pulsing rings emerge at target geographic locations for high-impact visibility.
*   **5. Glassmorphism UI:** Click any active arc to bring up a detailed, blurred glassmorphism detail card.
*   **6. Global Threat Level:** Real-time calculated score (0-100) reflecting current spatial threat intensity.
*   **7. Live Analytics:** Dashboard displaying Attacks/min, Top Source, Top Target, and Peak Intensity.
*   **8. Protocol Breakdown:** Live percentage bar breaking down SYN vs UDP vs HTTP traffic.
*   **9. Custom Filters & Hotkeys:** Toggle specific vectors via UI buttons or keyboard shortcuts (S/U/H/A/Space).
*   **10. Cybersecurity RSS Feed:** Live news feed crawling BleepingComputer + The Hacker News (refreshes 60s).
*   **11. Dual Scrolling Tickers:** Simultaneous news feed and active attack log tickers.
*   **12. ML Detection Engine:** Collapsible side panel detailing real-time classification metrics.
*   **13. Session Footer:** Full system session tracking and technology credits.

---

## ⚙️ How It Works (Pipeline Architecture)

ThreatMapX processes continuous network events through a 3-layer architecture, achieving sub-second visualization latency from classification to rendering.

```text
+---------------------+      +---------------------+      +---------------------+
|  LAYER 1: ML (Offline)     |  LAYER 2: Streaming       |  LAYER 3: Frontend   |
+---------------------+      +---------------------+      +---------------------+
|                     |      |                     |      |                     |
|  CIC-DDoS2019 CSV   |      |  Node.js wsServer   |      |  Next.js + React    |
|         |           |      |          |          |      |         |           |
|         v           |      |          v          |      |         v           |
|  Random Forest      |      |  Loads attacks.json |      |  useWebSocket hook  |
|  Classifies Flows   | ---> |          |          | ---> |         |           |
|         |           |      |          v          |      |         v           |
|         v           |      |  Replays 1 event    |      |  react-globe.gl UI  |
|  GeoIP maps IPs to  |      |  per 1.5 seconds    |      |  State Components   |
|  lat/lng → JSON     |      |  via WebSocket      |      |  Reactive Updates   |
+---------------------+      +---------------------+      +---------------------+
```

---

## 🧠 ML Detection Model Details

ThreatMapX sits on top of a highly accurate flow-based detection model:
*   **Dataset:** `CIC-DDoS2019` (Canadian Institute for Cybersecurity, University of New Brunswick)
*   **Model:** Random Forest Classifier (`scikit-learn`)
*   **Accuracy:** `98.7%` on an 80/20 train-test split.
*   **Preprocessing:** SMOTE applied to handle class imbalance across attack vectors.
*   **Features Evaluated:** Packet rate, flow duration, total byte count, TCP flags, inter-arrival time (IAT).
*   **Target Classes:** SYN Flood, UDP Flood, HTTP Flood, Benign traffic.
*   *Note: As per the project proposal, the system currently simulates real-time conditions by streaming a labeled historical ML dataset via WebSockets. The architecture is modularly designed to support drop-in live feed alternatives.*

---

## 🔬 Research Gaps Addressed

This project directly addresses several gaps in current academic cybersecurity literature:

1.  **Gap 1: Lack of Real-Time Pipelines** -> Most ML papers evaluate offline CSV arrays. ThreatMapX implements a continuous WebSocket streaming layer.
2.  **Gap 2: Missing Analyst Visualizations** -> Transition from tabular ML terminal outputs to an interactive visual dashboard.
3.  **Gap 3: No Geographic Spatial Context** -> Maps otherwise arbitrary IP flows to global coordinates via GeoIP integration for spatial pattern recognition.

**Key Academic Drivers:**
> *Apostu et al. 2025 AI DDoS Survey* — Calls out real-time visualization dashboards as an open research direction.
> *Alashhab et al. 2024 Ensemble OML SDN* — Validates high-accuracy baseline (99.2% on CICDDoS2019).
> *CIC-DDoS2019* — University of New Brunswick standard benchmark dataset.

---

## 📊 Industry Comparison

| Feature | Kaspersky Cybermap | CheckPoint ThreatCloud | **ThreatMapX** |
| :--- | :--- | :--- | :--- |
| **ML Detection Details** | No (Proprietary) | No (Proprietary) | **Yes (RF)** |
| **Open Source** | No | No | **Yes** |
| **DDoS-Specific Focus** | No | No | **Yes** |
| **Attack Vector Classes** | No | No | **SYN / UDP / HTTP** |
| **Live News Intel Feed** | No | No | **Yes** |
| **Reproducible Pipeline** | No | No | **Yes** |
| **Interactive 3D Globe** | Yes (WebGL) | Yes (WebGL) | **Yes (WebGL)** |

---

## 🗂️ Project Structure

```text
ThreatMapX/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/news/route.ts
├── components/
│   ├── GlobeView.tsx
│   ├── AttackTable.tsx
│   ├── AttackDetail.tsx
│   ├── TopBar.tsx
│   └── FiltersBar.tsx
├── hooks/
│   └── useWebSocket.ts
├── data/
│   └── attacks.json
├── server/
│   └── wsServer.js
├── types/
│   └── attack.ts
└── README.md
```

---

## 🛠️ Getting Started

Follow these steps to run the visualization dashboard and the mock websocket stream locally.

```bash
# Clone the repository
git clone https://github.com/lakshya-pm/ThreatMapX.git

# Navigate to the project directory
cd ThreatMapX

# Install required dependencies
npm install

# Run the complete environment (Node WebSocket Server + Next.js App)
npm run dev:all
```
Once the dev environment is compiling, open [http://localhost:3000](http://localhost:3000) in your browser.

**Available Scripts:**
*   `npm run dev` → Runs the Next.js frontend only.
*   `npm run dev:ws` → Runs the Node WebSocket server locally on port 8080.
*   `npm run dev:all` → Uses `concurrently` to run both simultaneously. 

---

## 🗺️ Future Roadmap

*   **Live GeoIP Interface:** Move from dataset replay to processing live packet capture.
*   **Online Ensemble ML:** Implement continuous learning models (e.g., BernoulliNB + SGD + MLP).
*   **Real Network Taps:** Integrate directly with Scapy/libpcap.
*   **Alerting System:** Notifications and threshold triggers for SOC analysts.
*   **Automated Firewall Rules:** Dynamic iptables recommendations based on localized attacks.
*   **Adversarial Training:** Bolster model robustness against evasive DDoS perturbations.

---

## 🎓 Academic Context

**Mini Project** — Computer Engineering, AI/ML Specialization
*Semester 6* | Demonstrates: Cybersecurity + Machine Learning + Real-Time Distributed Systems

---

## ⚖️ License

This project is licensed under the MIT License - see the `LICENSE` file for details.

Built with Next.js · react-globe.gl · WebSocket · Machine Learning | ThreatMapX v1.0
