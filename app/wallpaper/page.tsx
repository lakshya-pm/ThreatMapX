'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';

const Globe = dynamic(() => import('react-globe.gl').then(m => m.default), { ssr: false });
import countriesGeoJson from '@/components/countries.geojson.json';

// ── Types ──────────────────────────────────────────────────────────────────────
interface MockAttack {
  id: string;
  source_lat: number;
  source_lng: number;
  target_lat: number;
  target_lng: number;
  attack_type: 'SYN' | 'UDP' | 'HTTP';
  severity: number;
  packets_per_sec: number;
  source_country: string;
  target_country: string;
}

// ── Data pools ─────────────────────────────────────────────────────────────────
const REGIONS = [
  { name: 'China',          lat: 35.86,  lng: 104.19 },
  { name: 'United States',  lat: 37.09,  lng: -95.71 },
  { name: 'Russia',         lat: 55.75,  lng: 37.61  },
  { name: 'Germany',        lat: 52.52,  lng: 13.40  },
  { name: 'India',          lat: 28.61,  lng: 77.20  },
  { name: 'Brazil',         lat: -23.54, lng: -46.63 },
  { name: 'United Kingdom', lat: 51.50,  lng: -0.12  },
  { name: 'Japan',          lat: 35.68,  lng: 139.69 },
  { name: 'South Korea',    lat: 37.56,  lng: 126.97 },
  { name: 'Netherlands',    lat: 52.37,  lng: 4.89   },
  { name: 'Australia',      lat: -25.27, lng: 133.77 },
  { name: 'France',         lat: 48.86,  lng: 2.35   },
  { name: 'Singapore',      lat: 1.35,   lng: 103.82 },
  { name: 'Canada',         lat: 56.13,  lng: -106.35},
  { name: 'Iran',           lat: 32.43,  lng: 53.69  },
];

const ARC_COLORS: Record<string, [string, string]> = {
  SYN:  ['rgba(255, 59, 59, 0.9)',  'rgba(255, 59, 59, 0.2)'],
  UDP:  ['rgba(255, 140, 0, 0.9)',  'rgba(255, 140, 0, 0.2)'],
  HTTP: ['rgba(255, 215, 0, 0.9)',  'rgba(255, 215, 0, 0.2)'],
};

const POINT_COLORS: Record<string, string> = {
  SYN: '#ff3b3b', UDP: '#ff8c00', HTTP: '#ffd700',
};

const RING_COLORS: Record<string, string> = {
  SYN: 'rgba(255, 59, 59, 0.5)', UDP: 'rgba(255, 140, 0, 0.5)', HTTP: 'rgba(255, 215, 0, 0.5)',
};

type GeoFeature = { properties: Record<string, string> };

// ── Mock generator ─────────────────────────────────────────────────────────────
function generateAttack(): MockAttack {
  const types: Array<'SYN' | 'UDP' | 'HTTP'> = ['SYN', 'UDP', 'HTTP'];
  const weights = [0.4, 0.3, 0.3];
  const r = Math.random();
  const attack_type = r < weights[0] ? types[0] : r < weights[0] + weights[1] ? types[1] : types[2];

  const src = REGIONS[Math.floor(Math.random() * REGIONS.length)];
  let tgt = REGIONS[Math.floor(Math.random() * REGIONS.length)];
  while (tgt.name === src.name) tgt = REGIONS[Math.floor(Math.random() * REGIONS.length)];

  const jitter = () => (Math.random() - 0.5) * 6;

  return {
    id: Math.random().toString(36).slice(2),
    source_lat: src.lat + jitter(),
    source_lng: src.lng + jitter(),
    target_lat: tgt.lat + jitter(),
    target_lng: tgt.lng + jitter(),
    attack_type,
    severity: Math.floor(30 + Math.random() * 70),
    packets_per_sec: Math.floor(5000 + Math.random() * 75000),
    source_country: src.name,
    target_country: tgt.name,
  };
}

