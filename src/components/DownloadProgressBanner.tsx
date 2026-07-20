import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDownloads } from '@/hooks/useDownloads';
import { formatFileSize } from '@/services/downloads';

// Above this many simultaneous downloads, showing one full banner each would grow the stack to
// cover most of the screen — collapse into a single aggregate banner instead.
const COLLAPSE_THRESHOLD = 2;

export default function DownloadProgressBanner() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { downloadProgress } = useDownloads();

  if (downloadProgress.size === 0) return null;

  const entries = Array.from(downloadProgress.entries());

  if (entries.length > COLLAPSE_THRESHOLD) {
    const totals = entries.reduce(
      (sum, [, progress]) => ({
        bytesWritten: sum.bytesWritten + progress.bytesWritten,
        totalBytes: sum.totalBytes + progress.totalBytes,
      }),
      { bytesWritten: 0, totalBytes: 0 }
    );
    const fraction = totals.totalBytes > 0 ? totals.bytesWritten / totals.totalBytes : 0;
    return (
      <View style={[styles.container, { top: insets.top }]} pointerEvents="none">
        <ThemedView type="backgroundElement" style={styles.banner}>
          <ThemedText numberOfLines={1} type="small">
            {t('downloads.downloadingCount', { count: entries.length })}
          </ThemedText>
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[styles.fill, { backgroundColor: theme.accent, width: `${Math.max(4, fraction * 100)}%` }]}
            />
          </View>
        </ThemedView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { top: insets.top }]} pointerEvents="none">
      {entries.map(([episodeId, progress]) => {
        const fraction = progress.totalBytes > 0 ? progress.bytesWritten / progress.totalBytes : 0;
        return (
          <ThemedView key={episodeId} type="backgroundElement" style={styles.banner}>
            <ThemedText numberOfLines={1} type="small">
              {t('downloads.downloadingEpisode', { title: progress.episodeTitle })}
            </ThemedText>
            <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.fill,
                  { backgroundColor: theme.accent, width: `${Math.max(4, fraction * 100)}%` },
                ]}
              />
            </View>
            {progress.totalBytes > 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.sizeText}>
                {`${formatFileSize(progress.bytesWritten)} / ${formatFileSize(progress.totalBytes)}`}
              </ThemedText>
            )}
          </ThemedView>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  banner: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  track: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  fill: {
    height: 2,
  },
  sizeText: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
});
