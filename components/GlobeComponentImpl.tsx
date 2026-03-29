'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { AttackEvent } from '../types/attack';
import countriesGeoJson from './countries.geojson.json';

interface GlobeComponentProps {
  attacks: AttackEvent[];
  selectedAttack: AttackEvent | null;
  onSelectAttack: (attack: AttackEvent) => void;
}

export default function GlobeComponentImpl({ attacks, selectedAttack, onSelectAttack }: GlobeComponentProps) {
  const globeEl = useRef<any>();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (globeEl.current) {
      const controls = globeEl.current.controls();
      controls.autoRotate = !isPaused;
      controls.autoRotateSpeed = 0.3;
    }
  }, [isPaused]);

  useEffect(() => {
    if (selectedAttack && globeEl.current) {
      globeEl.current.pointOfView({ 
        lat: selectedAttack.dstLat, 
        lng: selectedAttack.dstLng, 
        altitude: 2 
      }, 1000);
      setIsPaused(true);
    }
  }, [selectedAttack]);

  useEffect(() => {
    const onResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', onResize);
    setTimeout(onResize, 100);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const getArcColor = (type: string) => {
    const c: Record<string, string> = { 
      SYN: 'rgba(255,40,40,0.9)', 
      UDP: 'rgba(255,140,0,0.9)', 
      HTTP: 'rgba(0,210,255,0.9)' 
    };
    return c[type] || 'rgba(200,200,200,0.7)';
  };

  const getRingColor = (type: string) => {
    const c: Record<string, string> = { 
      SYN: 'rgba(255,40,40,0.4)', 
      UDP: 'rgba(255,140,0,0.4)', 
      HTTP: 'rgba(0,210,255,0.4)' 
    };
    return c[type] || 'rgba(200,200,200,0.4)';
  };

  const visibleArcs = useMemo(() => attacks.slice(0, 5), [attacks]);

  // Debug: verify arc data shape on first render
  if (visibleArcs.length > 0 && typeof window !== 'undefined') {
    console.log('[ThreatMapX] First arc object:', visibleArcs[0]);
  }

  const ringsData = attacks.slice(0, 5).map(atk => ({
    lat: atk.dstLat,
    lng: atk.dstLng,
    maxR: 3,
    propagationSpeed: 2,
    repeatPeriod: 800,
    color: getRingColor(atk.attackType)
  }));

  const { attackCountries, countryAttackCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    const countries = new Set<string>();
    attacks.forEach(atk => {
      counts[atk.dstCountry] = (counts[atk.dstCountry] || 0) + 1;
      countries.add(atk.dstCountry);
    });
    return { attackCountries: countries, countryAttackCount: counts };
  }, [attacks]);

  const attackedFeatures = useMemo(() => {
    return ((countriesGeoJson as any).features as any[]).filter(f => {
      const name = f.properties.NAME || f.properties.name || f.properties.ADMIN || '';
      return attackCountries.has(name);
    });
  }, [attackCountries]);

  let interactionTimeout: any = null;
  const handleInteraction = () => {
    setIsPaused(true);
    if (interactionTimeout) clearTimeout(interactionTimeout);
    interactionTimeout = setTimeout(() => {
      if (!selectedAttack) setIsPaused(false);
    }, 5000);
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative cursor-move"
      onMouseDown={handleInteraction}
      onTouchStart={handleInteraction}
      onWheel={handleInteraction}
    >
      <div className="absolute bottom-4 right-4 z-40 text-[10px] uppercase font-mono tracking-widest text-gray-500 bg-black/40 px-2 py-1 rounded backdrop-blur border border-white/5">
        {isPaused ? '⏸ paused' : '⟳ rotating'}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 text-[10px] uppercase font-mono tracking-widest text-gray-400 bg-black/60 border border-white/10 px-4 py-2 rounded-full backdrop-blur shadow-lg">
        ⌨ Press <span className="text-white">S/U/H/A</span> to filter · <span className="text-white">Space</span> to pause
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

          polygonsData={attackedFeatures}
          polygonCapColor={(f: any) => {
            const name = f.properties.NAME || f.properties.name || f.properties.ADMIN || '';
            const count = countryAttackCount[name] || 0;
            if (count >= 9) return 'rgba(255,30,30,0.25)';
            if (count >= 4) return 'rgba(255,80,0,0.18)';
            return 'rgba(255,120,0,0.10)';
          }}
          polygonSideColor={() => 'rgba(0,0,0,0)'}
          polygonStrokeColor={() => '#1e3a5a'}
          polygonAltitude={0.005}
          
          arcsData={visibleArcs}
          arcStartLat={(d: any) => d.srcLat}
          arcStartLng={(d: any) => d.srcLng}
          arcEndLat={(d: any) => d.dstLat}
          arcEndLng={(d: any) => d.dstLng}
          arcDashLength={0.6}
          arcDashGap={0.4}
          arcDashAnimateTime={3000}
          arcDashInitialGap={() => Math.random()}
          arcColor={(d: any) => {
            const c: Record<string, string> = {
              SYN: 'rgba(255,50,50,0.9)',
              UDP: 'rgba(255,150,0,0.9)',
              HTTP: 'rgba(0,210,255,0.9)'
            };
            return c[d.attackType] || 'rgba(200,200,200,0.8)';
          }}
          arcStroke={0.4}
          arcAltitude={0.3}
          
          ringsData={ringsData}
          ringColor={(d: any) => d.color}
          ringMaxRadius={(d: any) => d.maxR}
          ringPropagationSpeed={(d: any) => d.propagationSpeed}
          ringRepeatPeriod={(d: any) => d.repeatPeriod}
          
          rendererConfig={{ 
            antialias: false,
            alpha: true,
            powerPreference: 'high-performance'
          }}
          animateIn={false}
          waitForGlobeReady={true}

          onArcClick={(d: any) => onSelectAttack(d)}
        />
      )}
    </div>
  );
}