// ── Wallpaper Page ─────────────────────────────────────────────────────────────
export default function WallpaperPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeEl = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [attacks, setAttacks] = useState<MockAttack[]>(() => Array.from({ length: 8 }, generateAttack));

  // Resize
  useEffect(() => {
    const onResize = () => {
      setDims({ w: window.innerWidth, h: window.innerHeight });
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Auto-rotate
  useEffect(() => {
    if (globeEl.current) {
      const controls = globeEl.current.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.3;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableRotate = false;
    }
  });

  // Stream mock attacks
  useEffect(() => {
    const interval = setInterval(() => {
      setAttacks(prev => [...prev.slice(-7), generateAttack()]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const arcsMemo = useMemo(() => attacks.slice(-6), [attacks]);
  const pointsData = useMemo(() => attacks.slice(-6), [attacks]);
  const ringsData = useMemo(() =>
    attacks.slice(-3).map(a => ({
      lat: a.target_lat, lng: a.target_lng,
      maxR: Math.max(2, a.severity / 15),
      propagationSpeed: 1.5, repeatPeriod: 1200,
      color: RING_COLORS[a.attack_type],
    })), [attacks]);

  // Country heatmap
  const { srcSet, dstSet } = useMemo(() => {
    const src: Record<string, number> = {};
    const dst: Record<string, number> = {};
    attacks.forEach(a => {
      src[a.source_country] = (src[a.source_country] ?? 0) + 1;
      dst[a.target_country] = (dst[a.target_country] ?? 0) + 1;
    });
    return {
      srcSet: new Set(Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c)),
      dstSet: new Set(Object.entries(dst).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c)),
    };
  }, [attacks]);

  const getName = (f: GeoFeature) => f.properties.NAME ?? f.properties.name ?? f.properties.ADMIN ?? '';

  const polyColor = useCallback((f: unknown) => {
    const n = getName(f as GeoFeature);
    if (srcSet.has(n)) return 'rgba(255, 59, 59, 0.22)';
    if (dstSet.has(n)) return 'rgba(255, 140, 0, 0.18)';
    return 'rgba(0, 180, 255, 0.04)';
  }, [srcSet, dstSet]);

  const polyAlt = useCallback((f: unknown) => {
    const n = getName(f as GeoFeature);
    if (srcSet.has(n)) return 0.015;
    if (dstSet.has(n)) return 0.01;
    return 0.001;
  }, [srcSet, dstSet]);

  const arcAlt = useCallback((d: unknown) => {
    const a = d as MockAttack;
    const dist = Math.sqrt(Math.pow(a.target_lat - a.source_lat, 2) + Math.pow(a.target_lng - a.source_lng, 2));
    return Math.min(0.35, Math.max(0.08, dist / 350));
  }, []);

  const arcStroke = useCallback((d: unknown) => {
    return Math.max(0.4, Math.min(1.2, (d as MockAttack).severity / 80));
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw', height: '100vh', overflow: 'hidden',
        background: '#050a10', cursor: 'default',
      }}
    >
      {dims.w > 0 && (
        <Globe
          ref={globeEl}
          width={dims.w}
          height={dims.h}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          atmosphereColor="#1a6fa8"
          atmosphereAltitude={0.2}

          polygonsData={(countriesGeoJson as { features: object[] }).features}
          polygonCapColor={polyColor}
          polygonSideColor={() => 'rgba(0,0,0,0)'}
          polygonStrokeColor={() => 'rgba(255,255,255,0.06)'}
          polygonAltitude={polyAlt}
          polygonsTransitionDuration={300}

          arcsData={arcsMemo}
          arcStartLat={(d: unknown) => (d as MockAttack).source_lat}
          arcStartLng={(d: unknown) => (d as MockAttack).source_lng}
          arcEndLat={(d: unknown) => (d as MockAttack).target_lat}
          arcEndLng={(d: unknown) => (d as MockAttack).target_lng}
          arcAltitude={arcAlt}
          arcStroke={arcStroke}
          arcDashLength={0.8}
          arcDashGap={0.6}
          arcDashAnimateTime={2000}
          arcColor={(d: unknown) => ARC_COLORS[(d as MockAttack).attack_type] ?? ARC_COLORS.SYN}
          arcsTransitionDuration={400}

          pointsData={pointsData}
          pointLat={(d: unknown) => (d as MockAttack).target_lat}
          pointLng={(d: unknown) => (d as MockAttack).target_lng}
          pointColor={(d: unknown) => POINT_COLORS[(d as MockAttack).attack_type]}
          pointAltitude={0.005}
          pointRadius={(d: unknown) => Math.max(0.15, (d as MockAttack).severity / 150)}
          pointsMerge={false}

          ringsData={ringsData}
          ringColor={(d: unknown) => (d as { color: string }).color}
          ringMaxRadius={(d: unknown) => (d as { maxR: number }).maxR}
          ringPropagationSpeed={(d: unknown) => (d as { propagationSpeed: number }).propagationSpeed}
          ringRepeatPeriod={(d: unknown) => (d as { repeatPeriod: number }).repeatPeriod}

          rendererConfig={{ antialias: true, alpha: true }}
          animateIn={false}
        />
      )}
    </div>
  );
}
