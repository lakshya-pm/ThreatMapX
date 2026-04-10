'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { AttackEvent } from '@/types/attack';
import countriesGeoJson from './countries.geojson.json';

interface GlobeComponentProps {
  attacks: AttackEvent[];
  selectedAttack: AttackEvent | null;
  onSelectAttack: (attack: AttackEvent) => void;
}

const ARC_COLORS: Record<string, string> = {
  SYN:  'rgba(255, 59, 59, 0.85)',
  UDP:  'rgba(255, 140, 0, 0.85)',
  HTTP: 'rgba(255, 215, 0, 0.85)',
};

const RING_COLORS: Record<string, string> = {
  SYN:  'rgba(255, 59, 59, 0.5)',
  UDP:  'rgba(255, 140, 0, 0.5)',
  HTTP: 'rgba(255, 215, 0, 0.5)',
};

type GeoFeature = { properties: Record<string, string> };

export default function GlobeComponentImpl({ attacks, selectedAttack, onSelectAttack }: GlobeComponentProps) {
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
      controls.autoRotateSpeed = 0.3;
    }
  }, [isAutoRotating]);

  // ── Snap to severe attack ────────────────────────────────────────────────────
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

  // ── Arc buffer — NEVER more than 8 arcs ─────────────────────────────────────
  const arcsMemo = useMemo(() => attacks.slice(-8), [attacks]);

  // ── Rings at target coords (last 5 non-benign) ───────────────────────────────
  const ringsData = useMemo(() =>
    attacks.slice(-5).map(atk => ({
      lat: atk.target_lat,
      lng: atk.target_lng,
      maxR: Math.max(1, atk.severity / 10),
      propagationSpeed: 2,
      repeatPeriod: 800,
      color: RING_COLORS[atk.attack_type] ?? 'rgba(200,200,200,0.4)',
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
    if (top5Src.has(name)) return 'rgba(255, 59, 59, 0.18)';
    if (top5Dst.has(name)) return 'rgba(255, 140, 0, 0.18)';
    return 'rgba(0, 180, 255, 0.06)';
  }, [top5Src, top5Dst]);

  const arcStroke = useCallback((d: unknown) => {
    const atk = d as AttackEvent;
    const maxPPS = atk.attack_type === 'SYN' ? 80_000 : atk.attack_type === 'UDP' ? 60_000 : 50_000;
    return 0.3 + (Math.min(atk.packets_per_sec / maxPPS, 1) * 3.2);
  }, []);

  const arcColor = useCallback((d: unknown) => {
    const atk = d as AttackEvent;
    return ARC_COLORS[atk.attack_type] ?? 'rgba(200, 200, 200, 0.7)';
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative cursor-move"
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
        <span className="text-white">S/U/H/A</span> filter · <span className="text-white">Space</span> pause · <span className="text-white">?</span> shortcuts
      </div>

      {dimensions.width > 0 && (
        <Globe
          ref={globeEl}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"

          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          atmosphereColor="deepskyblue"
          atmosphereAltitude={0.15}

          polygonsData={(countriesGeoJson as { features: object[] }).features}
          polygonCapColor={polygonCapColor}
          polygonSideColor={() => 'rgba(0, 100, 255, 0.0)'}
          polygonStrokeColor={() => '#1a3a4a'}
          polygonAltitude={0.005}

          arcsData={arcsMemo}
          arcStartLat={(d: unknown) => (d as AttackEvent).source_lat}
          arcStartLng={(d: unknown) => (d as AttackEvent).source_lng}
          arcEndLat={(d: unknown) => (d as AttackEvent).target_lat}
          arcEndLng={(d: unknown) => (d as AttackEvent).target_lng}
          arcStroke={arcStroke}
          arcDashLength={0.4}
          arcDashGap={2}
          arcDashAnimateTime={4000}
          arcDashInitialGap={() => Math.random()}
          arcAltitudeAutoScale={0.3}
          arcColor={arcColor}
          onArcClick={(d: unknown) => onSelectAttack(d as AttackEvent)}

          ringsData={ringsData}
          ringColor={(d: unknown) => (d as { color: string }).color}
          ringMaxRadius={(d: unknown) => (d as { maxR: number }).maxR}
          ringPropagationSpeed={(d: unknown) => (d as { propagationSpeed: number }).propagationSpeed}
          ringRepeatPeriod={(d: unknown) => (d as { repeatPeriod: number }).repeatPeriod}

          rendererConfig={{ antialias: false, alpha: true }}
          animateIn={false}
          waitForGlobeReady={false}
        />
      )}
    </div>
  );
}
