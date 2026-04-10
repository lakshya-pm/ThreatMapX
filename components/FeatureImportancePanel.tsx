'use client';

import React from 'react';
import { BarChart2 } from 'lucide-react';
import { ModelMetrics } from '@/types/attack';

interface FeatureImportancePanelProps {
  metrics: ModelMetrics | null;
}

export default function FeatureImportancePanel({ metrics }: FeatureImportancePanelProps) {
  const items = metrics?.feature_importance_top10 ?? [
    { feature: 'SYN Flag Count', shap_value: 0.31 },
    { feature: 'Flow Packets/s', shap_value: 0.24 },
    { feature: 'Flow Bytes/s', shap_value: 0.19 },
    { feature: 'Fwd PSH Flags', shap_value: 0.14 },
    { feature: 'ACK Flag Count', shap_value: 0.08 },
  ];

  const maxVal = Math.max(...items.map(i => i.shap_value), 0.01);

  return (
    <div className="border-t border-white/8 bg-black/30 shrink-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <BarChart2 size={13} className="text-purple-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">
          Feature Importance
          <span className="text-gray-600 font-normal ml-1 normal-case">(SHAP mean |value|)</span>
        </span>
      </div>
      <div className="px-4 py-3 space-y-2">
        {items.map(item => {
          const pct = Math.round((item.shap_value / maxVal) * 100);
          return (
            <div key={item.feature} className="space-y-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-300 truncate pr-2" title={item.feature}>{item.feature}</span>
                <span className="font-mono text-[#00d4ff] shrink-0">{item.shap_value.toFixed(2)}</span>
              </div>
              <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#00d4ff] to-purple-500 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
