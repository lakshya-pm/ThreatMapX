'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface ConnectionStatusProps {
  status: ConnectionStatus;
  eventsPerSec: number;
  totalProcessed: number;
  onRetry?: () => void;
}

export default function ConnectionStatusBar({
  status, eventsPerSec, totalProcessed, onRetry,
}: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/5 bg-black/40 text-[9px] font-mono text-gray-500 shrink-0">
      {status === 'connected' && (
        <>
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping-glow absolute h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-green-400 font-bold">LIVE</span>
        </>
      )}
      {status === 'reconnecting' && (
        <>
          <RefreshCw size={8} className="animate-spin text-yellow-400" />
          <span className="text-yellow-400 font-bold">RECONNECTING...</span>
        </>
      )}
      {status === 'disconnected' && (
        <>
          <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
          <span className="text-red-400 font-bold">DISCONNECTED</span>
          {onRetry && (
            <button onClick={onRetry} className="text-[#00d4ff] underline underline-offset-2 hover:no-underline ml-1">
              retry
            </button>
          )}
        </>
      )}
      <span className="text-gray-600">|</span>
      <span>WS: localhost:8000</span>
      <span className="text-gray-600">|</span>
      <span>{eventsPerSec.toFixed(1)} events/sec</span>
      <span className="text-gray-600">|</span>
      <span>{totalProcessed.toLocaleString()} processed</span>
    </div>
  );
}
