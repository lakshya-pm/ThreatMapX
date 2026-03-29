import { useState, useEffect } from 'react';

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  summary: string;
}

export function useThreatIntel() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news');
        if (res.ok) {
          const data = await res.json();
          setNews(data);
        }
      } catch (e) {
        console.error("Failed to fetch Intel", e);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
    
    const interval = setInterval(fetchNews, 60000);
    return () => clearInterval(interval);
  }, []);

  return { news, loading };
}
