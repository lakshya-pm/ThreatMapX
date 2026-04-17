'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { AttackEvent } from '@/types/attack';
import countriesGeoJson from './countries.geojson.json';

interface GlobeComponentProps {
  attacks: AttackEvent[];
  selectedAttack: AttackEvent | null;
  onSelectAttack: (attack: AttackEvent) => void;
  onCountryClick?: (countryName: string) => void;
}

const ARC_COLORS: Record<string, [string, string]> = {
  SYN:  ['rgba(255, 70, 70, 0.85)', 'rgba(255, 70, 70, 0.08)'],
  UDP:  ['rgba(255, 160, 40, 0.85)', 'rgba(255, 160, 40, 0.08)'],
  HTTP: ['rgba(255, 220, 60, 0.85)', 'rgba(255, 220, 60, 0.08)'],
};

const POINT_COLORS: Record<string, string> = {
  SYN:  '#ff4646',
  UDP:  '#ffa028',
  HTTP: '#ffdc3c',
};

const RING_COLORS: Record<string, string> = {
  SYN:  'rgba(255, 70, 70, 0.35)',
  UDP:  'rgba(255, 160, 40, 0.35)',
  HTTP: 'rgba(255, 220, 60, 0.35)',
};

type GeoFeature = { properties: Record<string, string> };

