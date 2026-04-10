'use client';
import { useState, useEffect } from 'react';
import { ModelMetrics } from '@/types/attack';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export function useModelMetrics(refreshIntervalMs = 30_000) {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API_URL}/api/metrics`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ModelMetrics;
        if (!cancelled) {
          setMetrics(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMetrics();
    const timer = setInterval(fetchMetrics, refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refreshIntervalMs]);

  return { metrics, loading, error };
}
