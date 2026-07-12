import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  DayStats,
  Download,
  DownloadedEpisode,
  Episode,
  ListeningEvent,
  PlaybackState,
  Podcast,
  PodcastListeningStats,
  QueuedEpisode,
} from '@/types/podcast';
import type { DateRange } from '@/utils/periods';

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

type PlaybackStateRow = {
  episode_id: number;
  position: number;
  is_finished: number;
  updated_at: number;
};

function toPlaybackState(row: PlaybackStateRow): PlaybackState {
  return {
    episodeId: row.episode_id,
    position: row.position,
    isFinished: row.is_finished === 1,
    updatedAt: row.updated_at,
  };
}

export async function getPlaybackState(
  db: SQLiteDatabase,
  episodeId: number
): Promise<PlaybackState | null> {
  const row = await db.getFirstAsync<PlaybackStateRow>(
    'SELECT * FROM playback_state WHERE episode_id = ?',
    [episodeId]
  );
  return row ? toPlaybackState(row) : null;
}

/** All playback states for a podcast's episodes, keyed by episode id — used to show resume progress and gray out finished episodes in a list without one query per row. */
export async function getPlaybackStatesForPodcast(
  db: SQLiteDatabase,
  podcastId: number
): Promise<Map<number, PlaybackState>> {
  const rows = await db.getAllAsync<PlaybackStateRow>(
    `SELECT ps.* FROM playback_state ps
     JOIN episodes e ON e.id = ps.episode_id
     WHERE e.podcast_id = ?`,
    [podcastId]
  );
  return new Map(rows.map((row) => [row.episode_id, toPlaybackState(row)]));
}

export async function setPlaybackState(db: SQLiteDatabase, state: PlaybackState): Promise<void> {
  await db.runAsync(
    `INSERT INTO playback_state (episode_id, position, is_finished, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(episode_id) DO UPDATE SET
       position = excluded.position,
       is_finished = excluded.is_finished,
       updated_at = excluded.updated_at`,
    [state.episodeId, state.position, state.isFinished ? 1 : 0, state.updatedAt]
  );
}

type DayStatsRow = {
  date: string;
  episode_id: number;
  episode_title: string;
  podcast_title: string;
  artwork_url: string;
  total_seconds: number;
  duration_seconds: number;
};

/** Groups raw per-episode-per-day rows into DayStats. Rewinding/replaying part of an episode
 * records multiple overlapping listening_events segments, so a naive SUM can exceed the
 * episode's real length — clamp each episode's per-day total at its own duration. */
