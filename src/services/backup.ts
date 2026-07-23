import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  addToQueue,
  getAllListeningEventsForBackup,
  getAllPlaybackStatesForBackup,
  getSubscriptions,
  getEpisodesForPodcast,
  recordListeningEvent,
  setPlaybackState,
  setSetting,
} from '@/db/queries';

const BACKUP_FILENAME = 'dashpod-backup.json';
const OPML_FILENAME = 'dashpod-subscriptions.opml';

export interface BackupData {
  exportedAt: number;
  appVersion: string;
  subscriptions?: { feedUrl: string }[];
  downloads?: { feedUrl: string; guid: string; episodeTitle: string; podcastTitle: string }[];
  queue?: { feedUrl: string; guid: string }[];
  history?: {
    playbackStates: { feedUrl: string; guid: string; position: number; isFinished: boolean; updatedAt: number }[];
    listeningEvents: {
      feedUrl: string;
      guid: string;
      startedAt: number;
      endedAt: number;
      positionStart: number;
      positionEnd: number;
      listenedSeconds: number;
    }[];
  };
  settings?: {
    themeId?: string;
    languageId?: string;
    allowMobileDataDownloads?: boolean;
    autoCheckForUpdates?: boolean;
  };
}

async function writeAndShareText(filename: string, content: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri);
  }
}

/** Returns null if the user cancelled the picker or the file couldn't be read as text. */
async function pickAndReadTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
  if (result.canceled || !result.assets?.[0]) return null;
  try {
    return await new File(result.assets[0].uri).text();
  } catch {
    return null;
  }
}

export async function exportBackupFile(data: BackupData): Promise<void> {
  await writeAndShareText(BACKUP_FILENAME, JSON.stringify(data, null, 2));
}

/** Returns null if cancelled or the file isn't valid JSON — callers should treat that as "nothing
 * to import" rather than a hard error, same as the rest of this app's fetch-and-degrade pattern. */
export async function pickBackupFile(): Promise<BackupData | null> {
  const text = await pickAndReadTextFile();
  if (!text) return null;
  try {
    return JSON.parse(text) as BackupData;
  } catch {
    return null;
  }
}

export function buildOpml(subscriptions: { title: string; feedUrl: string }[]): string {
  const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_', format: true });
  const doc = {
    opml: {
      '@_version': '2.0',
      head: { title: 'Dashpod subscriptions' },
      body: {
        outline: subscriptions.map((subscription) => ({
          '@_type': 'rss',
          '@_text': subscription.title,
          '@_title': subscription.title,
          '@_xmlUrl': subscription.feedUrl,
        })),
      },
    },
  };
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + builder.build(doc);
}

export function parseOpml(xml: string): { title: string; feedUrl: string }[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'outline',
  });
  const parsed = parser.parse(xml);
  const outlines: unknown = parsed?.opml?.body?.outline ?? [];
  const list = Array.isArray(outlines) ? outlines : [outlines];
  return list
    .map((outline) => {
      const node = outline as Record<string, string | undefined>;
      return { title: node['@_title'] ?? node['@_text'] ?? '', feedUrl: node['@_xmlUrl'] ?? '' };
    })
    .filter((item): item is { title: string; feedUrl: string } => !!item.feedUrl);
}

export async function exportOpmlFile(subscriptions: { title: string; feedUrl: string }[]): Promise<void> {
  await writeAndShareText(OPML_FILENAME, buildOpml(subscriptions));
}

/** Returns null if cancelled or the file couldn't be parsed as OPML/XML. */
export async function pickOpmlFile(): Promise<{ title: string; feedUrl: string }[] | null> {
  const text = await pickAndReadTextFile();
  if (!text) return null;
  try {
    const feeds = parseOpml(text);
    return feeds.length > 0 ? feeds : null;
  } catch {
    return null;
  }
}

export interface ApplyBackupResult {
  subscribedFeeds: number;
  failedFeedUrls: string[];
  queueItemsRestored: number;
  playbackStatesRestored: number;
  listeningEventsRestored: number;
  settingsRestored: boolean;
}

/** Restores a BackupData export. `subscribe` is injected rather than imported directly — it needs
 * to be useSubscriptions()'s own subscribe (network fetch + insert + local state refresh), which
 * only exists bound to a live SubscriptionsProvider, not as a plain db-only query function.
 *
 * Downloaded episodes are deliberately NOT re-inserted into the downloads table: only the audio
 * file's *metadata* is exported (see BackupData.downloads), never the file itself, so recreating
 * a `downloads` row would point at a local file that no longer exists on this install. The
 * referenced podcast/episodes are still subscribed-to (via the feedUrl collection below) so the
 * episodes are at least visible again for the user to re-download by hand. */
