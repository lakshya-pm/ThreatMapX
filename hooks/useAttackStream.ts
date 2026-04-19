'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { AttackEvent, StreamStats } from '@/types/attack';

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'demo';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws/attacks';
const MAX_BUFFER = 1000;
const BACKOFF_SEQUENCE = [1000, 2000, 4000, 8000, 30000];
const DEMO_FALLBACK_AFTER = 3; // switch to demo after 3 failed reconnects

interface UseAttackStreamReturn {
  attacks: AttackEvent[];
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  stats: StreamStats;
  isPaused: boolean;
  togglePause: () => void;
}

const DEFAULT_STATS: StreamStats = {
  attacks_per_min: 0,
  type_breakdown: { SYN: 0, UDP: 0, HTTP: 0 },
  top_sources: [],
  top_targets: [],
  avg_severity: 0,
  avg_confidence: 0,
  unique_ips: 0,
  unique_countries: 0,
  total_events: 0,
};

// ── Mock data generator for demo/deployed mode ────────────────────────────────
const REGIONS = [
  { name: 'China',          lat: 35.86,  lng: 104.19, ips: ['114.114.114.114', '223.5.5.5'] },
  { name: 'United States',  lat: 37.09,  lng: -95.71, ips: ['8.8.8.8', '1.1.1.1'] },
  { name: 'Russia',         lat: 55.75,  lng: 37.61,  ips: ['77.88.8.8', '5.255.255.70'] },
  { name: 'Germany',        lat: 52.52,  lng: 13.40,  ips: ['85.214.20.141'] },
  { name: 'India',          lat: 28.61,  lng: 77.20,  ips: ['49.207.0.1', '106.193.0.1'] },
  { name: 'Brazil',         lat: -23.54, lng: -46.63, ips: ['177.192.0.1'] },
  { name: 'United Kingdom', lat: 51.50,  lng: -0.12,  ips: ['81.130.0.1'] },
  { name: 'Japan',          lat: 35.68,  lng: 139.69, ips: ['122.1.0.1'] },
  { name: 'South Korea',    lat: 37.56,  lng: 126.97, ips: ['168.126.63.1'] },
  { name: 'Netherlands',    lat: 52.37,  lng: 4.89,   ips: ['9.9.9.9'] },
];

const MITRE_MAP: Record<string, { id: string; tactic: string; name: string }> = {
  SYN:  { id: 'T1498.001', tactic: 'Impact', name: 'Network DoS: Direct Network Flood' },
  UDP:  { id: 'T1498.002', tactic: 'Impact', name: 'Network DoS: Reflection Amplification' },
  HTTP: { id: 'T1499.003', tactic: 'Impact', name: 'Endpoint DoS: Application Exhaustion Flood' },
};

const RAW_LABELS: Record<string, string[]> = {
  SYN: ['Syn'], UDP: ['UDP', 'DrDoS_DNS', 'DrDoS_NTP'], HTTP: ['WebDDoS'],
};

const SHAP_FEATURES = [
  'SYN Flag Count', 'Flow Packets/s', 'Flow Bytes/s', 'Fwd PSH Flags',
  'ACK Flag Count', 'Bwd Packet Length Mean', 'Packet Size Entropy',
];

