import type { SQLiteDatabase } from 'expo-sqlite';

import type { DayStats, Episode, ListeningEvent, PlaybackState, Podcast } from '@/types/podcast';

type PodcastRow = {
  id: number;
  title: string;
  author: string;
  description: string;
  feed_url: string;
  artwork_url: string;
  last_fetched_at: number;
};

type EpisodeRow = {
  id: number;
  podcast_id: number;
  guid: string;
  title: string;
  description: string;
  audio_url: string;
  duration_seconds: number;
  published_at: number;
  artwork_url: string | null;
};

function toPodcast(row: PodcastRow): Podcast {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description,
    feedUrl: row.feed_url,
    artworkUrl: row.artwork_url,
    lastFetchedAt: row.last_fetched_at,
  };
}

function toEpisode(row: EpisodeRow): Episode {
  return {
    id: row.id,
    podcastId: row.podcast_id,
    guid: row.guid,
    title: row.title,
    description: row.description,
    audioUrl: row.audio_url,
    durationSeconds: row.duration_seconds,
    publishedAt: row.published_at,
    artworkUrl: row.artwork_url,
  };
}

export async function getSubscriptions(db: SQLiteDatabase): Promise<Podcast[]> {
  const rows = await db.getAllAsync<PodcastRow>('SELECT * FROM podcasts ORDER BY title ASC');
  return rows.map(toPodcast);
}

export async function subscribeToPodcast(
  db: SQLiteDatabase,
  podcast: Omit<Podcast, 'id'>
): Promise<number> {
  await db.runAsync(
    `INSERT INTO podcasts (title, author, description, feed_url, artwork_url, last_fetched_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(feed_url) DO UPDATE SET
       title = excluded.title,
       author = excluded.author,
       description = excluded.description,
       artwork_url = excluded.artwork_url,
       last_fetched_at = excluded.last_fetched_at`,
    [
      podcast.title,
      podcast.author,
      podcast.description,
      podcast.feedUrl,
      podcast.artworkUrl,
      podcast.lastFetchedAt,
    ]
  );
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM podcasts WHERE feed_url = ?',
    [podcast.feedUrl]
  );
  return row!.id;
}

export async function unsubscribePodcast(db: SQLiteDatabase, podcastId: number): Promise<void> {
  await db.runAsync('DELETE FROM podcasts WHERE id = ?', [podcastId]);
}

export async function upsertEpisodes(
  db: SQLiteDatabase,
  podcastId: number,
  episodes: Omit<Episode, 'id' | 'podcastId'>[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const episode of episodes) {
      await db.runAsync(
        `INSERT INTO episodes (podcast_id, guid, title, description, audio_url, duration_seconds, published_at, artwork_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(guid) DO UPDATE SET
           title = excluded.title,
           description = excluded.description,
           audio_url = excluded.audio_url,
           duration_seconds = excluded.duration_seconds,
           published_at = excluded.published_at,
           artwork_url = excluded.artwork_url`,
        [
          podcastId,
          episode.guid,
          episode.title,
          episode.description,
          episode.audioUrl,
          episode.durationSeconds,
          episode.publishedAt,
          episode.artworkUrl,
        ]
      );
    }
  });
}

export async function getEpisodesForPodcast(
  db: SQLiteDatabase,
  podcastId: number
): Promise<Episode[]> {
  const rows = await db.getAllAsync<EpisodeRow>(
    'SELECT * FROM episodes WHERE podcast_id = ? ORDER BY published_at DESC',
    [podcastId]
  );
  return rows.map(toEpisode);
}

export async function getLatestEpisodes(db: SQLiteDatabase, limit = 50): Promise<Episode[]> {
  const rows = await db.getAllAsync<EpisodeRow>(
    'SELECT * FROM episodes ORDER BY published_at DESC LIMIT ?',
    [limit]
  );
  return rows.map(toEpisode);
}

export async function recordListeningEvent(
  db: SQLiteDatabase,
  event: Omit<ListeningEvent, 'id'>
): Promise<void> {
  await db.runAsync(
    `INSERT INTO listening_events (episode_id, started_at, ended_at, position_start, position_end, listened_seconds)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      event.episodeId,
      event.startedAt,
      event.endedAt,
      event.positionStart,
      event.positionEnd,
      event.listenedSeconds,
    ]
  );
}

export async function getPlaybackState(
  db: SQLiteDatabase,
  episodeId: number
): Promise<PlaybackState | null> {
  const row = await db.getFirstAsync<{ episode_id: number; position: number; updated_at: number }>(
    'SELECT * FROM playback_state WHERE episode_id = ?',
    [episodeId]
  );
  if (!row) return null;
  return { episodeId: row.episode_id, position: row.position, updatedAt: row.updated_at };
}

export async function setPlaybackState(db: SQLiteDatabase, state: PlaybackState): Promise<void> {
  await db.runAsync(
    `INSERT INTO playback_state (episode_id, position, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(episode_id) DO UPDATE SET
       position = excluded.position,
       updated_at = excluded.updated_at`,
    [state.episodeId, state.position, state.updatedAt]
  );
}

export async function getWeeklyStats(
  db: SQLiteDatabase,
  weekStartUnixSeconds: number
): Promise<DayStats[]> {
  const weekEndUnixSeconds = weekStartUnixSeconds + 7 * 24 * 60 * 60;
  const rows = await db.getAllAsync<{
    date: string;
    episode_id: number;
    episode_title: string;
    podcast_title: string;
    artwork_url: string;
    total_seconds: number;
  }>(
    `SELECT
       date(le.started_at, 'unixepoch', 'localtime') AS date,
       e.id AS episode_id,
       e.title AS episode_title,
       p.title AS podcast_title,
       COALESCE(e.artwork_url, p.artwork_url) AS artwork_url,
       SUM(le.listened_seconds) AS total_seconds
     FROM listening_events le
     JOIN episodes e ON e.id = le.episode_id
     JOIN podcasts p ON p.id = e.podcast_id
     WHERE le.started_at >= ? AND le.started_at < ?
     GROUP BY date, e.id
     ORDER BY date ASC`,
    [weekStartUnixSeconds, weekEndUnixSeconds]
  );

  const dayMap = new Map<string, DayStats>();
  for (const row of rows) {
    let day = dayMap.get(row.date);
    if (!day) {
      day = { date: row.date, totalMinutes: 0, episodes: [] };
      dayMap.set(row.date, day);
    }
    const minutes = row.total_seconds / 60;
    day.totalMinutes += minutes;
    day.episodes.push({
      episodeId: row.episode_id,
      episodeTitle: row.episode_title,
      podcastTitle: row.podcast_title,
      artworkUrl: row.artwork_url,
      totalMinutes: minutes,
    });
  }
  return Array.from(dayMap.values());
}
