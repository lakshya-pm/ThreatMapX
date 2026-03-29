import React, { useEffect, useState } from 'react';
import { AttackEvent } from '../types/attack';
import { formatDistanceToNowStrict } from 'date-fns';
import { Target } from 'lucide-react';

interface AttackTableProps {
  attacks: AttackEvent[];
  onSelectAttack: (attack: AttackEvent) => void;
}

export default function AttackTable({ attacks, onSelectAttack }: AttackTableProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SYN': return 'bg-red-500/20 text-red-500 border border-red-500/30';
      case 'UDP': return 'bg-orange-500/20 text-orange-500 border border-orange-500/30';
      case 'HTTP': return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  const getHoverColor = (type: string) => {
    switch (type) {
      case 'SYN': return 'hover:border-l-red-500';
      case 'UDP': return 'hover:border-l-orange-500';
      case 'HTTP': return 'hover:border-l-cyan-400';
      default: return 'hover:border-l-gray-400';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full">
      <table className="w-full text-left text-xs text-gray-300 table-fixed">
        <thead className="sticky top-0 bg-[#05060a]/90 backdrop-blur-md z-10 text-gray-500 uppercase tracking-widest text-[10px]">
          <tr>
            <th className="p-3 font-medium w-[25%]">Time</th>
            <th className="p-3 font-medium w-[25%]">Source</th>
            <th className="p-3 font-medium w-[30%]">Target</th>
            <th className="p-3 font-medium w-[20%]">Type</th>
          </tr>
        </thead>
        <tbody>
          {attacks.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-4 text-center text-gray-600 italic">No attacks detected...</td>
            </tr>
          ) : (
            attacks.map((atk, idx) => {
              const hoverClass = getHoverColor(atk.attackType);
              return (
                <tr 
                  key={atk.id} 
                  onClick={() => onSelectAttack(atk)}
                  className={`border-b border-l-2 border-l-transparent border-white/5 cursor-pointer transition-all hover:bg-[rgba(0,180,255,0.08)] ${hoverClass} ${idx === 0 ? 'animate-pulse bg-white/5' : ''}`}
                >
                  <td className="p-3 text-gray-500 font-mono text-[9px] truncate">
                    {formatDistanceToNowStrict(new Date(atk.timestamp), { addSuffix: true })}
                  </td>
                  <td className="p-3 max-w-0" title={`${atk.srcCountry} (${atk.srcIp})`}>
                    <div className="font-semibold text-gray-200 truncate pr-1">{atk.srcCountry}</div>
                    <div className="text-[9px] text-gray-500 font-mono truncate">{atk.srcIp}</div>
                  </td>
                  <td className="p-3 max-w-0" title={`${atk.dstCountry} (${atk.dstIp})`}>
                    <div className="font-semibold text-gray-200 truncate pr-1">{atk.dstCountry}</div>
                    <div className="text-[9px] text-gray-500 font-mono truncate">{atk.dstIp}</div>
                  </td>
                  <td className="p-3">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] inline-flex items-center gap-1 font-bold ${getTypeColor(atk.attackType)}`}>
                      <Target size={10} className="hidden sm:inline-block" />
                      {atk.attackType}
                    </span>
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
