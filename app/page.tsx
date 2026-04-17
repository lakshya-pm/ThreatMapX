'use client';

import React, { useState, useMemo, useEffect } from 'react';
import GlobeView from '@/components/GlobeView';
import TopBar from '@/components/TopBar';
import FiltersBar, { FilterType } from '@/components/FiltersBar';
import AttackTable from '@/components/AttackTable';
import AttackDetail from '@/components/AttackDetail';
import IPIntelPanel from '@/components/IPIntelPanel';
import CountryPanel from '@/components/CountryPanel';
import KPICards from '@/components/KPICards';
import MLPanel from '@/components/MLPanel';
import MITREPanel from '@/components/MITREPanel';
import FeatureImportancePanel from '@/components/FeatureImportancePanel';
import ConnectionStatusBar from '@/components/ConnectionStatus';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import ThreatIntelFeed from '@/components/ThreatIntelFeed';
import { useAttackStream } from '@/hooks/useAttackStream';
import { useModelMetrics } from '@/hooks/useModelMetrics';
import { useThreatIntel } from '@/hooks/useThreatIntel';
import { AttackEvent } from '@/types/attack';
import {
  ChevronDown, ChevronUp, Download, HelpCircle, Sun, Moon, Radio,
} from 'lucide-react';

// ── Ticker wrapper ───────────────────────────────────────────────────────────
function Ticker({ attacks, news, isPaused }: {
  attacks: AttackEvent[];
  news: { title: string; source: string }[];
  isPaused: boolean;
}) {
  return (
    <div className="w-full flex flex-col shrink-0">
      {/* Primary attack ticker */}
      <div className="w-full bg-red-950/40 border-b border-red-500/20 text-red-500 py-1.5 text-[10px] uppercase tracking-widest font-mono flex items-center overflow-hidden shrink-0">
        <div className="font-bold px-4 border-r border-red-500/30 flex items-center gap-2 shrink-0 bg-[#05060a]/80 z-10 shadow-[10px_0_10px_rgba(5,6,10,1)]">
          <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-ping-glow'}`} />
          {isPaused ? 'STREAM PAUSED' : 'LIVE FEED'}
        </div>
        <div className="overflow-hidden flex-1 relative flex">
          <div className="flex whitespace-nowrap min-w-max" style={{ animation: 'ticker 50s linear infinite' }}>
            {[1, 2].map(iter => (
              <React.Fragment key={iter}>
                {attacks.length > 0
                  ? attacks.slice(0, 12).map(a => (
                    <span key={`${a.id}-${iter}`}>
                      {a.attack_type} FLOOD: {a.source_country} → {a.target_country} ({a.packets_per_sec.toLocaleString()} pkt/s · SEV {a.severity})
                      <span className="mx-8 opacity-40">|</span>
                    </span>
                  ))
                  : <span>ANALYZING NETWORK FLOW SIGNATURES<span className="mx-8 opacity-40">|</span></span>
                }
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Intel ticker */}
      <div className="w-full bg-orange-950/20 border-b border-orange-500/10 text-orange-400 py-1 text-[9px] uppercase tracking-widest font-mono flex items-center overflow-hidden shrink-0">
        <div className="font-bold px-4 border-r border-orange-500/20 flex items-center gap-2 shrink-0 bg-[#05060a]/90 z-10 shadow-[10px_0_10px_rgba(5,6,10,1)] text-orange-500">
          <Radio size={9} /> INTEL
        </div>
        <div className="overflow-hidden flex-1 relative flex">
          <div className="flex whitespace-nowrap min-w-max" style={{ animation: 'ticker 80s linear infinite' }}>
            {[1, 2].map(iter => (
              <React.Fragment key={iter}>
                {news.length > 0
                  ? news.map((item, idx) => (
                    <span key={`${idx}-${iter}`}>
                      <span className="text-gray-300">[{item.source}]</span> {item.title}
                      <span className="mx-8 opacity-40">|</span>
                    </span>
                  ))
                  : <span>SYNCING INTEL FEEDS...<span className="mx-8 opacity-40">|</span></span>
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
    <div className="p-4 border-b border-white/5 bg-black/30 shrink-0">
      <div className="flex justify-between text-[9px] text-gray-500 font-mono tracking-widest mb-2">
        <span className="text-[#ff3b3b]">SYN {SYN}%</span>
        <span className="text-[#ff8c00]">UDP {UDP}%</span>
        <span className="text-[#ffd700]">HTTP {HTTP}%</span>
      </div>
      <div className="w-full h-1.5 rounded-full flex overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
        <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${SYN}%` }} />
        <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${UDP}%` }} />
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
  const [showFullIntel, setShowFullIntel] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sessionStart] = useState(() => Date.now());
  const [sessionStartStr, setSessionStartStr] = useState('');
  const [uptime, setUptime] = useState(0);

  // Collapsible sidebar sections
  const [mlExpanded, setMlExpanded] = useState(false);
  const [mitreExpanded, setMitreExpanded] = useState(false);
  const [featureExpanded, setFeatureExpanded] = useState(false);

  // Hydration fix
  useEffect(() => {
    setSessionStartStr(new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }));
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

  // Threat score (derived from avg severity)
  const threatScore = useMemo(() => {
    return stats.avg_severity;
  }, [stats.avg_severity]);

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
        case 't':
          setIsDarkMode(d => !d);
          break;
        case '?':
          setShowShortcuts(s => !s);
          break;
        case 'escape':
          setSelectedAttack(null);
          setShowFullIntel(false);
          setSelectedCountry(null);
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

  const handleSelectAttack = (attack: AttackEvent) => {
    setSelectedAttack(attack);
    setShowFullIntel(false);
    setSelectedCountry(null);
  };

  const handleCountryClick = (countryName: string) => {
    setSelectedCountry(countryName);
    setSelectedAttack(null);
    setShowFullIntel(false);
  };

  const handleViewFullIntel = () => {
    setShowFullIntel(true);
  };

  return (
    <div className={`flex h-screen w-full overflow-hidden flex-col ${isDarkMode ? 'dark' : 'light'}`} style={{ background: 'var(--bg-primary)' }}>
      {/* ── Tickers ── */}
      <Ticker attacks={visibleAttacks} news={news} isPaused={isPaused} />

      {/* ── Main Content — Globe + Sidebar ── */}
      <main className="flex-1 flex flex-col md:flex-row min-h-0">

        {/* LEFT — Full-bleed Globe */}
        <section className="relative flex-1 h-full">
          <GlobeView
            attacks={visibleAttacks}
            selectedAttack={selectedAttack}
            onSelectAttack={handleSelectAttack}
            onCountryClick={handleCountryClick}
          />

          {/* Attack Detail overlay (quick-look card on globe) */}
          <AttackDetail
            attack={selectedAttack}
            onClose={() => { setSelectedAttack(null); setShowFullIntel(false); }}
            onViewFullIntel={handleViewFullIntel}
          />

          {/* IP Intelligence full slide-in (over globe, on demand) */}
          {showFullIntel && selectedAttack && (
            <div className="absolute inset-0 z-50 pointer-events-none">
              <div className="pointer-events-auto h-full">
                <IPIntelPanel
                  attack={selectedAttack}
                  onClose={() => setShowFullIntel(false)}
                  sessionHistory={attacks}
                />
              </div>
            </div>
          )}

          {/* Country Stats Panel (over globe, on demand) */}
          {selectedCountry && (
            <CountryPanel
              countryName={selectedCountry}
              attacks={visibleAttacks}
              onClose={() => setSelectedCountry(null)}
            />
          )}
        </section>

        {/* RIGHT — Sidebar */}
        <aside className="w-full md:w-[320px] lg:w-[380px] flex flex-col h-full border-l border-white/10 bg-black/40 backdrop-blur-md relative z-10 shrink-0 overflow-y-auto">
          {/* Top Bar */}
          <TopBar
            threatScore={threatScore || 0}
            isConnected={isConnected && !isPaused}
          />

          {/* Header controls */}
          <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-b border-white/5 bg-black/20 shrink-0">
            <button onClick={() => exportData(attacks, 'csv')} title="Export CSV" className="text-gray-500 hover:text-white transition-colors p-1.5 rounded hover:bg-white/8">
              <Download size={14} />
            </button>
            <button onClick={() => setIsDarkMode(d => !d)} className="text-gray-500 hover:text-white transition-colors p-1.5 rounded hover:bg-white/8">
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button onClick={() => setShowShortcuts(true)} className="text-gray-500 hover:text-[#00d4ff] transition-colors p-1.5 rounded hover:bg-white/8">
              <HelpCircle size={14} />
            </button>
          </div>

          {/* Filters */}
          <FiltersBar
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />

          {/* KPI Cards */}
          <KPICards
            stats={stats}
            accuracy={metrics?.accuracy ?? 0}
            modelName={metrics?.model_name ?? 'RandomForest'}
          />

          {/* Type breakdown */}
          <TypeBar stats={typeBreakdown} />

          {/* Attack Table */}
          <AttackTable
            attacks={visibleAttacks}
            onSelectAttack={handleSelectAttack}
          />

          {/* Threat Intel Feed */}
          <ThreatIntelFeed activeAttacks={visibleAttacks} news={news} loading={newsLoading} />

          {/* ── Collapsible: ML Panel ── */}
          <div className="border-t border-white/10 bg-black/60 shrink-0">
            <button
              onClick={() => setMlExpanded(!mlExpanded)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors"
            >
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">🧠 ML Detection Engine</span>
              {mlExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
            </button>
            {mlExpanded && <MLPanel metrics={metrics} uptime={uptime} />}
          </div>

          {/* ── Collapsible: MITRE ── */}
          <div className="border-t border-white/10 bg-black/60 shrink-0">
            <button
              onClick={() => setMitreExpanded(!mitreExpanded)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors"
            >
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">🛡️ MITRE ATT&CK Session</span>
              {mitreExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
            </button>
            {mitreExpanded && <MITREPanel attacks={visibleAttacks} />}
          </div>

          {/* ── Collapsible: Feature Importance ── */}
          <div className="border-t border-white/10 bg-black/60 shrink-0">
            <button
              onClick={() => setFeatureExpanded(!featureExpanded)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors"
            >
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">📊 Feature Importance (SHAP)</span>
              {featureExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
            </button>
            {featureExpanded && <FeatureImportancePanel metrics={metrics} />}
          </div>

          {/* Connection Status */}
          <ConnectionStatusBar
            status={connectionStatus}
            eventsPerSec={parseFloat(eventsPerSec.toFixed(2))}
            totalProcessed={stats.total_events}
          />
        </aside>
      </main>

      {/* ── Footer ── */}
      <footer className="w-full h-6 bg-black border-t border-white/10 flex items-center justify-between px-4 text-[9px] font-mono text-gray-500 shrink-0">
        <div className="flex gap-6">
          <span suppressHydrationWarning>Session: {sessionStartStr || '--:--:--'}</span>
          <span>Total: {attacks.length.toLocaleString()} events</span>
          <span>{stats.unique_countries} countries</span>
        </div>
        <div className="hidden md:flex gap-6">
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
