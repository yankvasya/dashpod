import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Reanimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DescriptionText } from '@/components/DescriptionText';
import { LoadingRing } from '@/components/player/LoadingRing';
import { PlayPauseIcon } from '@/components/player/PlayPauseIcon';
import { formatSleepTimerRemaining, SleepTimerModal } from '@/components/player/SleepTimerModal';
import { formatSpeed, SpeedModal } from '@/components/player/SpeedModal';
import { ShimmerView } from '@/components/ShimmerView';
import { Slider } from '@/components/Slider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayer } from '@/hooks/usePlayer';
import { useSubscriptions } from '@/hooks/useSubscriptions';

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
  const {
    nowPlaying,
    status,
    episodeLoading,
    play,
    pause,
    seekTo,
    playbackRate,
    setRate,
    hasNext,
    skipToNext,
    skipToPrevious,
    sleepTimer,
    setSleepTimerMinutes,
    setSleepTimerEndOfEpisode,
    cancelSleepTimer,
    isFadingOut,
    setPlayerScreenOpen,
  } = usePlayer();
  const { subscriptions } = useSubscriptions();
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [showRemaining, setShowRemaining] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [speedModalVisible, setSpeedModalVisible] = useState(false);
  const [sleepTimerModalVisible, setSleepTimerModalVisible] = useState(false);
  const [artworkLoaded, setArtworkLoaded] = useState(false);
  const wasPlayingBeforeSeekRef = useRef(false);
  // seekTo()'s promise resolves once the seek command is issued, not once a remote/streaming
  // source has actually finished re-buffering to that position — so status.currentTime can still
  // briefly report the pre-seek position after `seeking` flips off. Hold the display at the
  // target until playback position actually catches up, instead of letting it bounce back.
  const pendingSeekTargetRef = useRef<number | null>(null);
  const fadePulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!nowPlaying) {
      router.back();
    }
  }, [nowPlaying, router]);

  useEffect(() => {
    setPlayerScreenOpen(true);
    return () => setPlayerScreenOpen(false);
  }, [setPlayerScreenOpen]);

  const currentArtworkUrl = nowPlaying?.episode.artworkUrl ?? nowPlaying?.podcastArtworkUrl;
  useEffect(() => {
    setArtworkLoaded(false);
  }, [currentArtworkUrl]);

  useEffect(() => {
    if (!isFadingOut) {
      fadePulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fadePulseAnim, { toValue: 0.4, duration: 400, useNativeDriver: true }),
        Animated.timing(fadePulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isFadingOut, fadePulseAnim]);

  if (!nowPlaying) return null;

  const artworkUrl = nowPlaying.episode.artworkUrl ?? nowPlaying.podcastArtworkUrl;
  // Once playback position actually reaches the pending seek target, stop holding the display
  // there and go back to tracking it live.
  if (
    pendingSeekTargetRef.current != null &&
    Math.abs(status.currentTime - pendingSeekTargetRef.current) < 1.5
  ) {
    pendingSeekTargetRef.current = null;
  }
  const displayPosition = seeking
    ? seekValue
    : (pendingSeekTargetRef.current ?? status.currentTime);
  const duration = status.duration || 0;
  const isLoading = episodeLoading || status.isBuffering;

  function commitSeek(value: number) {
    pendingSeekTargetRef.current = value;
    seekTo(value);
  }

  function skipBy(deltaSeconds: number) {
    const upperBound = duration > 0 ? duration : Infinity;
    commitSeek(Math.min(Math.max(status.currentTime + deltaSeconds, 0), upperBound));
  }

  const podcastFeedUrl = subscriptions.find((podcast) => podcast.id === nowPlaying.podcastId)?.feedUrl;

  function goToPodcast() {
    if (!podcastFeedUrl) return;
    router.push({ pathname: '/my-podcasts', params: { openFeedUrl: podcastFeedUrl } });
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
        </ThemedView>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.artwork}>
            {!artworkLoaded && <ShimmerView style={styles.artworkFill} />}
            <Image
              source={{ uri: artworkUrl }}
              style={styles.artworkFill}
              transition={200}
              onLoadEnd={() => setArtworkLoaded(true)}
            />
          </View>
          <ThemedText type="subtitle" style={styles.centerText} numberOfLines={2}>
            {nowPlaying.episode.title}
          </ThemedText>
          <Pressable onPress={goToPodcast} disabled={!podcastFeedUrl} hitSlop={8}>
            <ThemedText themeColor="textSecondary" style={styles.centerText} numberOfLines={1}>
              {nowPlaying.podcastTitle}
            </ThemedText>
          </Pressable>

          <Pressable onPress={() => setShowInfo((value) => !value)} hitSlop={8} style={styles.infoToggle}>
            <ThemedText type="small" themeColor="accent">
              {showInfo ? 'Hide Info' : 'Episode Info'}
            </ThemedText>
          </Pressable>

          {showInfo && (
            <Reanimated.View
              entering={FadeIn.duration(250)}
              exiting={FadeOut.duration(200)}
              layout={LinearTransition.duration(250)}
              style={styles.descriptionWrap}>
              <Pressable onPress={() => setShowInfo(false)}>
                <ThemedText type="smallBold" style={styles.infoEpisodeTitle}>
                  {nowPlaying.episode.title}
                </ThemedText>
                <DescriptionText
                  html={nowPlaying.episode.description}
                  type="small"
                  themeColor="textSecondary"
                  style={styles.description}
                />
              </Pressable>
            </Reanimated.View>
          )}

          <Reanimated.View layout={LinearTransition.duration(250)} style={styles.sliderSection}>
            <Slider
              value={displayPosition}
              minimumValue={0}
              maximumValue={duration || 1}
              onSlidingStart={() => {
                wasPlayingBeforeSeekRef.current = status.playing;
                if (status.playing) pause();
                setSeeking(true);
              }}
              onValueChange={setSeekValue}
              onSlidingComplete={async (value) => {
                pendingSeekTargetRef.current = value;
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
          </Reanimated.View>

          <ThemedView style={styles.settingsRow}>
            <Pressable
              onPress={() => setSpeedModalVisible(true)}
              style={[styles.speedPill, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" themeColor="text">
                {formatSpeed(playbackRate)}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setSleepTimerModalVisible(true)}
              style={[
                styles.sleepTimerButton,
                { backgroundColor: sleepTimer.mode !== 'off' || isFadingOut ? theme.accent : theme.backgroundElement },
              ]}>
              <Animated.View style={[styles.sleepTimerContent, { opacity: fadePulseAnim }]}>
                <Ionicons
                  name="moon-outline"
                  color={sleepTimer.mode !== 'off' || isFadingOut ? theme.background : theme.text}
                  size={16}
                />
                {isFadingOut ? (
                  <ThemedText type="smallBold" themeColor="background">
                    Fading…
                  </ThemedText>
                ) : (
                  <>
                    {sleepTimer.mode === 'duration' && sleepTimer.remainingSeconds != null && (
                      <ThemedText type="smallBold" themeColor="background">
                        {formatSleepTimerRemaining(sleepTimer.remainingSeconds)}
                      </ThemedText>
                    )}
                    {sleepTimer.mode === 'endOfEpisode' && (
                      <ThemedText type="smallBold" themeColor="background">
                        End
                      </ThemedText>
                    )}
                  </>
                )}
              </Animated.View>
            </Pressable>
          </ThemedView>

          <ThemedView style={styles.controlsRow}>
            <Pressable onPress={skipToPrevious} hitSlop={8} style={styles.nextButton}>
              <Ionicons name="play-skip-back" color={theme.text} size={26} />
            </Pressable>

            <Pressable onPress={() => skipBy(-SKIP_SECONDS)} hitSlop={8} style={styles.skipButton}>
              <MaterialIcons name="replay-10" color={theme.text} size={26} />
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
              <MaterialIcons name="forward-10" color={theme.text} size={26} />
            </Pressable>

            <Pressable onPress={skipToNext} disabled={!hasNext} hitSlop={8} style={styles.nextButton}>
              <Ionicons name="play-skip-forward" color={hasNext ? theme.text : theme.backgroundSelected} size={26} />
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

      <SleepTimerModal
        visible={sleepTimerModalVisible}
        mode={sleepTimer.mode}
        onSelectMinutes={(minutes) => {
          setSleepTimerMinutes(minutes);
          setSleepTimerModalVisible(false);
        }}
        onSelectEndOfEpisode={() => {
          setSleepTimerEndOfEpisode();
          setSleepTimerModalVisible(false);
        }}
        onCancel={() => {
          cancelSleepTimer();
          setSleepTimerModalVisible(false);
        }}
        onClose={() => setSleepTimerModalVisible(false)}
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
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  artwork: {
    width: 240,
    height: 240,
    borderRadius: Spacing.four,
    marginBottom: Spacing.two,
    overflow: 'hidden',
  },
  artworkFill: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  centerText: {
    textAlign: 'center',
  },
  infoToggle: {
    marginTop: Spacing.one,
  },
  descriptionWrap: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
  infoEpisodeTitle: {
    marginBottom: Spacing.one,
  },
  description: {
    alignSelf: 'stretch',
  },
  sliderSection: {
    width: '100%',
    marginTop: Spacing.four,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  settingsRow: {
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
  sleepTimerButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
  },
  sleepTimerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: Spacing.four,
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
