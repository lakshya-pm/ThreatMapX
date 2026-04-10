'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { AttackEvent, StreamStats } from '@/types/attack';

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws/attacks';
const MAX_BUFFER = 1000;
const BACKOFF_SEQUENCE = [1000, 2000, 4000, 8000, 30000];

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

export function useAttackStream(): UseAttackStreamReturn {
  const [attacks, setAttacks] = useState<AttackEvent[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isPaused, setIsPaused] = useState(false);
  const [stats, setStats] = useState<StreamStats>(DEFAULT_STATS);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndexRef = useRef(0);
  const isPausedRef = useRef(false);

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
        setConnectionStatus('disconnected');
        wsRef.current = null;
        const delay = BACKOFF_SEQUENCE[Math.min(backoffIndexRef.current, BACKOFF_SEQUENCE.length - 1)];
        backoffIndexRef.current = Math.min(backoffIndexRef.current + 1, BACKOFF_SEQUENCE.length - 1);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setConnectionStatus('disconnected');
      const delay = BACKOFF_SEQUENCE[0];
      reconnectTimerRef.current = setTimeout(connect, delay);
    }
  }, [computeStats]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connect]);

  const togglePause = useCallback(() => {
    setIsPaused(p => {
      isPausedRef.current = !p;
      return !p;
    });
  }, []);

  return {
    attacks,
    isConnected: connectionStatus === 'connected',
    connectionStatus,
    stats,
    isPaused,
    togglePause,
  };
}
