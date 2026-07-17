import { XMLParser } from 'fast-xml-parser';

import type { Episode, Podcast } from '@/types/podcast';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'item',
});

export interface ParsedFeed {
  podcast: Omit<Podcast, 'id' | 'lastFetchedAt'>;
  episodes: Omit<Episode, 'id' | 'podcastId'>[];
}

type XmlNode = string | number | { '#text'?: string | number; '@_href'?: string } | undefined | null;

function textValue(value: XmlNode): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return value['#text'] != null ? String(value['#text']) : '';
  return String(value);
}

function hrefValue(value: XmlNode): string | null {
  if (value && typeof value === 'object' && '@_href' in value) {
    return (value['@_href'] as string) ?? null;
  }
  return null;
}

function parseDurationToSeconds(raw: XmlNode): number {
  const text = textValue(raw).trim();
  if (!text) return 0;
  if (/^\d+$/.test(text)) return parseInt(text, 10);
  return text
    .split(':')
    .map(Number)
    .reduce((total, part) => total * 60 + (Number.isFinite(part) ? part : 0), 0);
}

function parsePublishedAt(pubDate: string | undefined): number {
  if (!pubDate) return 0;
  const parsed = Date.parse(pubDate);
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
}

/** The enclosure's declared `length` (bytes) — many feeds omit it or report 0, so treat those as unknown rather than a real size. */
function parseFileSize(length: string | number | undefined): number | null {
  if (length == null) return null;
  const bytes = typeof length === 'number' ? length : parseInt(length, 10);
  return Number.isFinite(bytes) && bytes > 0 ? bytes : null;
}

export async function fetchPodcastFeed(feedUrl: string): Promise<ParsedFeed> {
  const response = await fetch(feedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch feed (${response.status}): ${feedUrl}`);
  }
  const xml = await response.text();
  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel ?? {};

  const podcast: Omit<Podcast, 'id' | 'lastFetchedAt'> = {
    title: textValue(channel.title) || 'Untitled Podcast',
    author: textValue(channel['itunes:author']),
    description: textValue(channel.description),
    feedUrl,
    artworkUrl: textValue(channel.image?.url) || hrefValue(channel['itunes:image']) || '',
  };

  const items: Record<string, unknown>[] = Array.isArray(channel.item)
    ? channel.item
    : channel.item
      ? [channel.item]
      : [];

  const episodes: Omit<Episode, 'id' | 'podcastId'>[] = items
    .map((item) => {
      const enclosure = item.enclosure as { '@_url'?: string; '@_length'?: string } | undefined;
      const audioUrl = enclosure?.['@_url'];
      const guid = textValue(item.guid as XmlNode) || (item.link as string) || audioUrl;
      return { item, audioUrl, guid, fileSizeBytes: parseFileSize(enclosure?.['@_length']) };
    })
    .filter(
      (entry): entry is { item: Record<string, unknown>; audioUrl: string; guid: string; fileSizeBytes: number | null } =>
        Boolean(entry.audioUrl && entry.guid)
    )
    .map(({ item, audioUrl, guid, fileSizeBytes }) => ({
      guid,
      title: textValue(item.title as XmlNode) || 'Untitled Episode',
      description: textValue(item.description as XmlNode) || textValue(item['itunes:summary'] as XmlNode),
      audioUrl,
      durationSeconds: parseDurationToSeconds(item['itunes:duration'] as XmlNode),
      publishedAt: parsePublishedAt(item.pubDate as string | undefined),
      artworkUrl: hrefValue(item['itunes:image'] as XmlNode),
      fileSizeBytes,
    }));

  return { podcast, episodes };
}
