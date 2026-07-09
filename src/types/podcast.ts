/** Core podcast subscription data. */
export interface Podcast {
  id: number;
  title: string;
  author: string;
  description: string;
  feedUrl: string;
  artworkUrl: string;
  lastFetchedAt: number;
}

/** A single episode belonging to a podcast. */
export interface Episode {
  id: number;
  podcastId: number;
  guid: string;
  title: string;
  description: string;
  audioUrl: string;
  durationSeconds: number;
  publishedAt: number;
  artworkUrl: string | null;
}

/** A recorded listening session for an episode. */
export interface ListeningEvent {
  id: number;
  episodeId: number;
  startedAt: number;
  endedAt: number;
  positionStart: number;
  positionEnd: number;
  listenedSeconds: number;
}

/** Current playback position for an episode. */
export interface PlaybackState {
  episodeId: number;
  position: number;
  isFinished: boolean;
  updatedAt: number;
}

/** A locally downloaded audio file for an episode. */
export interface Download {
  episodeId: number;
  localUri: string;
  fileSizeBytes: number;
  downloadedAt: number;
}

/** A downloaded episode joined with its podcast/episode/playback info, for the Downloads list. */
export interface DownloadedEpisode {
  episodeId: number;
  podcastId: number;
  guid: string;
  podcastTitle: string;
  episodeTitle: string;
  description: string;
  artworkUrl: string;
  audioUrl: string;
  localUri: string;
  fileSizeBytes: number;
  downloadedAt: number;
  durationSeconds: number;
  publishedAt: number;
  position: number;
  isFinished: boolean;
}

/** Aggregated listening statistics for a single day. */
export interface DayStats {
  /** Date formatted as YYYY-MM-DD */
  date: string;
  totalMinutes: number;
  episodes: EpisodeListeningSummary[];
}

/** Per-episode listening summary used within DayStats. */
export interface EpisodeListeningSummary {
  episodeId: number;
  episodeTitle: string;
  podcastTitle: string;
  artworkUrl: string;
  totalMinutes: number;
}

/** A single result row from the iTunes Search API. */
export interface ITunesSearchResult {
  collectionId: number;
  trackName: string;
  artistName: string;
  artworkUrl: string;
  feedUrl: string;
}
