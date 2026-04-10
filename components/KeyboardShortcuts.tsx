'use client';

import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'S', desc: 'Filter SYN attacks', color: 'text-[#ff3b3b]' },
  { key: 'U', desc: 'Filter UDP attacks', color: 'text-[#ff8c00]' },
  { key: 'H', desc: 'Filter HTTP attacks', color: 'text-[#ffd700]' },
  { key: 'A', desc: 'Show all attacks', color: 'text-white' },
  { key: 'Space', desc: 'Pause / resume stream', color: 'text-gray-300' },
  { key: 'F', desc: 'Toggle fullscreen globe', color: 'text-gray-300' },
  { key: 'T', desc: 'Toggle dark / light theme', color: 'text-gray-300' },
  { key: 'Esc', desc: 'Close panels / modals', color: 'text-gray-300' },
  { key: '?', desc: 'Show this help', color: 'text-[#00d4ff]' },
];

export default function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0d1520] border border-[#00d4ff]/20 rounded-xl shadow-2xl p-6 w-80 z-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-[#00d4ff]" />
            <span className="text-sm font-bold text-gray-200 uppercase tracking-widest">Keyboard Shortcuts</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map(s => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{s.desc}</span>
              <kbd className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/8 border border-white/12 ${s.color}`}>
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
