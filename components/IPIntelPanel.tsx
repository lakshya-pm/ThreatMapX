'use client';

import React, { useEffect, useState } from 'react';
import { X, Copy, Check, Shield, Zap, Clock, Target } from 'lucide-react';
import { AttackEvent } from '@/types/attack';
import { format } from 'date-fns';

interface IPIntelPanelProps {
  attack: AttackEvent | null;
  onClose: () => void;
  sessionHistory: AttackEvent[];
}

const TYPE_COLORS: Record<string, string> = {
  SYN:  'text-[#ff3b3b] bg-[#ff3b3b]/10 border-[#ff3b3b]/30',
  UDP:  'text-[#ff8c00] bg-[#ff8c00]/10 border-[#ff8c00]/30',
  HTTP: 'text-[#ffd700] bg-[#ffd700]/10 border-[#ffd700]/30',
};

const FLAGS: Record<string, string> = {
  'China': '🇨🇳', 'United States': '🇺🇸', 'Russia': '🇷🇺', 'Brazil': '🇧🇷',
  'India': '🇮🇳', 'Germany': '🇩🇪', 'Japan': '🇯🇵', 'United Kingdom': '🇬🇧',
  'South Korea': '🇰🇷', 'Netherlands': '🇳🇱',
};

function SeverityBar({ value }: { value: number }) {
  const color = value > 80 ? '#dc2626' : value > 60 ? '#ef4444' : value > 30 ? '#f59e0b' : '#22c55e';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="font-mono text-xs w-12 text-right" style={{ color }}>{value}/100</span>
    </div>
  );
}

function ShapBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div className="h-full bg-[#00d4ff] rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

