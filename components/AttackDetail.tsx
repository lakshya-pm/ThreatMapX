import React, { useEffect, useState } from 'react';
import { AttackEvent } from '@/types/attack';
import { X, Activity, Globe2, ShieldAlert, Target, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface AttackDetailProps {
  attack: AttackEvent | null;
  onClose: () => void;
  onViewFullIntel?: () => void;
}

const getFlagEmoji = (countryName: string) => {
  const flags: Record<string, string> = {
    'China': '🇨🇳', 'United States': '🇺🇸', 'Russia': '🇷🇺', 'Brazil': '🇧🇷',
    'India': '🇮🇳', 'Germany': '🇩🇪', 'Japan': '🇯🇵', 'United Kingdom': '🇬🇧',
    'South Korea': '🇰🇷', 'Netherlands': '🇳🇱',
  };
  return flags[countryName] || '🌐';
};

const getVectorDesc = (type: string) => {
  switch (type) {
    case 'SYN': return 'TCP SYN Flood — exhausts server connection table';
    case 'UDP': return 'UDP Flood — saturates target bandwidth';
    case 'HTTP': return 'HTTP Flood — overwhelms application layer';
    default: return 'Unknown Vector';
  }
};

export default function AttackDetail({ attack, onClose, onViewFullIntel }: AttackDetailProps) {
  const [displayAttack, setDisplayAttack] = useState<AttackEvent | null>(attack);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (attack) {
      setDisplayAttack(attack);
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      setTimeout(() => setDisplayAttack(null), 300);
    }
  }, [attack]);

  if (!displayAttack) return null;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SYN': return 'text-red-500';
      case 'UDP': return 'text-orange-500';
      case 'HTTP': return 'text-cyan-400';
      default: return 'text-gray-400';
    }
  };

  const getGradient = (type: string) => {
    switch (type) {
      case 'SYN': return 'from-red-600 to-red-400';
      case 'UDP': return 'from-orange-600 to-orange-400';
      case 'HTTP': return 'from-cyan-600 to-cyan-400';
      default: return 'from-gray-600 to-gray-400';
    }
  };

  const sevColor = displayAttack.severity > 80 ? '#dc2626' : displayAttack.severity > 60 ? '#f59e0b' : '#22c55e';

  return (
    <div className={`absolute left-6 bottom-16 w-[340px] bg-[#050a14]/85 backdrop-blur-xl border border-[#00b4ff]/20 rounded-xl shadow-[0_0_30px_rgba(0,180,255,0.1)] p-5 z-50 text-white transform transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
      <div className="flex justify-between items-start mb-4 border-b border-white/10 pb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-300">Intrusion Details</h2>
          <p className="text-[10px] font-mono text-gray-500">{displayAttack.id}</p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 flex items-center gap-2"><Globe2 size={14} /> Origin</span>
          <div className="text-right">
            <p className="font-semibold">{getFlagEmoji(displayAttack.source_country)} {displayAttack.source_country}</p>
            <p className="font-mono text-xs text-gray-500">{displayAttack.source_ip}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400 flex items-center gap-2"><Target size={14} /> Target</span>
          <div className="text-right">
            <p className="font-semibold text-gray-200">{getFlagEmoji(displayAttack.target_country)} {displayAttack.target_country}</p>
            <p className="font-mono text-xs text-gray-500">{displayAttack.target_ip}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400 flex items-center gap-2"><ShieldAlert size={14} /> Vector</span>
          <div className="text-right">
            <span className={`font-black tracking-widest drop-shadow-[0_0_8px_currentColor] ${getTypeColor(displayAttack.attack_type)}`}>
              {displayAttack.attack_type}
            </span>
          </div>
        </div>

        <div className="text-[10px] text-gray-400 bg-white/5 p-2 rounded border border-white/5 leading-relaxed">
          {getVectorDesc(displayAttack.attack_type)}
        </div>

        {/* Severity */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Severity</span>
            <span className="font-mono" style={{ color: sevColor }}>{displayAttack.severity}/100</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getGradient(displayAttack.attack_type)}`}
              style={{ width: `${Math.min(100, displayAttack.severity)}%` }}
            />
          </div>
        </div>

        {/* Confidence */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">ML Confidence</span>
          <span className="font-mono text-xs text-green-400">{(displayAttack.confidence * 100).toFixed(1)}%</span>
        </div>

        {/* MITRE badge */}
        {displayAttack.mitre_id && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-xs">MITRE ATT&CK</span>
            <span className="font-mono text-xs text-[#00d4ff]">{displayAttack.mitre_id} — {displayAttack.mitre_tactic}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-gray-400 flex items-center gap-2"><Activity size={14} /> Volume</span>
          <span className="font-mono text-gray-300">{displayAttack.packets_per_sec.toLocaleString()} pkt/s</span>
        </div>
      </div>

      {/* Full Intel button */}
      {onViewFullIntel && (
        <button
          onClick={onViewFullIntel}
          className="mt-4 w-full flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest py-2 rounded border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10 transition-colors"
        >
          View Full Intel <ArrowRight size={12} />
        </button>
      )}

      <div className="mt-3 pt-3 border-t border-white/10 text-center">
        <span className="text-[10px] text-gray-500 font-mono">
          {format(new Date(displayAttack.timestamp), 'dd MMM yyyy, HH:mm:ss.SSS')}
        </span>
      </div>
    </div>
  );
}