export async function applyBackup(
  db: SQLiteDatabase,
  data: BackupData,
  subscribe: (feedUrl: string) => Promise<number>
): Promise<ApplyBackupResult> {
  const feedUrls = new Set<string>();
  data.subscriptions?.forEach((item) => feedUrls.add(item.feedUrl));
  data.downloads?.forEach((item) => feedUrls.add(item.feedUrl));
  data.queue?.forEach((item) => feedUrls.add(item.feedUrl));
  data.history?.playbackStates.forEach((item) => feedUrls.add(item.feedUrl));
  data.history?.listeningEvents.forEach((item) => feedUrls.add(item.feedUrl));

  const existing = await getSubscriptions(db);
  const existingFeedUrls = new Set(existing.map((podcast) => podcast.feedUrl));
  const failedFeedUrls: string[] = [];
  let subscribedFeeds = 0;

  for (const feedUrl of feedUrls) {
    if (existingFeedUrls.has(feedUrl)) continue;
    try {
      await subscribe(feedUrl);
      subscribedFeeds += 1;
    } catch {
      failedFeedUrls.push(feedUrl);
    }
  }

  const podcasts = await getSubscriptions(db);
  const podcastIdByFeedUrl = new Map(podcasts.map((podcast) => [podcast.feedUrl, podcast.id]));
  const episodeIdByKey = new Map<string, number>();
  for (const podcast of podcasts) {
    if (!feedUrls.has(podcast.feedUrl)) continue;
    const episodes = await getEpisodesForPodcast(db, podcast.id);
    for (const episode of episodes) {
      episodeIdByKey.set(`${podcast.feedUrl}::${episode.guid}`, episode.id);
    }
  }
  function resolveEpisodeId(feedUrl: string, guid: string): number | undefined {
    return episodeIdByKey.get(`${feedUrl}::${guid}`);
  }

  let queueItemsRestored = 0;
  for (const item of data.queue ?? []) {
    const episodeId = resolveEpisodeId(item.feedUrl, item.guid);
    if (episodeId == null) continue;
    await addToQueue(db, episodeId);
    queueItemsRestored += 1;
  }

  let playbackStatesRestored = 0;
  for (const item of data.history?.playbackStates ?? []) {
    const episodeId = resolveEpisodeId(item.feedUrl, item.guid);
    if (episodeId == null) continue;
    await setPlaybackState(db, {
      episodeId,
      position: item.position,
      isFinished: item.isFinished,
      updatedAt: item.updatedAt,
    });
    playbackStatesRestored += 1;
  }

  let listeningEventsRestored = 0;
  for (const item of data.history?.listeningEvents ?? []) {
    const episodeId = resolveEpisodeId(item.feedUrl, item.guid);
    if (episodeId == null) continue;
    await recordListeningEvent(db, {
      episodeId,
      startedAt: item.startedAt,
      endedAt: item.endedAt,
      positionStart: item.positionStart,
      positionEnd: item.positionEnd,
      listenedSeconds: item.listenedSeconds,
    });
    listeningEventsRestored += 1;
  }

  let settingsRestored = false;
  if (data.settings) {
    if (data.settings.themeId != null) await setSetting(db, 'themeId', data.settings.themeId);
    if (data.settings.languageId != null) await setSetting(db, 'languageId', data.settings.languageId);
    if (data.settings.allowMobileDataDownloads != null) {
      await setSetting(db, 'allowMobileDataDownloads', data.settings.allowMobileDataDownloads ? '1' : '0');
    }
    if (data.settings.autoCheckForUpdates != null) {
      await setSetting(db, 'autoCheckForUpdates', data.settings.autoCheckForUpdates ? '1' : '0');
    }
    settingsRestored = true;
  }

  return {
    subscribedFeeds,
    failedFeedUrls,
    queueItemsRestored,
    playbackStatesRestored,
    listeningEventsRestored,
    settingsRestored,
  };
}

export async function gatherBackupData(
  db: SQLiteDatabase,
  options: {
    subscriptions: boolean;
    downloads: boolean;
    queue: boolean;
    history: boolean;
    settings: boolean;
  },
  loaded: {
    subscriptions: { feedUrl: string }[];
    downloads: { feedUrl: string; guid: string; episodeTitle: string; podcastTitle: string }[];
    queue: { feedUrl: string; guid: string }[];
    settings: {
      themeId: string;
      languageId: string;
      allowMobileDataDownloads: boolean;
      autoCheckForUpdates: boolean;
    };
  },
  appVersion: string
): Promise<BackupData> {
  const data: BackupData = { exportedAt: Math.floor(Date.now() / 1000), appVersion };
  if (options.subscriptions) data.subscriptions = loaded.subscriptions;
  if (options.downloads) data.downloads = loaded.downloads;
  if (options.queue) data.queue = loaded.queue;
  if (options.history) {
    data.history = {
      playbackStates: await getAllPlaybackStatesForBackup(db),
      listeningEvents: await getAllListeningEventsForBackup(db),
    };
  }
  if (options.settings) data.settings = loaded.settings;
  return data;
}
