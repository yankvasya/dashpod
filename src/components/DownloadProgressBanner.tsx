import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDownloads } from '@/hooks/useDownloads';
import { formatFileSize } from '@/services/downloads';

export default function DownloadProgressBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { downloadProgress } = useDownloads();

  if (downloadProgress.size === 0) return null;

  return (
    <View style={[styles.container, { top: insets.top }]} pointerEvents="none">
      {Array.from(downloadProgress.entries()).map(([episodeId, progress]) => {
        const fraction = progress.totalBytes > 0 ? progress.bytesWritten / progress.totalBytes : 0;
        return (
          <ThemedView key={episodeId} type="backgroundElement" style={styles.banner}>
            <ThemedText numberOfLines={1} type="small">
              {`Downloading ${progress.episodeTitle}`}
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
