import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  deleteAllDownloads,
  deleteAllListenedDownloads,
  deleteDownload,
  getDownloads,
  insertDownload,
} from '@/db/queries';
import { deleteDownloadedFile, downloadEpisodeFile } from '@/services/downloads';
import type { DownloadedEpisode, Episode } from '@/types/podcast';

/** Live progress for a download in flight, keyed by episode id. */
export interface DownloadProgress {
  episodeTitle: string;
  podcastTitle: string;
  bytesWritten: number;
  totalBytes: number;
}

interface DownloadsContextValue {
  downloads: DownloadedEpisode[];
  loading: boolean;
  downloadingEpisodeIds: Set<number>;
  downloadProgress: Map<number, DownloadProgress>;
  isDownloaded: (episodeId: number) => boolean;
  getDownloadedUri: (episodeId: number) => string | null;
  downloadEpisode: (episode: Episode, podcastTitle: string) => Promise<void>;
  removeDownload: (episodeId: number) => Promise<void>;
  deleteAllListened: () => Promise<void>;
  deleteAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

const DownloadsContext = createContext<DownloadsContextValue | null>(null);

/** Wraps the app so every screen (episode rows, Downloads tab) shares one downloads list. */
export function DownloadsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [downloads, setDownloads] = useState<DownloadedEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingEpisodeIds, setDownloadingEpisodeIds] = useState<Set<number>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Map<number, DownloadProgress>>(new Map());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDownloads(await getDownloads(db));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isDownloaded = useCallback(
    (episodeId: number) => downloads.some((download) => download.episodeId === episodeId),
    [downloads]
  );

  const getDownloadedUri = useCallback(
    (episodeId: number) =>
      downloads.find((download) => download.episodeId === episodeId)?.localUri ?? null,
    [downloads]
  );

  const downloadEpisode = useCallback(
    async (episode: Episode, podcastTitle: string) => {
      setDownloadingEpisodeIds((prev) => new Set(prev).add(episode.id));
      setDownloadProgress((prev) => {
        const next = new Map(prev);
        next.set(episode.id, { episodeTitle: episode.title, podcastTitle, bytesWritten: 0, totalBytes: 0 });
        return next;
      });
      try {
        const { localUri, fileSizeBytes } = await downloadEpisodeFile(
          episode.id,
          episode.audioUrl,
          (bytesWritten, totalBytes) => {
            setDownloadProgress((prev) => {
              const next = new Map(prev);
              next.set(episode.id, { episodeTitle: episode.title, podcastTitle, bytesWritten, totalBytes });
              return next;
            });
          }
        );
        await insertDownload(db, { episodeId: episode.id, localUri, fileSizeBytes });
        await refresh();
      } finally {
        setDownloadingEpisodeIds((prev) => {
          const next = new Set(prev);
          next.delete(episode.id);
          return next;
        });
        setDownloadProgress((prev) => {
          const next = new Map(prev);
          next.delete(episode.id);
          return next;
        });
      }
    },
    [db, refresh]
  );

  const removeDownload = useCallback(
    async (episodeId: number) => {
      const download = downloads.find((item) => item.episodeId === episodeId);
      await deleteDownload(db, episodeId);
      if (download) deleteDownloadedFile(download.localUri);
      await refresh();
    },
    [db, downloads, refresh]
  );

  const deleteAllListened = useCallback(async () => {
    const deleted = await deleteAllListenedDownloads(db);
    deleted.forEach((download) => deleteDownloadedFile(download.localUri));
    await refresh();
  }, [db, refresh]);

  const deleteAll = useCallback(async () => {
    const deleted = await deleteAllDownloads(db);
    deleted.forEach((download) => deleteDownloadedFile(download.localUri));
    await refresh();
  }, [db, refresh]);

  const value = useMemo(
    () => ({
      downloads,
      loading,
      downloadingEpisodeIds,
      downloadProgress,
      isDownloaded,
      getDownloadedUri,
      downloadEpisode,
      removeDownload,
      deleteAllListened,
      deleteAll,
      refresh,
    }),
    [
      downloads,
      loading,
      downloadingEpisodeIds,
      downloadProgress,
      isDownloaded,
      getDownloadedUri,
      downloadEpisode,
      removeDownload,
      deleteAllListened,
      deleteAll,
      refresh,
    ]
  );

  return <DownloadsContext.Provider value={value}>{children}</DownloadsContext.Provider>;
}

export function useDownloads(): DownloadsContextValue {
  const context = useContext(DownloadsContext);
  if (!context) {
    throw new Error('useDownloads must be used within a DownloadsProvider');
  }
  return context;
}
