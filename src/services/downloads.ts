import { Directory, File, Paths } from 'expo-file-system';

function getDownloadsDirectory(): Directory {
  const directory = new Directory(Paths.document, 'downloads');
  if (!directory.exists) {
    directory.create({ intermediates: true });
  }
  return directory;
}

function filenameForEpisode(episodeId: number, audioUrl: string): string {
  const extension = audioUrl.split('?')[0].split('.').pop() || 'mp3';
  return `episode-${episodeId}.${extension}`;
}

export async function downloadEpisodeFile(
  episodeId: number,
  audioUrl: string,
  onProgress?: (bytesWritten: number, totalBytes: number) => void
): Promise<{ localUri: string; fileSizeBytes: number }> {
  const destination = new File(getDownloadsDirectory(), filenameForEpisode(episodeId, audioUrl));
  const file = await File.downloadFileAsync(audioUrl, destination, {
    idempotent: true,
    onProgress: onProgress && (({ bytesWritten, totalBytes }) => onProgress(bytesWritten, totalBytes)),
  });
  return { localUri: file.uri, fileSizeBytes: file.size };
}

export function deleteDownloadedFile(localUri: string): void {
  const file = new File(localUri);
  if (file.exists) {
    file.delete();
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