export default function GlobeComponentImpl({ attacks, selectedAttack, onSelectAttack, onCountryClick }: GlobeComponentProps) {
  const globeEl = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Resize observer ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', onResize);
    setTimeout(onResize, 100);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Auto-rotate control ──────────────────────────────────────────────────────
  useEffect(() => {
    if (globeEl.current) {
      const controls = globeEl.current.controls();
      controls.autoRotate = isAutoRotating;
      controls.autoRotateSpeed = 0.4;
    }
  }, [isAutoRotating]);

  // ── Snap to selected attack ──────────────────────────────────────────────────
  useEffect(() => {
    if (selectedAttack && globeEl.current) {
      globeEl.current.pointOfView(
        { lat: selectedAttack.target_lat, lng: selectedAttack.target_lng, altitude: 1.8 },
        1200,
      );
      setIsAutoRotating(false);
    }
  }, [selectedAttack]);

  // Auto-snap on severity > 80 (most recent high-sev attack)
  const lastHighSev = useMemo(() => {
    return attacks.find(a => a.severity > 80);
  }, [attacks]);

  useEffect(() => {
    if (lastHighSev && globeEl.current && !selectedAttack) {
      globeEl.current.pointOfView(
        { lat: lastHighSev.target_lat, lng: lastHighSev.target_lng, altitude: 2 },
        800,
      );
    }
  }, [lastHighSev?.id, selectedAttack]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInteraction = useCallback(() => {
    setIsAutoRotating(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (!selectedAttack) setIsAutoRotating(true);
    }, 5000);
  }, [selectedAttack]);

  // ── Arc buffer — max 6 arcs for a clean visual ──────────────────────────────
  const arcsMemo = useMemo(() => attacks.slice(-6), [attacks]);

  // ── Points at attack sources (last 6) — subtle pinpoints ────────────────────
  const pointsData = useMemo(() => attacks.slice(-6), [attacks]);

  // ── Rings at target coords (last 4 non-benign) ──────────────────────────────
  const ringsData = useMemo(() =>
    attacks.slice(-4).map(atk => ({
      lat: atk.target_lat,
      lng: atk.target_lng,
      maxR: Math.max(0.8, Math.min(3, atk.severity / 25)),
      propagationSpeed: 1.5,
      repeatPeriod: 1200,
      color: RING_COLORS[atk.attack_type] ?? 'rgba(200,200,200,0.25)',
    })),
    [attacks],
  );

  // ── Country heatmap ───────────────────────────────────────────────────────────
  const { srcCounts, dstCounts } = useMemo(() => {
    const src: Record<string, number> = {};
    const dst: Record<string, number> = {};
    attacks.forEach(a => {
      src[a.source_country] = (src[a.source_country] ?? 0) + 1;
      dst[a.target_country] = (dst[a.target_country] ?? 0) + 1;
    });
    return { srcCounts: src, dstCounts: dst };
  }, [attacks]);

  const top5Src = useMemo(() =>
    new Set(Object.entries(srcCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c)),
    [srcCounts],
  );
  const top5Dst = useMemo(() =>
    new Set(Object.entries(dstCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c)),
    [dstCounts],
  );

  const getCountryName = (f: GeoFeature) =>
    f.properties.NAME ?? f.properties.name ?? f.properties.ADMIN ?? '';

  const polygonCapColor = useCallback((f: unknown) => {
    const name = getCountryName(f as GeoFeature);
    if (top5Src.has(name)) return 'rgba(255, 59, 59, 0.22)';
    if (top5Dst.has(name)) return 'rgba(255, 140, 0, 0.18)';
    return 'rgba(0, 180, 255, 0.04)';
  }, [top5Src, top5Dst]);

  const polygonAlt = useCallback((f: unknown) => {
    const name = getCountryName(f as GeoFeature);
    if (top5Src.has(name)) return 0.015;
    if (top5Dst.has(name)) return 0.01;
    return 0.001;
  }, [top5Src, top5Dst]);

  // ── Arc styling — thin comet trails ───────────────────────────────────────────
  const arcAltitude = useCallback((d: unknown) => {
    const atk = d as AttackEvent;
    const dist = Math.sqrt(
      Math.pow(atk.target_lat - atk.source_lat, 2) +
      Math.pow(atk.target_lng - atk.source_lng, 2)
    );
    // Gentle curves: short arcs stay low, long arcs cap at 0.45
    return Math.min(0.45, Math.max(0.08, dist / 300));
  }, []);

  const arcStroke = useCallback((d: unknown) => {
    const atk = d as AttackEvent;
    // Thin elegant lines: 0.15 base, max 0.8 for extreme severity
    return Math.max(0.15, Math.min(0.8, atk.severity / 120));
  }, []);

  const arcColor = useCallback((d: unknown) => {
    const atk = d as AttackEvent;
    return ARC_COLORS[atk.attack_type] ?? ['rgba(200, 200, 200, 0.5)', 'rgba(200,200,200,0.05)'];
  }, []);

  const arcLabel = useCallback((d: unknown) => {
    const atk = d as AttackEvent;
    return `<div style="font-size:11px;font-family:'JetBrains Mono',monospace;background:rgba(8,13,20,0.92);padding:8px 12px;border-radius:8px;border:1px solid rgba(0,212,255,0.15);box-shadow:0 4px 20px rgba(0,0,0,0.5);backdrop-filter:blur(8px)">
      <b style="color:#e2e8f0">${atk.source_country}</b> <span style="color:#64748b">&rarr;</span> <b style="color:#e2e8f0">${atk.target_country}</b><br/>
      <span style="color:${POINT_COLORS[atk.attack_type] ?? '#ccc'};font-weight:700">${atk.attack_type}</span> <span style="color:#475569">&middot;</span> <span style="color:#94a3b8">${atk.packets_per_sec.toLocaleString()} pkt/s</span> <span style="color:#475569">&middot;</span> <span style="color:${atk.severity > 80 ? '#ef4444' : atk.severity > 60 ? '#f59e0b' : '#22c55e'}">SEV ${atk.severity}</span>
    </div>`;
  }, []);

  // ── Country click handler ─────────────────────────────────────────────────────
  const handlePolygonClick = useCallback((polygon: unknown) => {
    const name = getCountryName(polygon as GeoFeature);
    if (name && onCountryClick) onCountryClick(name);
  }, [onCountryClick]);

  const polygonLabel = useCallback((f: unknown) => {
    const name = getCountryName(f as GeoFeature);
    const srcN = srcCounts[name] || 0;
    const dstN = dstCounts[name] || 0;
    if (srcN === 0 && dstN === 0) return '';
    return `<div style="font-size:11px;font-family:'JetBrains Mono',monospace;background:rgba(8,13,20,0.92);padding:8px 12px;border-radius:8px;border:1px solid rgba(0,212,255,0.15);box-shadow:0 4px 20px rgba(0,0,0,0.5)">
      <b style="color:#e2e8f0">${name}</b><br/>
      <span style="color:#94a3b8">Outbound: ${srcN} &middot; Inbound: ${dstN}</span>
    </div>`;
  }, [srcCounts, dstCounts]);

  return (
    <div
      ref={containerRef}
      className="globe-wrapper w-full h-full relative cursor-move"
      onMouseDown={handleInteraction}
      onTouchStart={handleInteraction}
      onWheel={handleInteraction}
    >
      {/* Status badge */}
      <div className="absolute bottom-4 right-4 z-40 text-[10px] uppercase font-mono tracking-widest text-gray-500 bg-black/50 px-2 py-1 rounded backdrop-blur border border-white/5">
        {isAutoRotating ? '⟳ auto-rotate' : '⏸ paused'}
      </div>

      {/* Keyboard hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 text-[10px] uppercase font-mono tracking-widest text-gray-400 bg-black/60 border border-white/10 px-4 py-2 rounded-full backdrop-blur shadow-lg pointer-events-none">
        <span className="text-white">S/U/H/A</span> filter · <span className="text-white">Space</span> pause · <span className="text-white">Click country</span> stats
      </div>

      {dimensions.width > 0 && (
        <Globe
          ref={globeEl}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"

          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          atmosphereColor="#1a6fa8"
          atmosphereAltitude={0.2}

          polygonsData={(countriesGeoJson as { features: object[] }).features}
          polygonCapColor={polygonCapColor}
          polygonSideColor={() => 'rgba(0, 100, 255, 0.0)'}
          polygonStrokeColor={() => 'rgba(255,255,255,0.06)'}
          polygonAltitude={polygonAlt}
          polygonLabel={polygonLabel}
          onPolygonClick={handlePolygonClick}
          polygonsTransitionDuration={300}

          arcsData={arcsMemo}
          arcStartLat={(d: unknown) => (d as AttackEvent).source_lat}
          arcStartLng={(d: unknown) => (d as AttackEvent).source_lng}
          arcEndLat={(d: unknown) => (d as AttackEvent).target_lat}
          arcEndLng={(d: unknown) => (d as AttackEvent).target_lng}
          arcAltitude={arcAltitude}
          arcStroke={arcStroke}
          arcDashLength={0.6}
          arcDashGap={1.2}
          arcDashAnimateTime={3500}
          arcDashInitialGap={() => Math.random() * 2}
          arcColor={arcColor}
          arcLabel={arcLabel}
          onArcClick={(d: unknown) => onSelectAttack(d as AttackEvent)}

          pointsData={pointsData}
          pointLat={(d: unknown) => (d as AttackEvent).source_lat}
          pointLng={(d: unknown) => (d as AttackEvent).source_lng}
          pointColor={(d: unknown) => POINT_COLORS[(d as AttackEvent).attack_type] ?? '#00d4ff'}
          pointAltitude={0.005}
          pointRadius={(d: unknown) => Math.max(0.15, Math.min(0.5, (d as AttackEvent).severity / 200))}
          pointsMerge={false}

          ringsData={ringsData}
          ringColor={(d: unknown) => (d as { color: string }).color}
          ringMaxRadius={(d: unknown) => (d as { maxR: number }).maxR}
          ringPropagationSpeed={(d: unknown) => (d as { propagationSpeed: number }).propagationSpeed}
          ringRepeatPeriod={(d: unknown) => (d as { repeatPeriod: number }).repeatPeriod}

          rendererConfig={{ antialias: true, alpha: true }}
          animateIn={false}
          waitForGlobeReady={false}
        />
      )}
    </div>
  );
}
