'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Activity, Globe2, Cpu } from 'lucide-react';
import { StreamStats } from '@/types/attack';

interface KPICardsProps {
  stats: StreamStats;
  accuracy: number;
  modelName: string;
}

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end) return;
    const duration = 600;
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(start + (end - start) * ease);
      if (t < 1) requestAnimationFrame(step);
      else prevRef.current = end;
    };
    requestAnimationFrame(step);
  }, [value]);

  return <>{display.toFixed(decimals)}</>;
}

function SeverityGauge({ value }: { value: number }) {
  const color = value > 80 ? '#dc2626' : value > 60 ? '#f59e0b' : '#22c55e';
  const bars = 10;
  return (
    <div className="flex gap-0.5 items-end h-4">
      {Array.from({ length: bars }).map((_, i) => {
        const filled = i < Math.round((value / 100) * bars);
        return (
          <div
            key={i}
            className="w-1.5 rounded-sm transition-all duration-300"
            style={{
              height: `${40 + i * 6}%`,
              background: filled ? color : 'rgba(255,255,255,0.08)',
            }}
          />
        );
      })}
    </div>
  );
}

export default function KPICards({ stats, accuracy, modelName }: KPICardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 p-3 border-b border-white/8 shrink-0">
      {/* Attacks/min */}
      <div className="bg-[#ff3b3b]/5 border border-[#ff3b3b]/20 p-2.5 rounded-lg">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Activity size={10} className="text-[#ff3b3b]" />
          <span className="text-[9px] text-gray-500 uppercase tracking-widest">Attacks/Min</span>
        </div>
        <div className="text-xl font-mono font-bold text-[#ff3b3b] tabular-nums leading-none">
          <AnimatedNumber value={stats.attacks_per_min} />
        </div>
      </div>

      {/* Avg Severity */}
      <div className="bg-white/3 border border-white/8 p-2.5 rounded-lg">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] text-gray-500 uppercase tracking-widest">Avg Severity</span>
        </div>
        <SeverityGauge value={stats.avg_severity} />
        <div className="text-[10px] font-mono text-gray-400 mt-1">
          <AnimatedNumber value={stats.avg_severity} />/100
        </div>
      </div>

      {/* Active IPs */}
      <div className="bg-[#00d4ff]/5 border border-[#00d4ff]/15 p-2.5 rounded-lg">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Globe2 size={10} className="text-[#00d4ff]" />
          <span className="text-[9px] text-gray-500 uppercase tracking-widest">Active IPs</span>
        </div>
        <div className="text-xl font-mono font-bold text-[#00d4ff] tabular-nums leading-none">
          <AnimatedNumber value={stats.unique_ips} />
        </div>
        <div className="text-[9px] text-gray-500 mt-0.5">
          {stats.unique_countries} countries
        </div>
      </div>

      {/* ML Accuracy */}
      <div className="bg-purple-500/5 border border-purple-500/20 p-2.5 rounded-lg">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Cpu size={10} className="text-purple-400" />
          <span className="text-[9px] text-gray-500 uppercase tracking-widest">ML Accuracy</span>
        </div>
        <div className="text-xl font-mono font-bold text-purple-400 tabular-nums leading-none">
          <AnimatedNumber value={accuracy * 100} decimals={1} />%
        </div>
        <div className="text-[9px] text-gray-500 mt-0.5 truncate">{modelName}</div>
      </div>
    </div>
  );
}
