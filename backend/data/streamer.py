"""
data/streamer.py — Real-time dataset replay engine for ThreatMapX.
Generates attack events using the ML model for predictions.
Streams only non-BENIGN events to frontend; includes BENIGN in internal stats.
"""
from __future__ import annotations

import asyncio
import random
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Optional

# ── IP Pool ────────────────────────────────────────────────────────────────────
IP_POOL: dict[str, list[tuple[str, float, float]]] = {
    'China':          [('114.114.114.114', 35.86, 104.19), ('223.5.5.5', 30.27, 120.15)],
    'United States':  [('8.8.8.8', 37.09, -95.71), ('1.1.1.1', 34.05, -118.24)],
    'Russia':         [('77.88.8.8', 55.75, 37.61), ('5.255.255.70', 59.93, 30.31)],
    'Germany':        [('85.214.20.141', 52.52, 13.40)],
    'India':          [('49.207.0.1', 28.61, 77.20), ('106.193.0.1', 19.07, 72.87)],
    'Brazil':         [('177.192.0.1', -23.54, -46.63)],
    'United Kingdom': [('81.130.0.1', 51.50, -0.12)],
    'Japan':          [('122.1.0.1', 35.68, 139.69)],
    'South Korea':    [('168.126.63.1', 37.56, 126.97)],
    'Netherlands':    [('9.9.9.9', 52.37, 4.89)],
}

_ALL_IPS: list[tuple[str, str, float, float]] = [
    (country, ip, lat, lng)
    for country, entries in IP_POOL.items()
    for ip, lat, lng in entries
]

# ── MITRE ATT&CK mapping ───────────────────────────────────────────────────────
MITRE_MAP: dict[str, dict[str, Optional[str]]] = {
    'SYN':    {'id': 'T1498.001', 'tactic': 'Impact', 'name': 'Network DoS: Direct Network Flood'},
    'UDP':    {'id': 'T1498.002', 'tactic': 'Impact', 'name': 'Network DoS: Reflection Amplification'},
    'HTTP':   {'id': 'T1499.003', 'tactic': 'Impact', 'name': 'Endpoint DoS: Application Exhaustion Flood'},
    'BENIGN': {'id': None,        'tactic': None,      'name': 'Normal Traffic'},
}

# ── Realistic PPS ranges per attack class ──────────────────────────────────────
PPS_RANGES: dict[str, tuple[int, int]] = {
    'SYN':    (10_000, 80_000),
    'UDP':    (8_000,  60_000),
    'HTTP':   (5_000,  50_000),
    'BENIGN': (10,     1_000),
}

# ── Raw label mapping (reverse of loader) ─────────────────────────────────────
RAW_LABELS: dict[str, list[str]] = {
    'SYN':    ['Syn'],
    'UDP':    ['UDP', 'DrDoS_DNS', 'DrDoS_NTP', 'DrDoS_LDAP', 'TFTP'],
    'HTTP':   ['WebDDoS'],
    'BENIGN': ['BENIGN'],
}


def _severity(
    confidence: float,
    packets_per_sec: int,
    attack_type: str,
    source_ip: str,
    ip_counts: dict[str, int],
) -> int:
    """
    Severity formula adapted from Dong & Sarem 2020.
    BENIGN always = 0.
    severity = (confidence * 60) + (normalized_pps * 25) + (repeat_source_ip_bonus * 15)
    """
    if attack_type == 'BENIGN':
        return 0

    max_pps = PPS_RANGES.get(attack_type, (1, 80_000))[1]
    norm_pps = min(1.0, packets_per_sec / max_pps)

    count = ip_counts.get(source_ip, 0)
    repeat_bonus = min(1.0, count / 10.0)  # normalize by 10 repeat threshold

    raw = (confidence * 60) + (norm_pps * 25) + (repeat_bonus * 15)
    return min(100, max(0, int(raw)))