function mapDayStatsRows(rows: DayStatsRow[]): DayStats[] {
  const dayMap = new Map<string, DayStats>();
  for (const row of rows) {
    let day = dayMap.get(row.date);
    if (!day) {
      day = { date: row.date, totalMinutes: 0, episodes: [] };
      dayMap.set(row.date, day);
    }
    const seconds = row.duration_seconds > 0 ? Math.min(row.total_seconds, row.duration_seconds) : row.total_seconds;
    const minutes = seconds / 60;
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

/** Full listening history, most recent day first. Pass a range to scope to a period; omit for
 * all-time. */
export async function getListeningHistory(db: SQLiteDatabase, range?: DateRange): Promise<DayStats[]> {
  const rows = await db.getAllAsync<DayStatsRow>(
    `SELECT
       date(le.started_at, 'unixepoch', 'localtime') AS date,
       e.id AS episode_id,
       e.title AS episode_title,
       p.title AS podcast_title,
       COALESCE(e.artwork_url, p.artwork_url) AS artwork_url,
       SUM(le.listened_seconds) AS total_seconds,
       e.duration_seconds AS duration_seconds
     FROM listening_events le
     JOIN episodes e ON e.id = le.episode_id
     JOIN podcasts p ON p.id = e.podcast_id
     ${range ? 'WHERE le.started_at >= ? AND le.started_at < ?' : ''}
     GROUP BY date, e.id
     ORDER BY date DESC`,
    range ? [range.startUnixSeconds, range.endUnixSeconds] : []
  );

  return mapDayStatsRows(rows);
}

/** Per-podcast listening summary for a period, most-listened first. Pass a range to scope
 * totalMinutes/episodeCount to that period; omit for all-time. finishedEpisodes/totalEpisodes are
 * always all-time — completion is a lifetime concept, not something that resets per period. Same
 * clamp-at-duration logic as mapDayStatsRows (per episode, not per day) to avoid overcounting from
 * rewind/replay. */
export async function getPodcastListeningStats(
  db: SQLiteDatabase,
  range?: DateRange
): Promise<PodcastListeningStats[]> {
  const episodeRows = await db.getAllAsync<{
    podcast_id: number;
    podcast_title: string;
    artwork_url: string;
    episode_id: number;
    episode_title: string;
    duration_seconds: number;
    total_seconds: number;
  }>(
    `SELECT
       p.id AS podcast_id,
       p.title AS podcast_title,
       p.artwork_url AS artwork_url,
       e.id AS episode_id,
       e.title AS episode_title,
       e.duration_seconds AS duration_seconds,
       SUM(le.listened_seconds) AS total_seconds
     FROM listening_events le
     JOIN episodes e ON e.id = le.episode_id
     JOIN podcasts p ON p.id = e.podcast_id
     ${range ? 'WHERE le.started_at >= ? AND le.started_at < ?' : ''}
     GROUP BY e.id`,
    range ? [range.startUnixSeconds, range.endUnixSeconds] : []
  );

  const finishedCountRows = await db.getAllAsync<{ podcast_id: number; finished_count: number }>(
    `SELECT e.podcast_id, COUNT(*) AS finished_count
     FROM playback_state ps
     JOIN episodes e ON e.id = ps.episode_id
     WHERE ps.is_finished = 1
     GROUP BY e.podcast_id`
  );
  const finishedByPodcast = new Map(finishedCountRows.map((row) => [row.podcast_id, row.finished_count]));

  const episodeCountRows = await db.getAllAsync<{ podcast_id: number; total_episodes: number }>(
    'SELECT podcast_id, COUNT(*) AS total_episodes FROM episodes GROUP BY podcast_id'
  );
  const totalEpisodesByPodcast = new Map(
    episodeCountRows.map((row) => [row.podcast_id, row.total_episodes])
  );

  const statsMap = new Map<number, PodcastListeningStats>();
  for (const row of episodeRows) {
    let stats = statsMap.get(row.podcast_id);
    if (!stats) {
      stats = {
        podcastId: row.podcast_id,
        podcastTitle: row.podcast_title,
        artworkUrl: row.artwork_url,
        totalMinutes: 0,
        episodeCount: 0,
        finishedEpisodes: finishedByPodcast.get(row.podcast_id) ?? 0,
        totalEpisodes: totalEpisodesByPodcast.get(row.podcast_id) ?? 0,
        episodes: [],
      };
      statsMap.set(row.podcast_id, stats);
    }
    const seconds =
      row.duration_seconds > 0 ? Math.min(row.total_seconds, row.duration_seconds) : row.total_seconds;
    const minutes = seconds / 60;
    stats.totalMinutes += minutes;
    stats.episodeCount += 1;
    stats.episodes.push({
      episodeId: row.episode_id,
      episodeTitle: row.episode_title,
      podcastTitle: row.podcast_title,
      artworkUrl: row.artwork_url,
      totalMinutes: minutes,
    });
  }

  return Array.from(statsMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
}

type DownloadRow = {
  episode_id: number;
  local_uri: string;
  file_size_bytes: number;
  downloaded_at: number;
};

function toDownload(row: DownloadRow): Download {
  return {
    episodeId: row.episode_id,
    localUri: row.local_uri,
    fileSizeBytes: row.file_size_bytes,
    downloadedAt: row.downloaded_at,
  };
}

export async function getDownloadForEpisode(
  db: SQLiteDatabase,
  episodeId: number
): Promise<Download | null> {
  const row = await db.getFirstAsync<DownloadRow>('SELECT * FROM downloads WHERE episode_id = ?', [
    episodeId,
  ]);
  return row ? toDownload(row) : null;
}

export async function insertDownload(
  db: SQLiteDatabase,
  download: Omit<Download, 'downloadedAt'> & { downloadedAt?: number }
): Promise<void> {
  await db.runAsync(
    `INSERT INTO downloads (episode_id, local_uri, file_size_bytes, downloaded_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(episode_id) DO UPDATE SET
       local_uri = excluded.local_uri,
       file_size_bytes = excluded.file_size_bytes,
       downloaded_at = excluded.downloaded_at`,
    [
      download.episodeId,
      download.localUri,
      download.fileSizeBytes,
      download.downloadedAt ?? Math.floor(Date.now() / 1000),
    ]
  );
}

export async function deleteDownload(db: SQLiteDatabase, episodeId: number): Promise<void> {
  await db.runAsync('DELETE FROM downloads WHERE episode_id = ?', [episodeId]);
}

export async function getDownloads(db: SQLiteDatabase): Promise<DownloadedEpisode[]> {
  const rows = await db.getAllAsync<{
    episode_id: number;
    podcast_id: number;
    guid: string;
    podcast_title: string;
    episode_title: string;
    description: string;
    artwork_url: string;
    audio_url: string;
    local_uri: string;
    file_size_bytes: number;
    downloaded_at: number;
    duration_seconds: number;
    published_at: number;
    position: number;
    is_finished: number;
  }>(
    `SELECT
       d.episode_id, e.podcast_id, e.guid, p.title AS podcast_title, e.title AS episode_title,
       e.description, COALESCE(e.artwork_url, p.artwork_url) AS artwork_url, e.audio_url, d.local_uri,
       d.file_size_bytes, d.downloaded_at, e.duration_seconds, e.published_at,
       COALESCE(ps.position, 0) AS position, COALESCE(ps.is_finished, 0) AS is_finished
     FROM downloads d
     JOIN episodes e ON e.id = d.episode_id
     JOIN podcasts p ON p.id = e.podcast_id
     LEFT JOIN playback_state ps ON ps.episode_id = d.episode_id
     ORDER BY d.downloaded_at DESC`
  );

  return rows.map((row) => ({
    episodeId: row.episode_id,
    podcastId: row.podcast_id,
    guid: row.guid,
    podcastTitle: row.podcast_title,
    episodeTitle: row.episode_title,
    description: row.description,
    artworkUrl: row.artwork_url,
    audioUrl: row.audio_url,
    localUri: row.local_uri,
    fileSizeBytes: row.file_size_bytes,
    downloadedAt: row.downloaded_at,
    durationSeconds: row.duration_seconds,
    publishedAt: row.published_at,
    position: row.position,
    isFinished: row.is_finished === 1,
  }));
}

/** Deletes downloads for fully-listened episodes and returns the deleted rows (so the caller can also remove the local files). */
export async function deleteAllListenedDownloads(db: SQLiteDatabase): Promise<Download[]> {
  const rows = await db.getAllAsync<DownloadRow>(
    `SELECT d.* FROM downloads d
     JOIN playback_state ps ON ps.episode_id = d.episode_id
     WHERE ps.is_finished = 1`
  );
  await db.runAsync(
    `DELETE FROM downloads WHERE episode_id IN (
       SELECT d.episode_id FROM downloads d
       JOIN playback_state ps ON ps.episode_id = d.episode_id
       WHERE ps.is_finished = 1
     )`
  );
  return rows.map(toDownload);
}

/** Deletes all downloads and returns the deleted rows (so the caller can also remove the local files). */
export async function deleteAllDownloads(db: SQLiteDatabase): Promise<Download[]> {
  const rows = await db.getAllAsync<DownloadRow>('SELECT * FROM downloads');
  await db.runAsync('DELETE FROM downloads');
  return rows.map(toDownload);
}

export async function getQueue(db: SQLiteDatabase): Promise<QueuedEpisode[]> {
  const rows = await db.getAllAsync<{
    queue_item_id: number;
    episode_id: number;
    podcast_id: number;
    guid: string;
    podcast_title: string;
    episode_title: string;
    description: string;
    artwork_url: string;
    audio_url: string;
    duration_seconds: number;
    published_at: number;
    position: number;
    added_at: number;
    playback_position: number;
    is_finished: number;
  }>(
    `SELECT
       qi.id AS queue_item_id, qi.episode_id, e.podcast_id, e.guid, p.title AS podcast_title,
       e.title AS episode_title, e.description, COALESCE(e.artwork_url, p.artwork_url) AS artwork_url,
       e.audio_url, e.duration_seconds, e.published_at, qi.position, qi.added_at,
       COALESCE(ps.position, 0) AS playback_position, COALESCE(ps.is_finished, 0) AS is_finished
     FROM queue_items qi
     JOIN episodes e ON e.id = qi.episode_id
     JOIN podcasts p ON p.id = e.podcast_id
     LEFT JOIN playback_state ps ON ps.episode_id = qi.episode_id
     ORDER BY qi.position ASC`
  );

  return rows.map((row) => ({
    queueItemId: row.queue_item_id,
    episodeId: row.episode_id,
    podcastId: row.podcast_id,
    guid: row.guid,
    podcastTitle: row.podcast_title,
    episodeTitle: row.episode_title,
    description: row.description,
    artworkUrl: row.artwork_url,
    audioUrl: row.audio_url,
    durationSeconds: row.duration_seconds,
    publishedAt: row.published_at,
    position: row.position,
    addedAt: row.added_at,
    playbackPosition: row.playback_position,
    isFinished: row.is_finished === 1,
  }));
}

export async function addToQueue(db: SQLiteDatabase, episodeId: number): Promise<void> {
  const row = await db.getFirstAsync<{ maxPosition: number | null }>(
    'SELECT MAX(position) AS maxPosition FROM queue_items'
  );
  const nextPosition = (row?.maxPosition ?? -1) + 1;
  await db.runAsync(
    `INSERT INTO queue_items (episode_id, position, added_at)
     VALUES (?, ?, ?)
     ON CONFLICT(episode_id) DO NOTHING`,
    [episodeId, nextPosition, Math.floor(Date.now() / 1000)]
  );
}

export async function removeFromQueue(db: SQLiteDatabase, episodeId: number): Promise<void> {
  await db.runAsync('DELETE FROM queue_items WHERE episode_id = ?', [episodeId]);
}

/** Rewrites every item's position to match its index in the given order.
 * Not wrapped in withTransactionAsync: a fast second drag can fire before the first reorder's
 * transaction commits, and expo-sqlite doesn't allow overlapping transactions on one connection
 * ("cannot start a transaction within a transaction") — plain sequential runAsync calls queue
 * safely instead. */
export async function reorderQueue(db: SQLiteDatabase, episodeIdsInOrder: number[]): Promise<void> {
  for (let index = 0; index < episodeIdsInOrder.length; index++) {
    await db.runAsync('UPDATE queue_items SET position = ? WHERE episode_id = ?', [
      index,
      episodeIdsInOrder[index],
    ]);
  }
}
