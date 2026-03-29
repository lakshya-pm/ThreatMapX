'use client';

import React, { useState, useMemo, useEffect } from 'react';
import GlobeView from '@/components/GlobeView';
import TopBar from '@/components/TopBar';
import FiltersBar, { FilterType } from '@/components/FiltersBar';
import AttackTable from '@/components/AttackTable';
import AttackDetail from '@/components/AttackDetail';
import ThreatIntelFeed from '@/components/ThreatIntelFeed';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useThreatIntel } from '@/hooks/useThreatIntel';
import { AttackEvent } from '@/types/attack';
import { ChevronDown, ChevronUp, Cpu, Database, Network, Activity, Globe2, Target } from 'lucide-react';

export default function Home() {
  const { attacks, isConnected, togglePause, isPaused } = useWebSocket('ws://localhost:8080');
  const { news, loading: newsLoading } = useThreatIntel();
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [selectedAttack, setSelectedAttack] = useState<AttackEvent | null>(null);
  const [isMlExpanded, setIsMlExpanded] = useState(false);
  
  // Solves hydration mismatch
  const [sessionStart, setSessionStart] = useState('');
  useEffect(() => {
    setSessionStart(new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }));
  }, []);

  const visibleAttacks = useMemo(() => {
    if (activeFilter === 'ALL') return attacks;
    return attacks.filter(a => a.attackType === activeFilter);
  }, [attacks, activeFilter]);

  const threatScore = useMemo(() => {
    const now = Date.now();
    const recent = attacks.filter(a => (now - new Date(a.timestamp).getTime()) < 60000);
    const sum = recent.reduce((acc, curr) => acc + curr.intensity, 0);
    return Math.min(100, (sum / 6) * 100); 
  }, [attacks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;

      switch(e.key.toLowerCase()) {
        case 's': setActiveFilter('SYN'); break;
        case 'u': setActiveFilter('UDP'); break;
        case 'h': setActiveFilter('HTTP'); break;
        case 'a': setActiveFilter('ALL'); break;
        case 'escape': setSelectedAttack(null); break;
        case ' ': 
          e.preventDefault();
          togglePause(); 
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePause]);

  const stats = useMemo(() => {
    const now = Date.now();
    const lastMin = attacks.filter(a => (now - new Date(a.timestamp).getTime()) < 60000);
    const sources: Record<string, number> = {};
    const targets: Record<string, number> = {};
    let peak = 0;
    let syn = 0, udp = 0, http = 0;
    
    attacks.forEach(a => {
      sources[a.srcCountry] = (sources[a.srcCountry] || 0) + 1;
      targets[a.dstCountry] = (targets[a.dstCountry] || 0) + 1;
      if (a.intensity > peak) peak = a.intensity;
      if (a.attackType === 'SYN') syn++;
      if (a.attackType === 'UDP') udp++;
      if (a.attackType === 'HTTP') http++;
    });

    const topSrc = Object.entries(sources).sort((a,b) => b[1] - a[1])[0] || ['Unknown'];
    const topDst = Object.entries(targets).sort((a,b) => b[1] - a[1])[0] || ['Unknown'];
    const total = syn + udp + http || 1; 
    
    return {
      attacksPerMin: lastMin.length,
      topSource: topSrc[0],
      topTarget: topDst[0],
      peakIntensity: peak,
      breakdown: {
        syn: (syn / total) * 100,
        udp: (udp / total) * 100,
        http: (http / total) * 100
      },
      uniqueCountries: new Set([...Object.keys(sources), ...Object.keys(targets)]).size
    };
  }, [attacks]);

  const getFlag = (c: string) => {
    const f: any = { 'China': '🇨🇳', 'United States': '🇺🇸', 'Russia': '🇷🇺', 'Brazil': '🇧🇷', 'India': '🇮🇳', 'Germany': '🇩🇪', 'Japan': '🇯🇵', 'United Kingdom': '🇬🇧' };
    return f[c] || '🌐';
  };

  return (
    <div className="flex h-screen w-full bg-[#05060a] overflow-hidden flex-col font-sans">
      
      {/* 🔴 CONTINUOUS SEAMLESS TICKER BARS CONT. */}
      <div className="w-full flex flex-col shrink-0">
        
        {/* Primary Attack Ticker */}
        <div className="w-full bg-red-950/40 border-b border-red-500/20 text-red-500 py-1.5 text-[10px] uppercase tracking-widest font-mono flex items-center overflow-hidden shrink-0">
          <div className="font-bold px-4 border-r border-red-500/30 flex items-center gap-2 shrink-0 bg-[#05060a]/80 z-10 shadow-[10px_0_10px_rgba(5,6,10,1)]">
            <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-ping-glow'}`}></span>
            {isPaused ? 'STREAM PAUSED' : 'LIVE FEED'}
          </div>
          <div className="overflow-hidden flex-1 relative flex">
            <div className="flex whitespace-nowrap min-w-max" style={{animation: 'ticker 50s linear infinite'}}>
              {[1, 2].map((iter) => (
                <React.Fragment key={iter}>
                  {attacks.length > 0 ? attacks.slice(0,10).map(atk => (
                    <span key={atk.id + '-' + iter}>
                      {atk.attackType} FLOOD detected: {atk.srcCountry} → {atk.dstCountry} ({(atk.packetsPerSec).toLocaleString()} pkt/s)
                      <span className="mx-8 opacity-40">|</span>
                    </span>
                  )) : (
                    <span>ANALYZING NETWORK FLOW SIGNATURES<span className="mx-8 opacity-40">|</span></span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Secondary Intel Ticker */}
        <div className="w-full bg-orange-950/20 border-b border-orange-500/10 text-orange-400 py-1 text-[9px] uppercase tracking-widest font-mono flex items-center overflow-hidden shrink-0">
          <div className="font-bold px-4 border-r border-orange-500/20 flex items-center gap-2 shrink-0 bg-[#05060a]/90 z-10 shadow-[10px_0_10px_rgba(5,6,10,1)] text-orange-500">
            📰 INTEL
          </div>
          <div className="overflow-hidden flex-1 relative flex">
            <div className="flex whitespace-nowrap min-w-max" style={{animation: 'ticker 80s linear infinite'}}>
              {[1, 2].map((iter) => (
                <React.Fragment key={iter}>
                  {!newsLoading && news.length > 0 ? news.map((item, idx) => (
                    <span key={idx + '-' + iter}>
                      <span className="text-gray-300">[{item.source}]</span> {item.title}
                      <span className="mx-8 opacity-40">|</span>
                    </span>
                  )) : (
                    <span>SYNCING INTEL FEEDS...<span className="mx-8 opacity-40">|</span></span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

      </div>

      <main className="flex-1 flex flex-col md:flex-row min-h-0">
        <section className="relative flex-1 h-full">
          <GlobeView 
            attacks={visibleAttacks}
            selectedAttack={selectedAttack}
            onSelectAttack={setSelectedAttack}
          />
          <AttackDetail 
            attack={selectedAttack}
            onClose={() => setSelectedAttack(null)}
          />
        </section>

        <aside className="w-full md:w-[320px] lg:w-[380px] flex flex-col h-full border-l border-white/10 bg-black/40 backdrop-blur-md relative z-10 shrink-0">
          <TopBar 
            threatScore={threatScore || 0}
            isConnected={isConnected && !isPaused}
          />
          
          <FiltersBar 
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />

          <div className="grid grid-cols-2 gap-2 p-4 border-b border-white/10 bg-black/20">
            <div className="bg-red-950/20 border border-red-500/20 p-2 rounded flex flex-col items-center justify-center">
              <span className="text-[9px] text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Activity size={10}/> Attacks / Min</span>
              <span className="text-lg font-mono text-red-400 font-bold drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]">{stats.attacksPerMin}</span>
            </div>
            <div className="bg-orange-950/20 border border-orange-500/20 p-2 rounded flex flex-col items-center justify-center">
              <span className="text-[9px] text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Globe2 size={10}/> Top Source</span>
              <span className="text-sm font-semibold text-orange-400 truncate w-full text-center" title={stats.topSource}>
                {getFlag(stats.topSource)} {stats.topSource}
              </span>
            </div>
            <div className="bg-cyan-950/20 border border-cyan-500/20 p-2 rounded flex flex-col items-center justify-center">
              <span className="text-[9px] text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Target size={10}/> Top Target</span>
              <span className="text-sm font-semibold text-cyan-400 truncate w-full text-center" title={stats.topTarget}>
                {getFlag(stats.topTarget)} {stats.topTarget}
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 p-2 rounded flex flex-col items-center justify-center">
              <span className="text-[9px] text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Network size={10}/> Peak Intensity</span>
              <span className="text-lg font-mono text-white tracking-widest">{(stats.peakIntensity * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div className="p-4 border-b border-white/5 bg-black/30">
            <div className="flex justify-between text-[9px] text-gray-500 font-mono tracking-widest mb-2">
              <span>SYN {stats.breakdown.syn.toFixed(0)}%</span>
              <span>UDP {stats.breakdown.udp.toFixed(0)}%</span>
              <span>HTTP {stats.breakdown.http.toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full flex overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
              <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${stats.breakdown.syn}%` }}></div>
              <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${stats.breakdown.udp}%` }}></div>
              <div className="h-full bg-cyan-400 transition-all duration-1000" style={{ width: `${stats.breakdown.http}%` }}></div>
            </div>
          </div>

          <AttackTable 
            attacks={visibleAttacks}
            onSelectAttack={setSelectedAttack}
          />

          <ThreatIntelFeed 
            activeAttacks={visibleAttacks} 
            news={news} 
            loading={newsLoading} 
          />

          <div className="border-t border-white/10 bg-black/60 shrink-0">
            <button 
              onClick={() => setIsMlExpanded(!isMlExpanded)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-widest">
                <Cpu size={14} className="text-purple-400" />
                🧠 ML Detection Engine
              </div>
              {isMlExpanded ? <ChevronUp size={14} className="text-gray-500"/> : <ChevronDown size={14} className="text-gray-500"/>}
            </button>
            
            {isMlExpanded && (
              <div className="p-4 pt-0 text-[10px] text-gray-400 space-y-2 border-t border-white/5 bg-black/40">
                <div className="flex justify-between mt-2">
                  <span className="text-gray-500">Model:</span>
                  <span className="text-gray-300 font-mono">Random Forest Classifier</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Training Accuracy:</span>
                  <span className="text-green-400 font-mono font-bold">98.7%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dataset:</span>
                  <span className="text-gray-300 font-mono">CIC-DDoS2019</span>
                </div>
                <div className="pt-2 border-t border-white/5 mt-2">
                  <span className="text-gray-500 block mb-1">Features Analyzed:</span>
                  <span className="text-gray-300 font-mono text-[9px]">Packet rate, flow duration, byte count, TCP flags, IAT</span>
                </div>
                <div className="mt-3 inline-flex items-center gap-1 bg-green-900/40 border border-green-500/30 text-green-400 px-2 py-1 rounded-full text-[8px] tracking-widest uppercase font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  Model Active
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>

      <footer className="w-full h-6 bg-black border-t border-white/10 flex items-center justify-between px-4 text-[9px] font-mono text-gray-500 shrink-0">
        <div className="flex gap-6">
          <span suppressHydrationWarning={true}>Session started: {sessionStart || '--:--:--'}</span>
          <span>Total attacks intercepted: {attacks.length.toLocaleString()}</span>
          <span>Countries involved: {stats.uniqueCountries}</span>
        </div>
        <div className="hidden md:flex gap-6">
          <span className="flex items-center gap-1"><Database size={10} /> Data source: CIC-DDoS2019</span>
          <span className="flex items-center gap-1"><Cpu size={10} /> Model: Random Forest | Accuracy: 98.7%</span>
        </div>
        <div>
          Built with Next.js · react-globe.gl · WebSocket · ThreatMapX v1.0 
        </div>
      </footer>
    </div>
  );
}
