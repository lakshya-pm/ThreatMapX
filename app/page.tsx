'use client';

import React, { useState, useMemo, useEffect } from 'react';
import GlobeView from '@/components/GlobeView';
import AttackTable from '@/components/AttackTable';
import IPIntelPanel from '@/components/IPIntelPanel';
import MLPanel from '@/components/MLPanel';
import MITREPanel from '@/components/MITREPanel';
import FeatureImportancePanel from '@/components/FeatureImportancePanel';
import KPICards from '@/components/KPICards';
import ConnectionStatusBar from '@/components/ConnectionStatus';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import ThreatIntelFeed from '@/components/ThreatIntelFeed';
import { useAttackStream } from '@/hooks/useAttackStream';
import { useModelMetrics } from '@/hooks/useModelMetrics';
import { useThreatIntel } from '@/hooks/useThreatIntel';
import { AttackEvent } from '@/types/attack';
import {
  ShieldAlert, ChevronLeft, ChevronRight, Sun, Moon, Download, Maximize2,
  HelpCircle, Radio,
} from 'lucide-react';

type FilterType = 'ALL' | 'SYN' | 'UDP' | 'HTTP';
type ActiveTab = 'LIVE' | 'ANALYTICS';

// ── Ticker wrapper ───────────────────────────────────────────────────────────
function Ticker({ attacks, news, isPaused }: {
  attacks: AttackEvent[];
  news: { title: string; source: string }[];
  isPaused: boolean;
}) {
  return (
    <div className="w-full flex flex-col shrink-0">
      {/* Primary attack ticker */}
      <div className="w-full bg-[#ff3b3b]/8 border-b border-[#ff3b3b]/15 text-[#ff3b3b] py-1.5 text-[10px] uppercase tracking-widest font-mono flex items-center overflow-hidden shrink-0">
        <div className="font-bold px-3 border-r border-[#ff3b3b]/25 flex items-center gap-2 shrink-0 bg-[#080d14]/90 z-10 shadow-[8px_0_12px_rgba(8,13,20,1)]">
          <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-[#ff3b3b] animate-ping-glow'}`} />
          {isPaused ? 'PAUSED' : 'LIVE FEED'}
        </div>
        <div className="overflow-hidden flex-1">
          <div className="flex whitespace-nowrap min-w-max" style={{ animation: 'ticker 50s linear infinite' }}>
            {[1, 2].map(iter => (
              <React.Fragment key={iter}>
                {attacks.length > 0
                  ? attacks.slice(0, 12).map(a => (
                    <span key={`${a.id}-${iter}`}>
                      {a.attack_type} FLOOD: {a.source_country} → {a.target_country} ({a.packets_per_sec.toLocaleString()} pkt/s · SEV {a.severity})
                      <span className="mx-6 opacity-30">|</span>
                    </span>
                  ))
                  : <span>ANALYZING NETWORK FLOW SIGNATURES<span className="mx-6 opacity-30">|</span></span>
                }
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Intel ticker */}
      <div className="w-full bg-[#ff8c00]/5 border-b border-[#ff8c00]/10 text-[#ff8c00]/80 py-1 text-[9px] uppercase tracking-widest font-mono flex items-center overflow-hidden shrink-0">
        <div className="font-bold px-3 border-r border-[#ff8c00]/15 flex items-center gap-2 shrink-0 bg-[#080d14]/90 z-10 shadow-[8px_0_12px_rgba(8,13,20,1)]">
          <Radio size={9} /> INTEL
        </div>
        <div className="overflow-hidden flex-1">
          <div className="flex whitespace-nowrap min-w-max" style={{ animation: 'ticker 80s linear infinite' }}>
            {[1, 2].map(iter => (
              <React.Fragment key={iter}>
                {news.length > 0
                  ? news.map((item, idx) => (
                    <span key={`${idx}-${iter}`}>
                      <span className="text-gray-400">[{item.source}]</span> {item.title}
                      <span className="mx-6 opacity-30">|</span>
                    </span>
                  ))
                  : <span>SYNCING INTEL FEEDS...<span className="mx-6 opacity-30">|</span></span>
                }
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Attack type distribution bar ─────────────────────────────────────────────
function TypeBar({ stats }: { stats: { SYN: number; UDP: number; HTTP: number } }) {
  const { SYN, UDP, HTTP } = stats;
  return (
    <div className="px-3 py-2 border-b border-white/5 shrink-0">
      <div className="flex justify-between text-[9px] text-gray-500 font-mono tracking-widest mb-1.5">
        <span className="text-[#ff3b3b]">SYN {SYN}%</span>
        <span className="text-[#ff8c00]">UDP {UDP}%</span>
        <span className="text-[#ffd700]">HTTP {HTTP}%</span>
      </div>
      <div className="h-1.5 rounded-full flex overflow-hidden">
        <div className="h-full bg-[#ff3b3b] transition-all duration-1000" style={{ width: `${SYN}%` }} />
        <div className="h-full bg-[#ff8c00] transition-all duration-1000" style={{ width: `${UDP}%` }} />
        <div className="h-full bg-[#ffd700] transition-all duration-1000" style={{ width: `${HTTP}%` }} />
      </div>
    </div>
  );
}

// ── Export helper ─────────────────────────────────────────────────────────────
function exportData(attacks: AttackEvent[], format: 'csv' | 'json') {
  let content: string;
  let filename: string;
  let type: string;

  if (format === 'json') {
    content = JSON.stringify(attacks, null, 2);
    filename = `threatmapx-attacks-${Date.now()}.json`;
    type = 'application/json';
  } else {
    const headers = ['id', 'timestamp', 'source_ip', 'source_country', 'target_ip', 'target_country', 'attack_type', 'packets_per_sec', 'severity', 'confidence', 'mitre_id'];
    const rows = attacks.map(a => {
      const rec = a as unknown as Record<string, unknown>;
      return headers.map(h => JSON.stringify(rec[h] ?? '')).join(',');
    });
    content = [headers.join(','), ...rows].join('\n');
    filename = `threatmapx-attacks-${Date.now()}.csv`;
    type = 'text/csv';
  }

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const { attacks, isConnected, connectionStatus, stats, isPaused, togglePause } = useAttackStream();
  const { metrics } = useModelMetrics(30_000);
  const { news, loading: newsLoading } = useThreatIntel();

  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [selectedAttack, setSelectedAttack] = useState<AttackEvent | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('LIVE');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sessionStart] = useState(() => Date.now());
  const [sessionStartStr, setSessionStartStr] = useState('');
  const [uptime, setUptime] = useState(0);

  // Hydration fix
  useEffect(() => {
    setSessionStartStr(new Date().toLocaleTimeString('en-IN'));
  }, []);

  // Uptime counter
  useEffect(() => {
    const t = setInterval(() => setUptime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Events/sec rolling
  const eventsPerSec = useMemo(() => {
    const secs = Math.max(1, (Date.now() - sessionStart) / 1000);
    return attacks.length / secs;
  }, [attacks.length, sessionStart]);

  // Filter attacks
  const visibleAttacks = useMemo(() => {
    if (activeFilter === 'ALL') return attacks;
    return attacks.filter(a => a.attack_type === activeFilter);
  }, [attacks, activeFilter]);

  // Browser push notification for severity > 85
  useEffect(() => {
    const latestHigh = attacks[0];
    if (!latestHigh || latestHigh.severity <= 85) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      new Notification('ThreatMapX — Critical Attack', {
        body: `${latestHigh.attack_type} flood from ${latestHigh.source_country} · Severity ${latestHigh.severity}`,
      });
    }
  }, [attacks[0]?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Request notification permission once
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((document.activeElement as HTMLElement)?.tagName === 'INPUT') return;
      switch (e.key.toLowerCase()) {
        case 's': setActiveFilter('SYN'); break;
        case 'u': setActiveFilter('UDP'); break;
        case 'h': setActiveFilter('HTTP'); break;
        case 'a': setActiveFilter('ALL'); break;
        case ' ':
          e.preventDefault();
          togglePause();
          break;
        case 'f':
          setLeftCollapsed(true);
          setRightCollapsed(true);
          break;
        case 't':
          setIsDarkMode(d => !d);
          break;
        case '?':
          setShowShortcuts(s => !s);
          break;
        case 'escape':
          setSelectedAttack(null);
          setShowShortcuts(false);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePause]);

  const typeBreakdown = {
    SYN: stats.type_breakdown['SYN'] ?? 0,
    UDP: stats.type_breakdown['UDP'] ?? 0,
    HTTP: stats.type_breakdown['HTTP'] ?? 0,
  };

  return (
    <div className={`flex h-screen w-full overflow-hidden flex-col ${isDarkMode ? 'dark' : 'light'}`} style={{ background: 'var(--bg-primary)' }}>
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/8 bg-[#080d14]/80 backdrop-blur-md shrink-0 z-30">
        <div className="flex items-center gap-3">
          <ShieldAlert size={18} className="text-[#ff3b3b]" />
          <div>
            <h1 className="text-sm font-bold text-white tracking-widest leading-none">ThreatMapX</h1>
            <p className="text-[9px] text-gray-500 tracking-widest">Real-time DDoS Detection & SOC Visualization</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-white/5 p-0.5 rounded-lg border border-white/8">
          {(['LIVE', 'ANALYTICS'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                activeTab === tab ? 'bg-[#00d4ff] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'LIVE' && (
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#ff3b3b] animate-ping-glow' : 'bg-gray-600'}`} />
                  LIVE
                </span>
              )}
              {tab === 'ANALYTICS' && 'ANALYTICS'}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <button onClick={() => exportData(attacks, 'csv')} title="Export CSV" className="text-gray-500 hover:text-white transition-colors p-1.5 rounded hover:bg-white/8">
            <Download size={14} />
          </button>
          <button onClick={() => { setLeftCollapsed(l => !l); setRightCollapsed(r => !r); }} title="Toggle fullscreen globe" className="text-gray-500 hover:text-white transition-colors p-1.5 rounded hover:bg-white/8">
            <Maximize2 size={14} />
          </button>
          <button onClick={() => setIsDarkMode(d => !d)} className="text-gray-500 hover:text-white transition-colors p-1.5 rounded hover:bg-white/8">
            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button onClick={() => setShowShortcuts(true)} className="text-gray-500 hover:text-[#00d4ff] transition-colors p-1.5 rounded hover:bg-white/8">
            <HelpCircle size={14} />
          </button>
        </div>
      </header>

      {/* ── Tickers ── */}
      <Ticker attacks={visibleAttacks} news={news} isPaused={isPaused} />

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 bg-black/20 shrink-0">
        {(['ALL', 'SYN', 'UDP', 'HTTP'] as const).map(f => {
          const isActive = activeFilter === f;
          const colors: Record<FilterType, string> = {
            ALL:  'text-white border-white/40 bg-white/10',
            SYN:  'text-[#ff3b3b] border-[#ff3b3b]/50 bg-[#ff3b3b]/10',
            UDP:  'text-[#ff8c00] border-[#ff8c00]/50 bg-[#ff8c00]/10',
            HTTP: 'text-[#ffd700] border-[#ffd700]/50 bg-[#ffd700]/10',
          };
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded border transition-all ${
                isActive ? colors[f] : 'text-gray-500 border-transparent hover:text-white hover:bg-white/5'
              }`}
            >
              {f}
              {f !== 'ALL' && (
                <span className="ml-1.5 opacity-60">
                  {f === 'SYN' ? typeBreakdown.SYN : f === 'UDP' ? typeBreakdown.UDP : typeBreakdown.HTTP}%
                </span>
              )}
            </button>
          );
        })}
        <div className="ml-auto text-[9px] font-mono text-gray-600">
          {visibleAttacks.length.toLocaleString()} events
        </div>
      </div>

      {/* ── Main Content (3 panel) ── */}
      <main className="flex-1 flex min-h-0 overflow-hidden">

        {/* LEFT PANEL — 280px, collapsible */}
        {!leftCollapsed && (
          <aside className="w-[280px] shrink-0 flex flex-col border-r border-white/8 bg-[#0d1520]/60 backdrop-blur-sm overflow-y-auto z-20">
            <KPICards
              stats={stats}
              avgConfidence={stats.avg_confidence}
              modelName={metrics?.model_name ?? 'RandomForest'}
            />
            <TypeBar stats={typeBreakdown} />
            <MLPanel metrics={metrics} uptime={uptime} />
          </aside>
        )}

        {/* Left collapse toggle */}
        <button
          onClick={() => setLeftCollapsed(l => !l)}
          className="shrink-0 w-4 flex items-center justify-center border-r border-white/5 bg-black/30 hover:bg-white/5 transition-colors text-gray-600 hover:text-white z-20"
        >
          {leftCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* CENTER — Globe + Bottom Table */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Globe (LIVE) / Analytics (ANALYTICS) */}
          {activeTab === 'LIVE' ? (
            <div className="flex-1 relative min-h-0">
              <GlobeView
                attacks={visibleAttacks}
                selectedAttack={selectedAttack}
                onSelectAttack={setSelectedAttack}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm font-mono">
              Analytics tab — connect backend for live charts
            </div>
          )}

          {/* WebSocket status bar above table */}
          <ConnectionStatusBar
            status={connectionStatus}
            eventsPerSec={parseFloat(eventsPerSec.toFixed(2))}
            totalProcessed={stats.total_events}
          />

          {/* Attack Table */}
          <div className="h-48 border-t border-white/8 bg-[#080d14]/80 overflow-hidden flex flex-col">
            <AttackTable attacks={visibleAttacks} onSelectAttack={setSelectedAttack} />
          </div>
        </div>

        {/* Right collapse toggle */}
        <button
          onClick={() => setRightCollapsed(r => !r)}
          className="shrink-0 w-4 flex items-center justify-center border-l border-white/5 bg-black/30 hover:bg-white/5 transition-colors text-gray-600 hover:text-white z-20"
        >
          {rightCollapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* RIGHT PANEL — 300px, collapsible */}
        {!rightCollapsed && (
          <aside className="w-[300px] shrink-0 flex flex-col border-l border-white/8 bg-[#0d1520]/60 backdrop-blur-sm overflow-y-auto z-20">
            <ThreatIntelFeed activeAttacks={visibleAttacks} news={news} loading={newsLoading} />
            <MITREPanel attacks={visibleAttacks} />
            <FeatureImportancePanel metrics={metrics} />
          </aside>
        )}

        {/* IP Intelligence slide-in (over right side of globe) */}
        {selectedAttack && (
          <div className="absolute inset-y-0 right-0 z-40 pointer-events-none" style={{ top: 0 }}>
            <div className="pointer-events-auto h-full">
              <IPIntelPanel
                attack={selectedAttack}
                onClose={() => setSelectedAttack(null)}
                sessionHistory={attacks}
              />
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="h-6 border-t border-white/8 bg-black/60 flex items-center justify-between px-4 text-[9px] font-mono text-gray-600 shrink-0">
        <div className="flex gap-5">
          <span suppressHydrationWarning>{sessionStartStr ? `Session: ${sessionStartStr}` : 'Session: loading...'}</span>
          <span>Total: {attacks.length.toLocaleString()} events</span>
          <span>{stats.unique_countries} countries</span>
        </div>
        <div className="hidden md:flex gap-5">
          <span>CIC-DDoS2019 · RF/XGBoost · SMOTE · SHAP</span>
          <span>Gaps: G1 G2 G3 G4 G5 G6</span>
        </div>
        <div>ThreatMapX v2.0 · Next.js · FastAPI · WebGL</div>
      </footer>

      {/* ── Keyboard Shortcuts Modal ── */}
      <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
