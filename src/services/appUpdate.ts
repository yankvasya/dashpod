import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

const APK_MIME_TYPE = 'application/vnd.android.package-archive';
// Intent.FLAG_GRANT_READ_URI_PERMISSION — required so the package installer (a different app)
// can read the content:// URI we hand it.
const FLAG_GRANT_READ_URI_PERMISSION = 1;

function getUpdateApkFile(): File {
  return new File(Paths.cache, 'dashpod-update.apk');
}

/** Downloads the given APK and launches Android's package installer for it.
 *
 * Rejects if not on Android, if the download fails, or if the installer can't be launched — most
 * commonly because the user hasn't granted "install unknown apps" for this app yet. Android
 * itself usually surfaces that as its own system prompt when the intent fires, but if the intent
 * can't be resolved at all the promise rejects, and callers should fall back to sending the user
 * to the release page instead (e.g. Linking.openURL(releaseUrl)) rather than failing silently. */
export async function downloadAndInstallUpdate(
  apkUrl: string,
  onProgress?: (bytesWritten: number, totalBytes: number) => void
): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('In-app updates are only available on Android.');
  }
  const destination = getUpdateApkFile();
  const file = await File.downloadFileAsync(apkUrl, destination, {
    idempotent: true,
    onProgress: onProgress && (({ bytesWritten, totalBytes }) => onProgress(bytesWritten, totalBytes)),
  });
  const contentUri = await getContentUriAsync(file.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
    type: APK_MIME_TYPE,
  });
}
