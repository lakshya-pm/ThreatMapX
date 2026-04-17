import React, { useEffect, useState, useMemo } from 'react';
import { AttackEvent } from '@/types/attack';
import { formatDistanceToNowStrict } from 'date-fns';
import { Target, ArrowUpDown } from 'lucide-react';

interface AttackTableProps {
  attacks: AttackEvent[];
  onSelectAttack: (attack: AttackEvent) => void;
}

type SortField = 'timestamp' | 'severity' | 'packets_per_sec' | 'confidence';
type SortDir = 'asc' | 'desc';

export default function AttackTable({ attacks, onSelectAttack }: AttackTableProps) {
  const [, setTick] = useState(0);
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    const slice = attacks.slice(0, 50);
    return [...slice].sort((a, b) => {
      let av: number, bv: number;
      switch (sortField) {
        case 'timestamp':
          av = new Date(a.timestamp).getTime();
          bv = new Date(b.timestamp).getTime();
          break;
        case 'severity':
          av = a.severity; bv = b.severity; break;
        case 'packets_per_sec':
          av = a.packets_per_sec; bv = b.packets_per_sec; break;
        case 'confidence':
          av = a.confidence; bv = b.confidence; break;
        default:
          return 0;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [attacks, sortField, sortDir]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SYN': return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'UDP': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      case 'HTTP': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  const getHoverColor = (type: string) => {
    switch (type) {
      case 'SYN': return 'hover:border-l-red-500';
      case 'UDP': return 'hover:border-l-orange-500';
      case 'HTTP': return 'hover:border-l-yellow-400';
      default: return 'hover:border-l-gray-400';
    }
  };

  const getConfColor = (conf: number) => {
    if (conf >= 0.90) return 'text-emerald-400';
    if (conf >= 0.70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfBg = (conf: number) => {
    if (conf >= 0.90) return 'bg-emerald-500/15 border-emerald-500/30';
    if (conf >= 0.70) return 'bg-yellow-500/15 border-yellow-500/30';
    return 'bg-red-500/15 border-red-500/30';
  };

  const SortHeader = ({ label, field, className }: { label: string; field: SortField; className?: string }) => (
    <th
      className={`p-2 font-medium cursor-pointer select-none hover:text-gray-300 transition-colors group ${className ?? ''}`}
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-0.5">
        {label}
        <ArrowUpDown size={8} className={`opacity-0 group-hover:opacity-60 transition-opacity ${sortField === field ? 'opacity-80 text-cyan-400' : ''}`} />
      </div>
    </th>
  );

  return (
    <div className="w-full shrink-0 min-h-[250px] max-h-[300px] overflow-y-auto border-b border-white/5">
      <table className="w-full text-left text-[10px] text-gray-300 table-fixed">
        <thead className="sticky top-0 bg-[#05060a]/95 backdrop-blur-md z-10 text-gray-500 uppercase tracking-widest text-[9px]">
          <tr>
            <SortHeader label="Time" field="timestamp" className="w-[11%]" />
            <th className="p-2 font-medium w-[16%]">Source</th>
            <th className="p-2 font-medium w-[16%]">Target</th>
            <th className="p-2 font-medium w-[9%]">Type</th>
            <SortHeader label="Pkt/s" field="packets_per_sec" className="w-[12%]" />
            <SortHeader label="Sev" field="severity" className="w-[12%]" />
            <SortHeader label="Conf" field="confidence" className="w-[11%]" />
            <th className="p-2 font-medium w-[13%]">MITRE</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={8} className="p-4 text-center text-gray-600 italic">No attacks detected...</td>
            </tr>
          ) : (
            sorted.map((atk, idx) => {
              const hoverClass = getHoverColor(atk.attack_type);
              return (
                <tr
                  key={atk.id}
                  onClick={() => onSelectAttack(atk)}
                  className={`border-b border-l-2 border-l-transparent border-white/5 cursor-pointer transition-all hover:bg-[rgba(0,180,255,0.06)] ${hoverClass} ${idx === 0 ? 'animate-pulse bg-white/5' : ''}`}
                >
                  {/* TIME */}
                  <td className="p-2 text-gray-500 font-mono text-[8px] truncate">
                    {formatDistanceToNowStrict(new Date(atk.timestamp), { addSuffix: true })}
                  </td>

                  {/* SOURCE */}
                  <td className="p-2 max-w-0" title={`${atk.source_country} (${atk.source_ip})`}>
                    <div className="font-semibold text-gray-200 truncate text-[9px]">{atk.source_country}</div>
                    <div className="text-[8px] text-gray-600 font-mono truncate">{atk.source_ip}</div>
                  </td>

                  {/* TARGET */}
                  <td className="p-2 max-w-0" title={`${atk.target_country} (${atk.target_ip})`}>
                    <div className="font-semibold text-gray-200 truncate text-[9px]">{atk.target_country}</div>
                    <div className="text-[8px] text-gray-600 font-mono truncate">{atk.target_ip}</div>
                  </td>

                  {/* TYPE */}
                  <td className="p-2">
                    <span className={`px-1 py-0.5 rounded text-[8px] inline-flex items-center gap-0.5 font-bold ${getTypeColor(atk.attack_type)}`}>
                      <Target size={8} className="hidden sm:inline-block" />
                      {atk.attack_type}
                    </span>
                  </td>

                  {/* PKT/S */}
                  <td className="p-2 text-right font-mono text-[9px] text-gray-300 tabular-nums">
                    {atk.packets_per_sec.toLocaleString()}
                  </td>

                  {/* SEVERITY */}
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <span className={`font-mono text-[9px] font-bold tabular-nums ${atk.severity > 80 ? 'text-red-400' : atk.severity > 60 ? 'text-orange-400' : 'text-green-400'}`}>
                        {atk.severity}
                      </span>
                      <div className="w-8 h-1 rounded-full bg-white/10 overflow-hidden hidden sm:block">
                        <div
                          className={`h-full rounded-full transition-all ${atk.severity > 80 ? 'bg-red-500' : atk.severity > 60 ? 'bg-orange-500' : 'bg-green-500'}`}
                          style={{ width: `${atk.severity}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* CONFIDENCE */}
                  <td className="p-2">
                    <span className={`font-mono text-[8px] font-bold px-1 py-0.5 rounded border ${getConfColor(atk.confidence)} ${getConfBg(atk.confidence)}`}>
                      {(atk.confidence * 100).toFixed(1)}%
                    </span>
                  </td>

                  {/* MITRE */}
                  <td className="p-2">
                    {atk.mitre_id ? (
                      <span
                        className="text-[8px] font-mono text-cyan-400 bg-cyan-500/10 px-1 py-0.5 rounded border border-cyan-500/20 cursor-help"
                        title={atk.mitre_name}
                      >
                        {atk.mitre_id}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-[8px]">&mdash;</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
