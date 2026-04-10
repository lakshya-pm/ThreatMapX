'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { AttackEvent } from '@/types/attack';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

interface AttackTableProps {
  attacks: AttackEvent[];
  onSelectAttack: (attack: AttackEvent) => void;
}

type SortKey = 'timestamp' | 'severity' | 'confidence' | 'packets_per_sec';
type SortDir = 'asc' | 'desc';

const TYPE_BADGE: Record<string, string> = {
  SYN:  'text-[#ff3b3b] bg-[#ff3b3b]/10 border-[#ff3b3b]/30',
  UDP:  'text-[#ff8c00] bg-[#ff8c00]/10 border-[#ff8c00]/30',
  HTTP: 'text-[#ffd700] bg-[#ffd700]/10 border-[#ffd700]/30',
};

const SEV_ROW: (sev: number) => string = sev => {
  if (sev > 80) return 'border-l-[#dc2626] bg-[#dc2626]/4';
  if (sev > 60) return 'border-l-[#ef4444] bg-[#ef4444]/3';
  if (sev > 30) return 'border-l-[#f59e0b] bg-transparent';
  return 'border-l-[#22c55e] bg-transparent';
};

function SeverityCell({ value }: { value: number }) {
  const color = value > 80 ? '#dc2626' : value > 60 ? '#ef4444' : value > 30 ? '#f59e0b' : '#22c55e';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="font-mono text-[10px]" style={{ color }}>{value}</span>
    </div>
  );
}

function ConfBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const cls = pct >= 90 ? 'text-green-400 bg-green-400/10' : pct >= 70 ? 'text-yellow-400 bg-yellow-400/10' : 'text-red-400 bg-red-400/10';
  return <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${cls}`}>{pct}%</span>;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={10} className="text-gray-600" />;
  return dir === 'asc' ? <ChevronUp size={10} className="text-[#00d4ff]" /> : <ChevronDown size={10} className="text-[#00d4ff]" />;
}

export default function AttackTable({ attacks, onSelectAttack }: AttackTableProps) {
  const [, setTick] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const sorted = useMemo(() => {
    const arr = [...attacks];
    arr.sort((a, b) => {
      let va: number, vb: number;
      if (sortKey === 'timestamp') {
        va = new Date(a.timestamp).getTime();
        vb = new Date(b.timestamp).getTime();
      } else {
        va = a[sortKey];
        vb = b[sortKey];
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return arr.slice(0, 200);
  }, [attacks, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortTh = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      className="p-2 font-medium text-left cursor-pointer select-none hover:text-[#00d4ff] transition-colors"
      onClick={() => toggleSort(k)}
    >
      <span className="flex items-center gap-1">
        {label}
        <SortIcon active={sortKey === k} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto min-h-0">
      <table className="w-full text-left table-fixed min-w-[600px]">
        <thead className="sticky top-0 bg-[#080d14]/95 backdrop-blur-md z-10 text-gray-500 uppercase tracking-widest text-[9px] border-b border-white/8">
          <tr>
            <SortTh label="Time" k="timestamp" />
            <th className="p-2 font-medium w-[130px]">Source</th>
            <th className="p-2 font-medium w-[130px]">Target</th>
            <th className="p-2 font-medium w-[60px]">Type</th>
            <SortTh label="Pkt/s" k="packets_per_sec" />
            <SortTh label="Sev" k="severity" />
            <SortTh label="Conf" k="confidence" />
            <th className="p-2 font-medium">MITRE</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="p-6 text-center text-gray-600 font-mono text-[10px] italic">
                Awaiting live attack events...
              </td>
            </tr>
          )}
          {sorted.map((atk, idx) => (
            <tr
              key={atk.id}
              onClick={() => onSelectAttack(atk)}
              className={`border-b border-l-2 border-white/4 cursor-pointer hover:bg-white/4 transition-colors text-[10px] ${SEV_ROW(atk.severity)} ${idx === 0 ? 'bg-white/3' : ''}`}
            >
              <td className="p-2 text-gray-500 font-mono whitespace-nowrap">
                {formatDistanceToNowStrict(new Date(atk.timestamp), { addSuffix: true })}
              </td>
              <td className="p-2 max-w-0">
                <div className="text-gray-200 truncate font-semibold">{atk.source_country}</div>
                <div className="text-gray-500 font-mono text-[9px] truncate">{atk.source_ip}</div>
              </td>
              <td className="p-2 max-w-0">
                <div className="text-gray-200 truncate">{atk.target_country}</div>
                <div className="text-gray-500 font-mono text-[9px] truncate">{atk.target_ip}</div>
              </td>
              <td className="p-2">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${TYPE_BADGE[atk.attack_type] ?? 'text-gray-400 bg-gray-400/10 border-gray-400/20'}`}>
                  {atk.attack_type}
                </span>
              </td>
              <td className="p-2 font-mono text-gray-300 whitespace-nowrap">
                {atk.packets_per_sec >= 1000
                  ? `${(atk.packets_per_sec / 1000).toFixed(0)}k`
                  : atk.packets_per_sec}
              </td>
              <td className="p-2">
                <SeverityCell value={atk.severity} />
              </td>
              <td className="p-2">
                <ConfBadge value={atk.confidence} />
              </td>
              <td className="p-2">
                {atk.mitre_id && (
                  <span
                    className="text-[9px] font-mono px-1 py-0.5 rounded bg-white/6 text-gray-400 cursor-help"
                    title={`${atk.mitre_tactic}: ${atk.mitre_name}`}
                  >
                    {atk.mitre_id}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
