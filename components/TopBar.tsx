import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface TopBarProps {
  threatScore: number;
  isConnected: boolean;
}

export default function TopBar({ threatScore, isConnected }: TopBarProps) {
  const getThreatColor = () => {
    if (threatScore > 75) return 'text-red-500';
    if (threatScore > 40) return 'text-orange-500';
    return 'text-green-500';
  };

  const threatLabel = threatScore > 75 ? 'HIGH' : threatScore > 40 ? 'MEDIUM' : 'LOW';

  return (
    <div className="flex flex-col gap-4 border-b border-white/10 p-4 bg-black/40 backdrop-blur-md shrink-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-widest text-white flex items-center gap-2">
          <ShieldAlert className="text-orange-500" />
          ThreatMapX
        </h1>
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider">
          {isConnected ? (
            <>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping-glow absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-red-500">LIVE</span>
            </>
          ) : (
            <span className="text-gray-500">OFFLINE</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-gray-400 uppercase tracking-widest">
          <span>Global Threat Level</span>
          <span className={`font-bold transition-colors duration-1000 ${getThreatColor()}`}>
            {threatLabel} ({Math.round(threatScore)})
          </span>
        </div>
        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden shrink-0">
          <div
            className={`h-full transition-all duration-1000 ease-out ${threatScore > 75 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : threatScore > 40 ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]'}`}
            style={{ width: `${Math.min(100, Math.max(0, threatScore))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
