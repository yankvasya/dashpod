import Parser from 'rss-parser';

import type { Episode, Podcast } from '@/types/podcast';

type CustomItem = {
  'itunes:duration'?: string;
  'itunes:image'?: { $: { href: string } } | string;
};

type CustomFeed = {
  itunes?: { image?: string; author?: string };
};

const parser = new Parser<CustomFeed, CustomItem>({
  customFields: {
    item: ['itunes:duration', 'itunes:image'],
  },
});

export interface ParsedFeed {
  podcast: Omit<Podcast, 'id' | 'lastFetchedAt'>;
  episodes: Omit<Episode, 'id' | 'podcastId'>[];
}

function parseDurationToSeconds(raw: string | undefined): number {
  if (!raw) return 0;
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  return trimmed
    .split(':')
    .map(Number)
    .reduce((total, part) => total * 60 + (Number.isFinite(part) ? part : 0), 0);
}

function extractItunesImage(value: CustomItem['itunes:image']): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.$?.href ?? null;
}

export async function fetchPodcastFeed(feedUrl: string): Promise<ParsedFeed> {
  const response = await fetch(feedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch feed (${response.status}): ${feedUrl}`);
  }
  const xml = await response.text();
  const feed = await parser.parseString(xml);

  const podcast: Omit<Podcast, 'id' | 'lastFetchedAt'> = {
    title: feed.title ?? 'Untitled Podcast',
    author: feed.itunes?.author ?? '',
    description: feed.description ?? '',
    feedUrl,
    artworkUrl: feed.image?.url ?? feed.itunes?.image ?? '',
  };

  const episodes: Omit<Episode, 'id' | 'podcastId'>[] = feed.items
    .filter((item) => Boolean(item.enclosure?.url && item.guid))
    .map((item) => ({
      guid: item.guid!,
      title: item.title ?? 'Untitled Episode',
      description: item.contentSnippet ?? item.summary ?? '',
      audioUrl: item.enclosure!.url,
      durationSeconds: parseDurationToSeconds(item['itunes:duration']),
      publishedAt: item.isoDate ? Math.floor(new Date(item.isoDate).getTime() / 1000) : 0,
      artworkUrl: extractItunesImage(item['itunes:image']),
    }));

  return { podcast, episodes };
}