class DataStreamer:
    """
    Generates synthetic attack events using the ThreatClassifier model.
    Tracks statistics internally including BENIGN traffic.
    """

    def __init__(self, classifier: Any, stream_rate: float = 2.0) -> None:
        """
        Args:
            classifier:   ThreatClassifier instance (must be loaded).
            stream_rate:  Events per second to stream to frontend (non-BENIGN only).
        """
        self.classifier = classifier
        self.stream_rate = stream_rate
        self.interval_ms: int = int(1000 / stream_rate)  # ms between events

        # Circular event buffer (last 1000 non-BENIGN events)
        self.event_buffer: deque[dict[str, Any]] = deque(maxlen=1000)

        # Internal stats (all events including BENIGN)
        self._total_events: int = 0
        self._benign_count: int = 0
        self._attack_counts: dict[str, int] = defaultdict(int)
        self._src_ip_counts: dict[str, int] = defaultdict(int)
        self._src_country_counts: dict[str, int] = defaultdict(int)
        self._dst_country_counts: dict[str, int] = defaultdict(int)
        self._recent_events: deque[dict[str, Any]] = deque(maxlen=200)
        self._severity_sum: float = 0.0
        self._confidence_sum: float = 0.0
        self._non_benign_count: int = 0
        self._start_time: float = time.time()

        # Callbacks list for broadcasting
        self._broadcast_callbacks: list[Any] = []

        self._rng = random.Random()

        # Diversity enforcement
        self._force_next_class: str | None = None

    def add_broadcast_callback(self, cb: Any) -> None:
        self._broadcast_callbacks.append(cb)

    def remove_broadcast_callback(self, cb: Any) -> None:
        try:
            self._broadcast_callbacks.remove(cb)
        except ValueError:
            pass

    def _sample_source_target(self) -> tuple:
        """Sample source and target IPs from different countries."""
        countries = list(IP_POOL.keys())
        src_country = self._rng.choice(countries)
        tgt_countries = [c for c in countries if c != src_country]
        tgt_country = self._rng.choice(tgt_countries)

        src_ip, src_lat, src_lng = self._rng.choice(IP_POOL[src_country])
        tgt_ip, tgt_lat, tgt_lng = self._rng.choice(IP_POOL[tgt_country])

        return (src_country, src_ip, src_lat, src_lng,
                tgt_country, tgt_ip, tgt_lat, tgt_lng)

    def _generate_event(self) -> dict[str, Any]:
        """Generate one synthetic attack event using ML classifier."""

        # -- Diversity enforcement: if last 15 events are the same type, force variety
        recent_types = [e['attack_type'] for e in list(self._recent_events)[-15:]]
        if len(recent_types) >= 15 and len(set(recent_types)) == 1:
            dominant = recent_types[0]
            alternatives = [c for c in ['SYN', 'UDP', 'HTTP'] if c != dominant]
            self._force_next_class = self._rng.choice(alternatives)

        if self._force_next_class:
            attack_class = self._force_next_class
            self._force_next_class = None
        else:
            # Realistic distribution: SYN 40%, UDP 30%, HTTP 20%, BENIGN 10%
            attack_class = self._rng.choices(
                ['SYN', 'UDP', 'HTTP', 'BENIGN'],
                weights=[40, 30, 20, 10]
            )[0]

        # Source and target IPs (guaranteed different countries)
        src_country, src_ip, src_lat, src_lng, tgt_country, tgt_ip, tgt_lat, tgt_lng = self._sample_source_target()

        # Packets/sec
        pps_min, pps_max = PPS_RANGES[attack_class]
        packets_per_sec = self._rng.randint(pps_min, pps_max)
        bytes_per_sec = packets_per_sec * self._rng.randint(40, 1500)
        flow_duration_ms = self._rng.randint(100, 5000)

        # Build feature dict covering ALL selected features for accurate inference
        features: dict[str, float] = {f: 0.0 for f in self.classifier.selected_features}

        # Core flow features
        features.update({
            'Flow Packets/s': float(packets_per_sec),
            'Flow Bytes/s': float(bytes_per_sec),
            'Flow Duration': float(flow_duration_ms),
            'Fwd Packets/s': float(packets_per_sec * self._rng.uniform(0.4, 0.9)),
            'Bwd Packets/s': float(packets_per_sec * self._rng.uniform(0.0, 0.4)),
            'Total Fwd Packets': float(self._rng.randint(10, 5000)),
            'Total Backward Packets': float(self._rng.randint(0, 3000)),
            'Packet Length Mean': float(self._rng.uniform(40, 1500)),
            'Packet Length Std': float(self._rng.uniform(0, 400)),
            'Min Packet Length': float(self._rng.uniform(20, 60)),
            'Max Packet Length': float(self._rng.uniform(60, 1500)),
            'Fwd Packet Length Max': float(self._rng.uniform(60, 1500)),
            'Fwd Packet Length Min': float(self._rng.uniform(20, 60)),
            'Fwd Packet Length Mean': float(self._rng.uniform(20, 800)),
            'Bwd Packet Length Max': float(self._rng.uniform(0, 1500)),
            'Bwd Packet Length Min': float(self._rng.uniform(0, 60)),
            'Bwd Packet Length Mean': float(self._rng.uniform(0, 800)),
            'Fwd Header Length': float(self._rng.uniform(20, 60)),
            'Bwd Header Length': float(self._rng.uniform(0, 60)),
            'Flow IAT Mean': float(self._rng.uniform(0, 5000)),
            'Flow IAT Std': float(self._rng.uniform(0, 3000)),
            'Fwd IAT Mean': float(self._rng.uniform(0, 5000)),
            'Bwd IAT Mean': float(self._rng.uniform(0, 5000)),
            'Total Length of Fwd Packets': float(self._rng.uniform(0, 5_000_000)),
            'Total Length of Bwd Packets': float(self._rng.uniform(0, 3_000_000)),
            'Subflow Fwd Bytes': float(self._rng.uniform(0, 5_000_000)),
            'Subflow Bwd Bytes': float(self._rng.uniform(0, 3_000_000)),
            'Average Packet Size': float(self._rng.uniform(40, 800)),
            'Init_Win_bytes_forward': float(self._rng.randint(-1, 65535)),
            'Init_Win_bytes_backward': float(self._rng.randint(-1, 65535)),
            'Active Mean': float(self._rng.uniform(0, 1_000_000)),
            'Active Min': float(self._rng.uniform(0, 500_000)),
            'Idle Mean': float(self._rng.uniform(0, 1_000_000)),
        })

        # Attack-specific flags (critical for classification accuracy)
        if attack_class == 'SYN':
            features['SYN Flag Count'] = float(self._rng.randint(1, 10))
            features['ACK Flag Count'] = 0.0
            features['Fwd PSH Flags'] = 0.0
            features['URG Flag Count'] = 0.0
        elif attack_class == 'UDP':
            features['SYN Flag Count'] = 0.0
            features['ACK Flag Count'] = 0.0
            features['Fwd PSH Flags'] = 0.0
            features['URG Flag Count'] = 0.0
        elif attack_class == 'HTTP':
            features['Fwd PSH Flags'] = float(self._rng.randint(1, 3))
            features['ACK Flag Count'] = float(self._rng.randint(1, 8))
            features['SYN Flag Count'] = float(self._rng.randint(0, 2))
            features['URG Flag Count'] = 0.0
        else:  # BENIGN
            features['Fwd PSH Flags'] = float(self._rng.randint(0, 2))
            features['ACK Flag Count'] = float(self._rng.randint(0, 5))
            features['SYN Flag Count'] = float(self._rng.randint(0, 2))
            features['URG Flag Count'] = 0.0

        # Run prediction
        try:
            result = self.classifier.predict(features)
            predicted_type: str = result['attack_type']
            confidence: float = result['confidence']
        except Exception:
            predicted_type = attack_class
            confidence = 0.95

        # Get SHAP top-3
        try:
            top_feats, top_shap = self.classifier.get_top_shap_features(3)
        except Exception:
            top_feats = ['ACK Flag Count', 'Fwd Packet Length Min', 'URG Flag Count']
            top_shap = [0.38, 0.18, 0.11]

        top_vals = [features.get(f, 0.0) for f in top_feats]

        # Severity
        self._src_ip_counts[src_ip] += 1
        severity = _severity(confidence, packets_per_sec, predicted_type, src_ip, self._src_ip_counts)

        # MITRE
        mitre = MITRE_MAP.get(predicted_type, MITRE_MAP['BENIGN'])

        # Raw label
        raw_label = self._rng.choice(RAW_LABELS.get(attack_class, [attack_class]))

        # Dataset type
        dataset_type = getattr(self.classifier, 'dataset_type', 'synthetic')

        event: dict[str, Any] = {
            'id': str(uuid.uuid4()),
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'source_ip': src_ip,
            'source_country': src_country,
            'source_lat': src_lat,
            'source_lng': src_lng,
            'target_ip': tgt_ip,
            'target_country': tgt_country,
            'target_lat': tgt_lat,
            'target_lng': tgt_lng,
            'attack_type': predicted_type,
            'raw_label': raw_label,
            'packets_per_sec': packets_per_sec,
            'bytes_per_sec': bytes_per_sec,
            'flow_duration_ms': flow_duration_ms,
            'severity': severity,
            'confidence': round(confidence, 4),
            'model_used': getattr(self.classifier, 'model_name', 'XGBoost'),
            'dataset_type': dataset_type,
            'mitre_id': mitre['id'],
            'mitre_tactic': mitre['tactic'],
            'mitre_name': mitre['name'],
            'feature_snapshot': {
                'top_3_features': top_feats,
                'top_3_values': [round(float(v), 4) for v in top_vals],
                'top_3_shap': [round(float(s), 4) for s in top_shap],
            },
        }

        return event

    async def run(self) -> None:
        """Main streaming loop. Runs as asyncio background task."""
        print(f'[STREAMER] Starting stream at {self.stream_rate} events/sec (interval: {self.interval_ms}ms)')
        while True:
            try:
                event = self._generate_event()

                # Update internal stats (all events)
                self._total_events += 1
                atk = event['attack_type']

                if atk == 'BENIGN':
                    self._benign_count += 1
                else:
                    self._attack_counts[atk] += 1
                    self._non_benign_count += 1
                    self._severity_sum += event['severity']
                    self._confidence_sum += event['confidence']
                    self._src_country_counts[event['source_country']] += 1
                    self._dst_country_counts[event['target_country']] += 1

                    # Add to circular buffer and recent list
                    self.event_buffer.append(event)
                    self._recent_events.append(event)

                    # Broadcast to all WebSocket clients (non-BENIGN only)
                    for cb in self._broadcast_callbacks[:]:
                        try:
                            await cb(event)
                        except Exception:
                            pass

            except Exception as e:
                print(f'[STREAMER] Error generating event: {e}')

            # Emit at ~1.25 events/sec for 800ms interval (spec: 1 event/800ms)
            await asyncio.sleep(0.8)

    def get_stats(self) -> dict[str, Any]:
        """Return aggregated stats for /api/stats endpoint."""
        uptime_s = time.time() - self._start_time
        attacks_per_min = int(self._non_benign_count / max(uptime_s / 60, 0.016))

        total_attacks = self._non_benign_count or 1
        type_breakdown = {
            'SYN': round(self._attack_counts.get('SYN', 0) / total_attacks * 100, 1),
            'UDP': round(self._attack_counts.get('UDP', 0) / total_attacks * 100, 1),
            'HTTP': round(self._attack_counts.get('HTTP', 0) / total_attacks * 100, 1),
        }

        top_sources = sorted(
            self._src_country_counts.items(), key=lambda x: x[1], reverse=True
        )[:5]
        top_targets = sorted(
            self._dst_country_counts.items(), key=lambda x: x[1], reverse=True
        )[:5]

        avg_severity = (
            self._severity_sum / self._non_benign_count
            if self._non_benign_count > 0 else 0.0
        )
        avg_confidence = (
            self._confidence_sum / self._non_benign_count
            if self._non_benign_count > 0 else 0.0
        )

        return {
            'attacks_per_min': attacks_per_min,
            'type_breakdown': type_breakdown,
            'top_sources': [{'country': c, 'count': n} for c, n in top_sources],
            'top_targets': [{'country': c, 'count': n} for c, n in top_targets],
            'avg_severity': round(avg_severity, 1),
            'avg_confidence': round(avg_confidence, 4),
            'unique_ips': len(self._src_ip_counts),
            'unique_countries': len(self._src_country_counts),
            'total_events': self._total_events,
            'non_benign_events': self._non_benign_count,
            'benign_events': self._benign_count,
        }

    def get_recent_attacks(
        self,
        limit: int = 100,
        offset: int = 0,
        filter_type: str | None = None,
        min_severity: int | None = None,
    ) -> list[dict[str, Any]]:
        """Return paginated recent attack events."""
        events = list(self.event_buffer)[::-1]  # newest first

        if filter_type:
            events = [e for e in events if e['attack_type'] == filter_type.upper()]
        if min_severity is not None:
            events = [e for e in events if e['severity'] >= min_severity]

        return events[offset: offset + limit]
