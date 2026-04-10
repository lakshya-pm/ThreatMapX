'use client';

import React from 'react';
import { Shield } from 'lucide-react';
import { AttackEvent } from '@/types/attack';

interface MITREPanelProps {
  attacks: AttackEvent[];
}

interface MITREEntry {
  id: string;
  tactic: string;
  name: string;
  count: number;
  type: string;
}

export default function MITREPanel({ attacks }: MITREPanelProps) {
  const entries: Record<string, MITREEntry> = {};

  attacks.forEach(a => {
    if (!a.mitre_id) return;
    const key = a.mitre_id;
    if (!entries[key]) {
      entries[key] = {
        id: a.mitre_id,
        tactic: a.mitre_tactic ?? 'Unknown',
        name: a.mitre_name,
        count: 0,
        type: a.attack_type,
      };
    }
    entries[key].count++;
  });

  const sorted = Object.values(entries).sort((a, b) => b.count - a.count);

  const TYPE_COLORS: Record<string, string> = {
    SYN:  'text-[#ff3b3b] bg-[#ff3b3b]/10 border-[#ff3b3b]/20',
    UDP:  'text-[#ff8c00] bg-[#ff8c00]/10 border-[#ff8c00]/20',
    HTTP: 'text-[#ffd700] bg-[#ffd700]/10 border-[#ffd700]/20',
  };

  return (
    <div className="border-t border-white/8 bg-black/30 shrink-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <Shield size={13} className="text-[#00d4ff]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">MITRE ATT&CK — Session</span>
      </div>
      <div className="divide-y divide-white/5">
        {sorted.length === 0 ? (
          <p className="px-4 py-3 text-[10px] text-gray-600 font-mono">Awaiting attack data...</p>
        ) : (
          sorted.slice(0, 3).map(e => (
            <div key={e.id} className="px-4 py-2 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${TYPE_COLORS[e.type] ?? ''}`}>
                    {e.id}
                  </span>
                </div>
                <p className="text-[10px] text-gray-300 truncate">{e.name}</p>
                <p className="text-[9px] text-gray-600">{e.tactic}</p>
              </div>
              <span className="text-[11px] font-bold font-mono text-gray-400 shrink-0">
                {e.count.toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