export default function IPIntelPanel({ attack, onClose, sessionHistory }: IPIntelPanelProps) {
  const [visible, setVisible] = useState(false);
  const [displayed, setDisplayed] = useState<AttackEvent | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (attack) {
      setDisplayed(attack);
      setTimeout(() => setVisible(true), 10);
    } else {
      setVisible(false);
      setTimeout(() => setDisplayed(null), 300);
    }
  }, [attack]);

  if (!displayed) return null;

  const recentFromIp = sessionHistory.filter(
    a => a.source_ip === displayed.source_ip && a.id !== displayed.id
  ).slice(0, 10);

  const iptablesRule = `iptables -A INPUT -s ${displayed.source_ip} -j DROP`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(iptablesRule);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const typeStyle = TYPE_COLORS[displayed.attack_type] ?? 'text-gray-400 bg-gray-400/10 border-gray-400/30';
  const maxShap = Math.max(...displayed.feature_snapshot.top_3_shap, 0.01);
  const confColor = displayed.confidence > 0.9 ? '#22c55e' : displayed.confidence > 0.7 ? '#f59e0b' : '#ef4444';

  return (
    <div
      className={`absolute right-0 top-0 h-full w-[420px] bg-[#0d1520]/95 backdrop-blur-xl border-l border-[#00d4ff]/15 z-50 flex flex-col shadow-[-20px_0_60px_rgba(0,0,0,0.6)] transition-transform duration-300 ${
        visible ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/8">
        <div className="flex items-center gap-3">
          <Shield size={16} className="text-[#00d4ff]" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-300">IP Intelligence</span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Attack badge + IP */}
        <div className="space-y-1">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${typeStyle}`}>
            {displayed.attack_type} FLOOD
          </span>
          <div className="font-mono text-xl text-white">{displayed.source_ip}</div>
          <div className="text-xs text-gray-400">
            {FLAGS[displayed.source_country] ?? '🌐'} {displayed.source_country}
          </div>
        </div>

        {/* Attack Metrics */}
        <div className="space-y-2 p-3 bg-white/4 rounded-lg border border-white/6">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-3">Attack Metrics</p>

          <div className="flex justify-between text-xs">
            <span className="text-gray-400 flex items-center gap-1.5"><Zap size={11} /> Packets/s</span>
            <span className="font-mono text-gray-200">{displayed.packets_per_sec.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Bytes/s</span>
            <span className="font-mono text-gray-200">
              {displayed.bytes_per_sec >= 1_000_000
                ? `${(displayed.bytes_per_sec / 1_000_000).toFixed(1)} MB/s`
                : `${(displayed.bytes_per_sec / 1_000).toFixed(0)} KB/s`}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400 flex items-center gap-1.5"><Clock size={11} /> Duration</span>
            <span className="font-mono text-gray-200">{displayed.flow_duration_ms.toLocaleString()} ms</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Severity</span>
            </div>
            <SeverityBar value={displayed.severity} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Confidence</span>
            <span className="font-mono font-bold" style={{ color: confColor }}>
              {(displayed.confidence * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Target */}
        <div className="flex items-center gap-2 text-xs text-gray-400 p-2 bg-white/3 rounded border border-white/5">
          <Target size={12} className="text-gray-500 shrink-0" />
          <span>Target:</span>
          <span className="text-gray-200">
            {FLAGS[displayed.target_country] ?? '🌐'} {displayed.target_country} · {displayed.target_ip}
          </span>
        </div>

        {/* MITRE */}
        {displayed.mitre_id && (
          <div className="space-y-2 p-3 bg-white/4 rounded-lg border border-white/6">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">MITRE ATT&CK</p>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Tactic</span>
              <span className="text-gray-200">{displayed.mitre_tactic}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">ID</span>
              <span className="font-mono text-[#00d4ff]">{displayed.mitre_id}</span>
            </div>
            <div className="text-[10px] text-gray-300 leading-relaxed">{displayed.mitre_name}</div>
          </div>
        )}

        {/* SHAP Feature Importance */}
        <div className="space-y-2 p-3 bg-white/4 rounded-lg border border-white/6">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
            Model Explainability (SHAP)
          </p>
          <p className="text-[10px] text-gray-500 mb-2">Top features driving this prediction:</p>
          {displayed.feature_snapshot.top_3_features.map((feat, i) => (
            <div key={feat} className="space-y-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-300">{i + 1}. {feat}</span>
                <span className="font-mono text-[#00d4ff]">SHAP: {displayed.feature_snapshot.top_3_shap[i]?.toFixed(2)}</span>
              </div>
              <ShapBar
                value={displayed.feature_snapshot.top_3_shap[i] ?? 0}
                max={maxShap}
              />
            </div>
          ))}
        </div>

        {/* Session History */}
        {recentFromIp.length > 0 && (
          <div className="space-y-1 p-3 bg-white/4 rounded-lg border border-white/6">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
              Session History (this IP)
            </p>
            <p className="text-[10px] text-gray-400">{recentFromIp.length} prior attacks this session</p>
            <div className="flex gap-1 mt-2 flex-wrap">
              {recentFromIp.slice(0, 10).map(a => (
                <div
                  key={a.id}
                  className="w-2.5 h-5 rounded-sm opacity-60"
                  style={{
                    background: a.attack_type === 'SYN' ? '#ff3b3b'
                      : a.attack_type === 'UDP' ? '#ff8c00' : '#ffd700',
                  }}
                  title={`${a.attack_type} · ${new Date(a.timestamp).toLocaleTimeString()}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <p className="text-[10px] font-mono text-gray-600 text-center">
          {format(new Date(displayed.timestamp), 'dd MMM yyyy, HH:mm:ss.SSS')}
        </p>

        {/* iptables copy */}
        <div className="p-2 bg-black/40 border border-white/8 rounded text-[10px] font-mono text-gray-400 break-all">
          {iptablesRule}
        </div>
        <button
          onClick={() => void handleCopy()}
          className="w-full flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest py-2 rounded border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10 transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy iptables DROP rule'}
        </button>
      </div>
    </div>
  );
}
