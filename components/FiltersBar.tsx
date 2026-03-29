import React from 'react';

export type FilterType = 'ALL' | 'SYN' | 'UDP' | 'HTTP';

interface FiltersBarProps {
  activeFilter: FilterType;
  onFilterChange: (f: FilterType) => void;
}

const filters: FilterType[] = ['ALL', 'SYN', 'UDP', 'HTTP'];

export default function FiltersBar({ activeFilter, onFilterChange }: FiltersBarProps) {
  return (
    <div className="flex gap-2 p-4 border-b border-white/10 bg-black/20">
      {filters.map(f => {
        const isActive = activeFilter === f;
        let colorClass = 'text-gray-400 hover:text-white border-transparent hover:border-gray-500 bg-white/5';
        if (isActive) {
          switch (f) {
            case 'SYN': colorClass = 'text-red-500 border-red-500/50 bg-red-500/10 shadow-[0_0_8px_rgba(255,100,0,0.6)]'; break;
            case 'UDP': colorClass = 'text-orange-500 border-orange-500/50 bg-orange-500/10 shadow-[0_0_8px_rgba(255,100,0,0.6)]'; break;
            case 'HTTP': colorClass = 'text-cyan-400 border-cyan-400/50 bg-cyan-400/10 shadow-[0_0_8px_rgba(0,180,255,0.6)]'; break;
            default: colorClass = 'text-white border-white/50 bg-white/10 shadow-[0_0_8px_rgba(255,100,0,0.6)]';
          }
        }

        return (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`flex-1 text-xs py-1.5 px-2 rounded border transition-all duration-300 font-semibold tracking-wider ${colorClass}`}
          >
            {f}
          </button>
        );
      })}
    </div>
  );
}
