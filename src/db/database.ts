import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 1;

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;
  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS podcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      description TEXT NOT NULL,
      feed_url TEXT NOT NULL UNIQUE,
      artwork_url TEXT NOT NULL,
      last_fetched_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      podcast_id INTEGER NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
      guid TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      audio_url TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      published_at INTEGER NOT NULL,
      artwork_url TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_episodes_podcast_id ON episodes(podcast_id);

    CREATE TABLE IF NOT EXISTS listening_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      position_start REAL NOT NULL,
      position_end REAL NOT NULL,
      listened_seconds REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_listening_events_episode_id ON listening_events(episode_id);
    CREATE INDEX IF NOT EXISTS idx_listening_events_started_at ON listening_events(started_at);

    CREATE TABLE IF NOT EXISTS playback_state (
      episode_id INTEGER PRIMARY KEY REFERENCES episodes(id) ON DELETE CASCADE,
      position REAL NOT NULL,
      updated_at INTEGER NOT NULL
    );

    PRAGMA user_version = ${DATABASE_VERSION};
  `);
}
