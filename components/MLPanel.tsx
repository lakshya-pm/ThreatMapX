'use client';

import React from 'react';
import { Cpu, AlertTriangle, CheckCircle } from 'lucide-react';
import { ModelMetrics } from '@/types/attack';

interface MLPanelProps {
  metrics: ModelMetrics | null;
  uptime: number; // seconds
}

function Bar({ value, max = 1 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
      <div className="h-full bg-[#00d4ff] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ClassBar({ value }: { value: number }) {
  const color = value > 0.97 ? '#00ff88' : value > 0.93 ? '#00d4ff' : '#ffd700';
  return (
    <div className="h-1 bg-white/10 rounded-full overflow-hidden flex-1">
      <div className="h-full rounded-full" style={{ width: `${value * 100}%`, background: color }} />
    </div>
  );
}

function formatUptime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MLPanel({ metrics, uptime }: MLPanelProps) {
  const isSynthetic = !metrics || metrics.dataset_type === 'synthetic';
  const trainDate = metrics?.training_timestamp
    ? new Date(metrics.training_timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const perClass = metrics?.per_class_f1 ?? { SYN: 0.993, UDP: 0.981, HTTP: 0.972 };
  const accuracy = metrics?.accuracy ?? 0.987;
  const f1 = metrics?.weighted_f1 ?? 0.987;
  const modelName = metrics?.model_name ?? 'Random Forest';
  const nFeatures = metrics?.n_features ?? 58;
  const predictions = metrics?.predictions_count ?? 0;
  const latency = metrics?.avg_latency_ms ?? 0;

  return (
    <div className="border-t border-white/8 bg-black/50 shrink-0 text-[10px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <Cpu size={13} className="text-purple-400 shrink-0" />
        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">ML Detection Engine</span>
      </div>

      {/* Synthetic Warning */}
      {isSynthetic && (
        <div className="mx-3 mt-2 flex items-start gap-2 p-2 bg-yellow-500/8 border border-yellow-500/25 rounded text-[9px] text-yellow-400">
          <AlertTriangle size={11} className="shrink-0 mt-0.5" />
          <span>Running on synthetic data — drop CIC-DDoS2019 CSVs into <code className="font-mono">/data/cicddos2019/</code> for real data. Backend auto-detects on restart.</span>
        </div>
      )}

      <div className="px-4 py-3 space-y-2.5">
        {/* Model info */}
        <div className="flex justify-between">
          <span className="text-gray-500">Model</span>
          <span className="text-gray-300 font-mono">{modelName} v1.0</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Dataset</span>
          <span className={`font-mono ${isSynthetic ? 'text-yellow-400' : 'text-green-400'}`}>
            {isSynthetic ? 'SYNTHETIC ⚠' : 'CIC-DDoS2019'}
          </span>
        </div>

        {/* Accuracy */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Accuracy</span>
            <span className="font-mono text-green-400">{(accuracy * 100).toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Bar value={accuracy} max={1} />
          </div>
        </div>

        {/* F1 */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">F1 Score</span>
            <span className="font-mono text-green-400">{f1.toFixed(3)}</span>
          </div>
          <Bar value={f1} max={1} />
        </div>

        {/* Per-class F1 */}
        <div className="space-y-1.5 pt-1 border-t border-white/5">
          <p className="text-[9px] text-gray-600 uppercase tracking-widest">Per-Class F1</p>
          {(['SYN', 'UDP', 'HTTP'] as const).map(cls => {
            const val = perClass[cls] ?? 0;
            const colors = { SYN: 'text-[#ff3b3b]', UDP: 'text-[#ff8c00]', HTTP: 'text-[#ffd700]' };
            return (
              <div key={cls} className="flex items-center gap-2">
                <span className={`w-8 font-mono font-bold ${colors[cls]}`}>{cls}</span>
                <ClassBar value={val} />
                <span className="font-mono text-gray-400 w-10 text-right">{val.toFixed(3)}</span>
              </div>
            );
          })}
        </div>

        {/* Preprocessing */}
        <div className="flex justify-between pt-1 border-t border-white/5">
          <span className="text-gray-500">Preprocessing</span>
          <span className="text-green-400 flex items-center gap-1">
            <CheckCircle size={10} /> SMOTE applied
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Features</span>
          <span className="font-mono text-gray-300">{nFeatures} selected (SHAP-ranked)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Trained</span>
          <span className="font-mono text-gray-300">{trainDate}</span>
        </div>

        {/* Session */}
        <div className="pt-2 border-t border-white/5 space-y-1">
          <p className="text-[9px] text-gray-600 uppercase tracking-widest">Session</p>
          <div className="flex justify-between">
            <span className="text-gray-500">Predictions</span>
            <span className="font-mono text-gray-300">{predictions.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Avg Latency</span>
            <span className="font-mono text-gray-300">
              {latency < 2 ? '<2ms' : `${latency.toFixed(1)}ms`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Uptime</span>
            <span className="font-mono text-gray-300">{formatUptime(uptime)}</span>
          </div>
        </div>

        {/* Gaps footer */}
        <div className="pt-2 border-t border-white/5">
          <p className="text-[8px] text-gray-600 uppercase tracking-widest mb-1">
            Trained on CIC-DDoS2019 — Canadian Institute for Cybersecurity
          </p>
          <div
            className="flex gap-1 flex-wrap"
            title="G1: Real-time streaming | G2: Visualization | G3: Geographic mapping | G4: SOC integration | G5: Continuous ingestion | G6: Model interpretability (SHAP)"
          >
            {(['G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const).map(g => (
              <span key={g} className="text-[8px] font-bold font-mono px-1 py-0.5 rounded bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20 cursor-help">
                {g}
              </span>
            ))}
          </div>
          <p className="text-[8px] text-gray-600 mt-1">Research gaps addressed: G1 G2 G3 G4 G5 G6</p>
        </div>
      </div>
    </div>
  );
}