function generateMockAttack(): AttackEvent {
  const types: Array<'SYN' | 'UDP' | 'HTTP'> = ['SYN', 'UDP', 'HTTP'];
  const r = Math.random();
  const attack_type = r < 0.4 ? types[0] : r < 0.7 ? types[1] : types[2];

  const src = REGIONS[Math.floor(Math.random() * REGIONS.length)];
  let tgt = REGIONS[Math.floor(Math.random() * REGIONS.length)];
  while (tgt.name === src.name) tgt = REGIONS[Math.floor(Math.random() * REGIONS.length)];

  const jitter = () => (Math.random() - 0.5) * 6;
  const pps = Math.floor(5000 + Math.random() * 75000);
  const conf = 0.75 + Math.random() * 0.24;
  const severity = Math.min(100, Math.floor(30 + (pps / 80000) * 50 + Math.random() * 20));
  const mitre = MITRE_MAP[attack_type];
  const top3feats = SHAP_FEATURES.slice(0, 3);

  return {
    id: `demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    source_ip: src.ips[Math.floor(Math.random() * src.ips.length)],
    source_country: src.name,
    source_lat: src.lat + jitter(),
    source_lng: src.lng + jitter(),
    target_ip: tgt.ips[Math.floor(Math.random() * tgt.ips.length)],
    target_country: tgt.name,
    target_lat: tgt.lat + jitter(),
    target_lng: tgt.lng + jitter(),
    attack_type,
    raw_label: RAW_LABELS[attack_type][Math.floor(Math.random() * RAW_LABELS[attack_type].length)],
    packets_per_sec: pps,
    bytes_per_sec: pps * Math.floor(40 + Math.random() * 1460),
    flow_duration_ms: Math.floor(100 + Math.random() * 5000),
    severity,
    confidence: parseFloat(conf.toFixed(4)),
    model_used: Math.random() > 0.5 ? 'XGBoost' : 'RandomForest',
    dataset_type: 'synthetic',
    mitre_id: mitre.id,
    mitre_tactic: mitre.tactic,
    mitre_name: mitre.name,
    feature_snapshot: {
      top_3_features: top3feats,
      top_3_values: top3feats.map(() => parseFloat((Math.random() * 50000).toFixed(2))),
      top_3_shap: [0.42, 0.28, 0.15],
    },
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAttackStream(): UseAttackStreamReturn {
  const [attacks, setAttacks] = useState<AttackEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isPaused, setIsPaused] = useState(false);
  const [stats, setStats] = useState<StreamStats>(DEFAULT_STATS);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backoffIndexRef = useRef(0);
  const isPausedRef = useRef(false);
  const failCountRef = useRef(0);

  // Compute stats from local attack buffer
  const computeStats = useCallback((buf: AttackEvent[]): StreamStats => {
    const now = Date.now();
    const lastMin = buf.filter(a => now - new Date(a.timestamp).getTime() < 60_000);
    const sources: Record<string, number> = {};
    const targets: Record<string, number> = {};
    const srcIps = new Set<string>();
    const srcCountries = new Set<string>();
    let synCount = 0, udpCount = 0, httpCount = 0;
    let sevSum = 0, confSum = 0;

    buf.forEach(a => {
      sources[a.source_country] = (sources[a.source_country] ?? 0) + 1;
      targets[a.target_country] = (targets[a.target_country] ?? 0) + 1;
      srcIps.add(a.source_ip);
      srcCountries.add(a.source_country);
      if (a.attack_type === 'SYN') synCount++;
      else if (a.attack_type === 'UDP') udpCount++;
      else if (a.attack_type === 'HTTP') httpCount++;
      sevSum += a.severity;
      confSum += a.confidence;
    });

    const total = synCount + udpCount + httpCount || 1;
    const n = buf.length || 1;

    const topSources = Object.entries(sources)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([country, count]) => ({ country, count }));
    const topTargets = Object.entries(targets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([country, count]) => ({ country, count }));

    return {
      attacks_per_min: lastMin.length,
      type_breakdown: {
        SYN: Math.round((synCount / total) * 100),
        UDP: Math.round((udpCount / total) * 100),
        HTTP: Math.round((httpCount / total) * 100),
      },
      top_sources: topSources,
      top_targets: topTargets,
      avg_severity: Math.round(sevSum / n),
      avg_confidence: parseFloat((confSum / n).toFixed(4)),
      unique_ips: srcIps.size,
      unique_countries: srcCountries.size,
      total_events: buf.length,
    };
  }, []);

  // ── Demo mode: generate mock attacks locally ────────────────────────────────
  const startDemoMode = useCallback(() => {
    if (demoTimerRef.current) return; // already running
    setConnectionStatus('demo');

    // Burst 8 initial events
    const burst = Array.from({ length: 8 }, generateMockAttack);
    setAttacks(burst);
    setStats(computeStats(burst));

    demoTimerRef.current = setInterval(() => {
      if (isPausedRef.current) return;
      const newAtk = generateMockAttack();
      setAttacks(prev => {
        const next = [newAtk, ...prev].slice(0, MAX_BUFFER);
        setStats(computeStats(next));
        return next;
      });
    }, 1500);
  }, [computeStats]);

  const stopDemoMode = useCallback(() => {
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }
  }, []);

  // ── WebSocket connection ────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return;

    setConnectionStatus('reconnecting');

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        backoffIndexRef.current = 0;
        failCountRef.current = 0;
        stopDemoMode(); // kill demo if WS connects
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        if (isPausedRef.current) return;
        try {
          const data = JSON.parse(event.data as string) as Record<string, unknown>;
          // Skip heartbeat pings
          if (data.type === 'heartbeat') return;
          // Direct event object (new backend) or wrapped {type: 'attack', data: {...}}
          const attackData: AttackEvent = (data.attack_type !== undefined
            ? data
            : data.data) as AttackEvent;

          if (!attackData?.id) return;

          setAttacks(prev => {
            const next = [attackData, ...prev].slice(0, MAX_BUFFER);
            // Update stats derived from buffer
            setStats(computeStats(next));
            return next;
          });
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        failCountRef.current++;

        // After N failed attempts, switch to demo mode
        if (failCountRef.current >= DEMO_FALLBACK_AFTER) {
          startDemoMode();
          return;
        }

        setConnectionStatus('disconnected');
        const delay = BACKOFF_SEQUENCE[Math.min(backoffIndexRef.current, BACKOFF_SEQUENCE.length - 1)];
        backoffIndexRef.current = Math.min(backoffIndexRef.current + 1, BACKOFF_SEQUENCE.length - 1);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      failCountRef.current++;
      if (failCountRef.current >= DEMO_FALLBACK_AFTER) {
        startDemoMode();
        return;
      }
      setConnectionStatus('disconnected');
      const delay = BACKOFF_SEQUENCE[0];
      reconnectTimerRef.current = setTimeout(connect, delay);
    }
  }, [computeStats, startDemoMode, stopDemoMode]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      stopDemoMode();
    };
  }, [connect, stopDemoMode]);

  const togglePause = useCallback(() => {
    setIsPaused(p => {
      isPausedRef.current = !p;
      return !p;
    });
  }, []);

  return {
    attacks,
    isConnected: connectionStatus === 'connected' || connectionStatus === 'demo',
    connectionStatus,
    stats,
    isPaused,
    togglePause,
  };
}
