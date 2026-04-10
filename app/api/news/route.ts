import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

type NewsItem = {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  summary: string;
};

type RssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  description?: string;
};

const parser = new Parser<Record<string, unknown>, RssItem>({
  customFields: { item: ['description'] },
});

const FEEDS = [
  { url: 'https://feeds.feedburner.com/TheHackersNews', name: 'The Hacker News' },
  { url: 'https://www.bleepingcomputer.com/feed/', name: 'BleepingComputer' },
];

export async function GET() {
  try {
    const feedPromises = FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return parsed.items.map((item: RssItem): NewsItem => ({
        title: item.title ?? 'No Title',
        link: item.link ?? '',
        pubDate: item.pubDate ?? new Date().toISOString(),
        source: feed.name,
        summary: (item.contentSnippet ?? item.content ?? item.description ?? '')
          .replace(/<[^>]*>?/gm, '')
          .substring(0, 100)
          .trim() + '...',
      }));
    });

    const results = await Promise.allSettled(feedPromises);
    let merged: NewsItem[] = [];

    results.forEach(res => {
      if (res.status === 'fulfilled') {
        merged = [...merged, ...res.value];
      } else {
        console.error('Failed to fetch a feed:', res.reason);
      }
    });

    merged.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    return NextResponse.json(merged.slice(0, 15));
  } catch (error) {
    console.error('Error fetching RSS feeds:', error);
    return NextResponse.json({ error: 'Failed to fetch threat intel' }, { status: 500 });
  }
}
