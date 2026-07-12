import Slider from '@react-native-community/slider';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingRing } from '@/components/player/LoadingRing';
import { PlayPauseIcon } from '@/components/player/PlayPauseIcon';
import { formatSpeed, SpeedModal } from '@/components/player/SpeedModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayer } from '@/hooks/usePlayer';
import { stripHtml } from '@/utils/format';

const SKIP_SECONDS = 10;

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function PlayerScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { nowPlaying, status, episodeLoading, play, pause, seekTo, playbackRate, setRate, hasNext, skipToNext } =
    usePlayer();
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [showRemaining, setShowRemaining] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [speedModalVisible, setSpeedModalVisible] = useState(false);
  const wasPlayingBeforeSeekRef = useRef(false);

  useEffect(() => {
    if (!nowPlaying) {
      router.back();
    }
  }, [nowPlaying, router]);

  if (!nowPlaying) return null;

  const artworkUrl = nowPlaying.episode.artworkUrl ?? nowPlaying.podcastArtworkUrl;
  const displayPosition = seeking ? seekValue : status.currentTime;
  const duration = status.duration || 0;
  const isLoading = episodeLoading || status.isBuffering;

  function skipBy(deltaSeconds: number) {
    const upperBound = duration > 0 ? duration : Infinity;
    seekTo(Math.min(Math.max(status.currentTime + deltaSeconds, 0), upperBound));
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Close
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => setShowInfo((value) => !value)} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {showInfo ? 'Hide Info' : 'Episode Info'}
            </ThemedText>
          </Pressable>
        </ThemedView>

        <ScrollView contentContainerStyle={styles.content}>
          <Image source={{ uri: artworkUrl }} style={styles.artwork} />
          <ThemedText type="subtitle" style={styles.centerText} numberOfLines={2}>
            {nowPlaying.episode.title}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centerText} numberOfLines={1}>
            {nowPlaying.podcastTitle}
          </ThemedText>

          {showInfo && stripHtml(nowPlaying.episode.description) ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
              {stripHtml(nowPlaying.episode.description)}
            </ThemedText>
          ) : null}

          <View style={styles.sliderSection}>
            <Slider
              value={displayPosition}
              minimumValue={0}
              maximumValue={duration || 1}
              tapToSeek
              onSlidingStart={() => {
                wasPlayingBeforeSeekRef.current = status.playing;
                if (status.playing) pause();
                setSeeking(true);
              }}
              onValueChange={setSeekValue}
              onSlidingComplete={async (value) => {
                await seekTo(value);
                if (wasPlayingBeforeSeekRef.current) play();
                setSeeking(false);
              }}
              minimumTrackTintColor={theme.accent}
              maximumTrackTintColor={theme.backgroundSelected}
              thumbTintColor={theme.accent}
            />
            <ThemedView style={styles.timeRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {formatTime(displayPosition)}
              </ThemedText>
              <Pressable onPress={() => setShowRemaining((value) => !value)} hitSlop={8}>
                <ThemedText type="small" themeColor="textSecondary">
                  {showRemaining ? `-${formatTime(duration - displayPosition)}` : formatTime(duration)}
                </ThemedText>
              </Pressable>
            </ThemedView>
          </View>

          <ThemedView style={styles.controlsRow}>
            <Pressable
              onPress={() => setSpeedModalVisible(true)}
              style={[styles.speedPill, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" themeColor="text">
                {formatSpeed(playbackRate)}
              </ThemedText>
            </Pressable>

            <Pressable onPress={() => skipBy(-SKIP_SECONDS)} hitSlop={8} style={styles.skipButton}>
              <SymbolView
                tintColor={theme.text}
                name={{ ios: 'gobackward.10', android: 'replay_10', web: 'replay_10' }}
                size={26}
              />
            </Pressable>

            <Pressable
              onPress={() => (status.playing ? pause() : play())}
              disabled={isLoading}
              style={[styles.playButton, { backgroundColor: theme.backgroundElement }]}>
              {isLoading ? (
                <LoadingRing size={32} color={theme.accent} strokeWidth={3} />
              ) : (
                <PlayPauseIcon playing={status.playing} size={32} color={theme.text} />
              )}
            </Pressable>

            <Pressable onPress={() => skipBy(SKIP_SECONDS)} hitSlop={8} style={styles.skipButton}>
              <SymbolView
                tintColor={theme.text}
                name={{ ios: 'goforward.10', android: 'forward_10', web: 'forward_10' }}
                size={26}
              />
            </Pressable>

            <Pressable onPress={skipToNext} disabled={!hasNext} hitSlop={8} style={styles.nextButton}>
              <SymbolView
                tintColor={hasNext ? theme.text : theme.backgroundSelected}
                name={{ ios: 'forward.end.fill', android: 'skip_next', web: 'skip_next' }}
                size={26}
              />
            </Pressable>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>

      <SpeedModal
        visible={speedModalVisible}
        rate={playbackRate}
        onChange={setRate}
        onClose={() => setSpeedModalVisible(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  artwork: {
    width: 280,
    height: 280,
    borderRadius: Spacing.four,
    marginBottom: Spacing.three,
  },
  centerText: {
    textAlign: 'center',
  },
  description: {
    alignSelf: 'stretch',
  },
  sliderSection: {
    width: '100%',
    marginTop: Spacing.five,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: Spacing.four,
  },
  speedPill: {
    width: 56,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
  skipButton: {
    width: 40,
    alignItems: 'center',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButton: {
    width: 56,
    alignItems: 'center',
  },
});
