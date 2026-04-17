import React, { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChevronDown, ChevronUp, Radio, Link as LinkIcon } from 'lucide-react';
import { AttackEvent } from '@/types/attack';
import { NewsItem } from '@/hooks/useThreatIntel';

interface ThreatIntelFeedProps {
  activeAttacks: AttackEvent[];
  news: NewsItem[];
  loading: boolean;
}

export default function ThreatIntelFeed({ activeAttacks, news, loading }: ThreatIntelFeedProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getCorrelatedStatus = (item: NewsItem) => {
    const lowerText = (item.title + ' ' + item.summary).toLowerCase();

    // Check keywords
    const keywords = ['syn', 'udp', 'http', 'ddos', 'flood'];
    const hasKeyword = keywords.some(k => lowerText.includes(k));
    if (hasKeyword) return true;

    // Check active countries
    const activeCountries = Array.from(new Set(activeAttacks.map(a => a.source_country.toLowerCase())));
    const hasCountry = activeCountries.some(c => lowerText.includes(c));
    return hasCountry;
  };

  const getRecencyColor = (pubDate: string) => {
    const hours = (Date.now() - new Date(pubDate).getTime()) / (1000 * 60 * 60);
    return hours < 2 ? 'bg-red-500 animate-pulse' : 'bg-orange-500';
  };

  return (
    <div className="border-t border-white/10 bg-black/60 shrink-0 flex flex-col max-h-64">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors shrink-0"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-widest">
          <Radio size={14} className="text-orange-400" />
          📡 LIVE THREAT INTEL
        </div>
        {isExpanded ? <ChevronUp size={14} className="text-gray-500"/> : <ChevronDown size={14} className="text-gray-500"/>}
      </button>

      {isExpanded && (
        <div className="flex-1 overflow-y-auto bg-black/40 border-t border-white/5 p-2 space-y-2">
          {loading ? (
            <div className="p-4 text-center text-[10px] text-gray-500 font-mono animate-pulse">
              SYNCING INTEL FEEDS...
            </div>
          ) : news.length === 0 ? (
            <div className="p-4 text-center text-[10px] text-gray-500 font-mono">
              NO INTEL CURRENTLY AVAILABLE
            </div>
          ) : (
            news.map((item, idx) => {
              const isCorrelated = getCorrelatedStatus(item);
              return (
                <a
                  key={idx}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-white/5 border border-white/5 rounded hover:bg-[rgba(255,100,0,0.1)] hover:border-orange-500/30 transition-all group"
                >
                  <div className="flex gap-2 items-start">
                    <div className="pt-1.5 shrink-0">
                      <span className={`block w-2 h-2 rounded-full ${getRecencyColor(item.pubDate)}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-gray-200 leading-snug line-clamp-2 group-hover:text-orange-300 transition-colors">
                        {item.title}
                      </h4>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[9px] font-mono tracking-wider">
                        <span className="text-gray-400">{item.source}</span>
                        <span className="text-gray-600">•</span>
                        <span className="text-gray-500">
                          {formatDistanceToNowStrict(new Date(item.pubDate), { addSuffix: true })}
                        </span>

                        {isCorrelated && (
                          <div className="ml-auto inline-flex items-center gap-1 bg-orange-950/40 border border-orange-500/30 text-orange-400 px-1.5 py-0.5 rounded text-[8px] uppercase font-bold">
                            <LinkIcon size={8} />
                            Correlated
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </a>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
