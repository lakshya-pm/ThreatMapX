import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

export const revalidate = 60; // Revalidate every 60 seconds
export const dynamic = 'force-dynamic'; // Prevent static cache building in dev/prod

const parser = new Parser({
  customFields: {
    item: ['description']
  }
});

const FEEDS = [
  { url: 'https://feeds.feedburner.com/TheHackersNews', name: 'The Hacker News' },
  { url: 'https://www.bleepingcomputer.com/feed/', name: 'BleepingComputer' }
];

export async function GET() {
  try {
    const feedPromises = FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return parsed.items.map(item => ({
        title: item.title || 'No Title',
        link: item.link || '',
        pubDate: item.pubDate || new Date().toISOString(),
        source: feed.name,
        // Remove HTML tags and truncate to 100 characters max
        summary: (item.contentSnippet || item.content || item.description || '')
                   .replace(/<[^>]*>?/gm, '')
                   .substring(0, 100).trim() + '...'
      }));
    });

    const results = await Promise.allSettled(feedPromises);
    
    let allItems: any[] = [];
    results.forEach(res => {
      if (res.status === 'fulfilled') {
        allItems = [...allItems, ...res.value];
      } else {
        console.error('Failed to fetch a feed:', res.reason);
      }
    });

    // Sort descending by date
    allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    // Return the latest 15 combined
    return NextResponse.json(allItems.slice(0, 15));
  } catch (error) {
    console.error('Error fetching RSS feeds:', error);
    return NextResponse.json({ error: 'Failed to fetch threat intel' }, { status: 500 });
  }
}
