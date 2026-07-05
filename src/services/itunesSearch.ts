import type { ITunesSearchResult } from '@/types/podcast';

interface ITunesApiResult {
  collectionId: number;
  trackName: string;
  artistName: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  feedUrl?: string;
}

interface ITunesApiResponse {
  resultCount: number;
  results: ITunesApiResult[];
}

export async function searchPodcasts(term: string): Promise<ITunesSearchResult[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const url = `https://itunes.apple.com/search?media=podcast&entity=podcast&limit=25&term=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`iTunes search failed (${response.status})`);
  }
  const data: ITunesApiResponse = await response.json();

  return data.results
    .filter((result) => Boolean(result.feedUrl))
    .map((result) => ({
      collectionId: result.collectionId,
      trackName: result.trackName,
      artistName: result.artistName,
      artworkUrl: result.artworkUrl600 ?? result.artworkUrl100 ?? '',
      feedUrl: result.feedUrl!,
    }));
}
