'use client';

import React, { useMemo } from 'react';
import { AttackEvent } from '@/types/attack';
import { X, Shield, Crosshair, Globe2, Activity } from 'lucide-react';

interface CountryPanelProps {
  countryName: string;
  attacks: AttackEvent[];
  onClose: () => void;
}

const FLAGS: Record<string, string> = {
  'China': '🇨🇳',
  'United States': '🇺🇸',
  'Russia': '🇷🇺',
  'Germany': '🇩🇪',
  'India': '🇮🇳',
  'Brazil': '🇧🇷',
  'United Kingdom': '🇬🇧',
  'Japan': '🇯🇵',
  'South Korea': '🇰🇷',
  'Netherlands': '🇳🇱',
};

export default function CountryPanel({ countryName, attacks, onClose }: CountryPanelProps) {
  const stats = useMemo(() => {
    let outbound = 0;
    let inbound = 0;
    let pktsSent = 0;
    let pktsRecv = 0;
    const types: Record<string, number> = {};
    const srcIps = new Set<string>();
    const tgtIps = new Set<string>();
    const severities: number[] = [];
    const recentOut: AttackEvent[] = [];
    const recentIn: AttackEvent[] = [];

    attacks.forEach(atk => {
      if (atk.source_country === countryName) {
        outbound++;
        pktsSent += atk.packets_per_sec;
        srcIps.add(atk.source_ip);
        severities.push(atk.severity);
        types[atk.attack_type] = (types[atk.attack_type] ?? 0) + 1;
        if (recentOut.length < 5) recentOut.push(atk);
      }
      if (atk.target_country === countryName) {
        inbound++;
        pktsRecv += atk.packets_per_sec;
        tgtIps.add(atk.target_ip);
        if (recentIn.length < 5) recentIn.push(atk);
      }
    });

    const avgSev = severities.length > 0
      ? Math.round(severities.reduce((a, b) => a + b, 0) / severities.length)
      : 0;

    let role: string;
    if (outbound > 0 && inbound > 0) role = 'Mixed';
    else if (outbound > 0) role = 'Primary Attacker';
    else if (inbound > 0) role = 'Primary Target';
    else role = 'Clean';

    return {
      outbound, inbound, pktsSent, pktsRecv,
      types, srcIps: srcIps.size, tgtIps: tgtIps.size,
      avgSev, role, recentOut, recentIn,
    };
  }, [attacks, countryName]);

  const flag = FLAGS[countryName] ?? '🌐';

  const getRoleBadge = () => {
    switch (stats.role) {
      case 'Primary Attacker':
        return <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">⚔ PRIMARY ATTACKER</span>;
      case 'Primary Target':
        return <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">🎯 PRIMARY TARGET</span>;
      case 'Mixed':
        return <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">⚡ MIXED</span>;
      default:
        return <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">✓ CLEAN</span>;
    }
  };

  const typeTotal = Object.values(stats.types).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="absolute inset-y-0 right-0 w-[360px] bg-[#0a0d14]/95 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-2xl shadow-black/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{flag}</span>
          <div>
            <h2 className="text-sm font-bold text-white">{countryName}</h2>
            {getRoleBadge()}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors p-1.5 rounded hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Crosshair size={10} className="text-red-400" />
              <span className="text-[9px] text-gray-500 uppercase tracking-widest">Outbound</span>
            </div>
            <div className="text-lg font-bold text-red-400 font-mono">{stats.outbound.toLocaleString()}</div>
            <div className="text-[8px] text-gray-600 font-mono">{stats.srcIps} unique IPs</div>
          </div>
          <div className="bg-orange-500/5 border border-orange-500/15 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield size={10} className="text-orange-400" />
              <span className="text-[9px] text-gray-500 uppercase tracking-widest">Inbound</span>
            </div>
            <div className="text-lg font-bold text-orange-400 font-mono">{stats.inbound.toLocaleString()}</div>
            <div className="text-[8px] text-gray-600 font-mono">{stats.tgtIps} unique IPs</div>
          </div>
          <div className="bg-cyan-500/5 border border-cyan-500/15 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Globe2 size={10} className="text-cyan-400" />
              <span className="text-[9px] text-gray-500 uppercase tracking-widest">Pkt/s Sent</span>
            </div>
            <div className="text-sm font-bold text-cyan-400 font-mono">{stats.pktsSent.toLocaleString()}</div>
          </div>
          <div className="bg-cyan-500/5 border border-cyan-500/15 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity size={10} className="text-yellow-400" />
              <span className="text-[9px] text-gray-500 uppercase tracking-widest">Avg Severity</span>
            </div>
            <div className={`text-sm font-bold font-mono ${stats.avgSev > 80 ? 'text-red-400' : stats.avgSev > 50 ? 'text-orange-400' : 'text-green-400'}`}>
              {stats.avgSev}
            </div>
          </div>
        </div>

        {/* Attack Type Breakdown */}
        {Object.keys(stats.types).length > 0 && (
          <div className="bg-black/30 border border-white/5 rounded-lg p-3">
            <h3 className="text-[9px] text-gray-500 uppercase tracking-widest mb-2">Attack Types</h3>
            <div className="space-y-1.5">
              {Object.entries(stats.types).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const pct = (count / typeTotal) * 100;
                const barColor = type === 'SYN' ? 'bg-red-500' : type === 'UDP' ? 'bg-orange-500' : 'bg-yellow-500';
                return (
                  <div key={type}>
                    <div className="flex justify-between text-[9px] mb-0.5">
                      <span className="text-gray-300 font-mono font-bold">{type}</span>
                      <span className="text-gray-500 font-mono">{count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Outbound Attacks */}
        {stats.recentOut.length > 0 && (
          <div className="bg-black/30 border border-white/5 rounded-lg p-3">
            <h3 className="text-[9px] text-gray-500 uppercase tracking-widest mb-2">Recent Outbound Attacks</h3>
            <div className="space-y-1">
              {stats.recentOut.map(atk => (
                <div key={atk.id} className="flex items-center justify-between text-[9px] py-1 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-bold ${atk.attack_type === 'SYN' ? 'text-red-400' : atk.attack_type === 'UDP' ? 'text-orange-400' : 'text-yellow-400'}`}>
                      {atk.attack_type}
                    </span>
                    <span className="text-gray-500">-&gt;</span>
                    <span className="text-gray-300">{atk.target_country}</span>
                  </div>
                  <span className="text-gray-500 font-mono">{atk.packets_per_sec.toLocaleString()} pkt/s</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Inbound Attacks */}
        {stats.recentIn.length > 0 && (
          <div className="bg-black/30 border border-white/5 rounded-lg p-3">
            <h3 className="text-[9px] text-gray-500 uppercase tracking-widest mb-2">Recent Inbound Attacks</h3>
            <div className="space-y-1">
              {stats.recentIn.map(atk => (
                <div key={atk.id} className="flex items-center justify-between text-[9px] py-1 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300">{atk.source_country}</span>
                    <span className="text-gray-500">-&gt;</span>
                    <span className={`font-mono font-bold ${atk.attack_type === 'SYN' ? 'text-red-400' : atk.attack_type === 'UDP' ? 'text-orange-400' : 'text-yellow-400'}`}>
                      {atk.attack_type}
                    </span>
                  </div>
                  <span className="text-gray-500 font-mono">{atk.packets_per_sec.toLocaleString()} pkt/s</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {stats.outbound === 0 && stats.inbound === 0 && (
          <div className="text-center py-8">
            <Globe2 size={24} className="text-gray-700 mx-auto mb-2" />
            <p className="text-[10px] text-gray-600 italic">No attack activity for this country in current session.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 bg-black/40 text-[8px] text-gray-600 font-mono text-center shrink-0">
        Press <span className="text-gray-400">ESC</span> to close
      </div>
    </div>
  );
}
