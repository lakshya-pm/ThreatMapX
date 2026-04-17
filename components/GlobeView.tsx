'use client';

import dynamic from 'next/dynamic';
import { AttackEvent } from '@/types/attack';

const GlobeComponent = dynamic(() => import('./GlobeComponentImpl'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#080d14]">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 border-2 border-cyan-500/40 border-t-cyan-500 rounded-full animate-spin mx-auto" />
        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest animate-pulse">
          Initializing Globe...
        </p>
      </div>
    </div>
  ),
});

interface GlobeViewProps {
  attacks: AttackEvent[];
  selectedAttack: AttackEvent | null;
  onSelectAttack: (attack: AttackEvent) => void;
  onCountryClick?: (countryName: string) => void;
}

export default function GlobeView(props: GlobeViewProps) {
  return <GlobeComponent {...props} />;
}
