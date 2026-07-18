import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DescriptionText } from '@/components/DescriptionText';
import { ModalSheet } from '@/components/ModalSheet';
import { EpisodePlayButton } from '@/components/player/EpisodePlayButton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatDate, formatDuration } from '@/utils/format';

export interface EpisodeDetailData {
  title: string;
  podcastTitle: string;
  artworkUrl: string | null;
  description: string;
  durationSeconds: number;
  publishedAt: number;
}

interface EpisodeDetailSheetProps {
  episode: EpisodeDetailData | null;
  visible: boolean;
  playing: boolean;
  loading: boolean;
  progress: number;
  onPlayPause: () => void;
  onOpenPlayer: () => void;
  onClose: () => void;
}

/** Bottom sheet shown when an episode row is tapped, instead of jumping straight to the full
 * player — lets someone check what an episode is about (or start it) without the full-screen
 * commitment. "Open Player" is the escape hatch for when they do want the full controls. */
export function EpisodeDetailSheet({
  episode,
  visible,
  playing,
  loading,
  progress,
  onPlayPause,
  onOpenPlayer,
  onClose,
}: EpisodeDetailSheetProps) {
  const { t, i18n } = useTranslation();
  // Retains the last non-null episode while the sheet's own dismiss animation plays — otherwise
  // the content would vanish instantly (episode goes null the moment the caller closes it) while
  // the sheet frame is still fading/sliding away underneath it.
  const [displayedEpisode, setDisplayedEpisode] = useState(episode);
  useEffect(() => {
    if (episode) setDisplayedEpisode(episode);
  }, [episode]);

  return (
    <ModalSheet visible={visible} onClose={onClose} contentStyle={styles.sheet}>
      {displayedEpisode && (
        <>
          <View style={styles.header}>
            <Image source={{ uri: displayedEpisode.artworkUrl ?? undefined }} style={styles.artwork} />
            <View style={styles.headerText}>
              <ThemedText numberOfLines={3}>{displayedEpisode.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {displayedEpisode.podcastTitle}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[
                  formatDate(displayedEpisode.publishedAt, i18n.language),
                  formatDuration(displayedEpisode.durationSeconds, t),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
            </View>
          </View>

          <ScrollView style={styles.descriptionScroll}>
            <DescriptionText
              html={displayedEpisode.description}
              type="small"
              themeColor="textSecondary"
              style={styles.description}
            />
          </ScrollView>

          <View style={styles.actionsRow}>
            <Pressable onPress={onOpenPlayer} style={styles.openPlayerButton}>
              <ThemedText type="smallBold" themeColor="accent">
                {t('episodeDetail.openPlayer')}
              </ThemedText>
            </Pressable>
            <EpisodePlayButton playing={playing} loading={loading} progress={progress} onPress={onPlayPause} size={48} />
          </View>
        </>
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: Spacing.three,
  },
  descriptionScroll: {
    maxHeight: 280,
  },
  header: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  artwork: {
    width: 72,
    height: 72,
    borderRadius: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: Spacing.half,
    justifyContent: 'center',
  },
  description: {
    alignSelf: 'stretch',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  openPlayerButton: {
    paddingVertical: Spacing.two,
    paddingRight: Spacing.three,
  },
});
