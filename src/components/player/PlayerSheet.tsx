import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DescriptionText } from '@/components/DescriptionText';
import { ModalSheet } from '@/components/ModalSheet';
import { EpisodePlayButton } from '@/components/player/EpisodePlayButton';
import { LoadingRing } from '@/components/player/LoadingRing';
import { PlayPauseIcon } from '@/components/player/PlayPauseIcon';
import { formatSleepTimerRemaining, SleepTimerModal } from '@/components/player/SleepTimerModal';
import { formatSpeed, SpeedModal } from '@/components/player/SpeedModal';
import { ShimmerView } from '@/components/ShimmerView';
import { Slider } from '@/components/Slider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabBarHeight, MiniPlayerHeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayer } from '@/hooks/usePlayer';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { fetchTranscriptText } from '@/services/transcript';

const SKIP_SECONDS = 10;
const EXPAND_DURATION = 320;
const DISMISS_DISTANCE = 120;

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

/** The mini player and full player used to be two separate things (a floating bar, and a routed
 * modal screen) — this renders both from one component so the mini bar can morph into the full
 * player and back, instead of the full player sliding up as an unrelated screen. `expansion` (0
 * mini, 1 full) drives the outer container's position/size/radius/color and both content layers'
 * opacity; a separate `dragY` handles the swipe-down-to-collapse gesture on top of that. */
export function PlayerSheet() {
  const router = useRouter();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { subscriptions } = useSubscriptions();
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
    playerExpanded,
    expandPlayer,
    collapsePlayer,
  } = usePlayer();

  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [showRemaining, setShowRemaining] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [speedModalVisible, setSpeedModalVisible] = useState(false);
  const [sleepTimerModalVisible, setSleepTimerModalVisible] = useState(false);
  const [artworkLoaded, setArtworkLoaded] = useState(false);
  const [transcriptModalVisible, setTranscriptModalVisible] = useState(false);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState(false);
  // Tracks which episode's transcript is currently loaded/loading, so reopening the sheet for the
  // same episode doesn't refetch, but switching episodes does.
  const transcriptGuidRef = useRef<string | null>(null);
  const wasPlayingBeforeSeekRef = useRef(false);
  // seekTo()'s promise resolves once the seek command is issued, not once a remote/streaming
  // source has actually finished re-buffering to that position — so status.currentTime can still
  // briefly report the pre-seek position after `seeking` flips off. Hold the display at the
  // target until playback position actually catches up, instead of letting it bounce back.
  const pendingSeekTargetRef = useRef<number | null>(null);
  const fadePulseAnim = useRef(new Animated.Value(1)).current;

  const expansion = useSharedValue(0);
  const dragY = useSharedValue(0);

  useEffect(() => {
    expansion.value = withTiming(playerExpanded ? 1 : 0, { duration: EXPAND_DURATION });
    if (!playerExpanded) dragY.value = 0;
  }, [playerExpanded, expansion, dragY]);

  // Android hardware back / gesture should collapse the expanded player instead of falling
  // through to whatever's behind it — only registered while actually expanded.
  useEffect(() => {
    if (!playerExpanded) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      collapsePlayer();
      return true;
    });
    return () => subscription.remove();
  }, [playerExpanded, collapsePlayer]);

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

  const miniBottom = BottomTabBarHeight + insets.bottom + Spacing.one;
  const miniTop = screenHeight - miniBottom - MiniPlayerHeight;
  const miniBackground = theme.backgroundElement;
  const fullBackground = theme.background;

  const containerStyle = useAnimatedStyle(() => {
    const e = expansion.value;
    return {
      top: interpolate(e, [0, 1], [miniTop, 0], Extrapolation.CLAMP),
      bottom: interpolate(e, [0, 1], [miniBottom, 0], Extrapolation.CLAMP),
      left: interpolate(e, [0, 1], [Spacing.three, 0], Extrapolation.CLAMP),
      right: interpolate(e, [0, 1], [Spacing.three, 0], Extrapolation.CLAMP),
      borderRadius: interpolate(e, [0, 1], [Spacing.three, 0], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(e, [0, 1], [miniBackground, fullBackground]),
    };
  });

  const miniContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expansion.value, [0, 0.3], [1, 0], Extrapolation.CLAMP),
  }));

  const fullContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expansion.value, [0.5, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: dragY.value }],
  }));

  const dragHandleGesture = Gesture.Pan()
    .onChange((event) => {
      dragY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_DISTANCE) {
        dragY.value = 0;
        runOnJS(collapsePlayer)();
      } else {
        dragY.value = withTiming(0);
      }
    });

  if (!nowPlaying) return null;

  const artworkUrl = nowPlaying.episode.artworkUrl ?? nowPlaying.podcastArtworkUrl;
  // Once playback position actually reaches the pending seek target, stop holding the display
  // there and go back to tracking it live.
  if (pendingSeekTargetRef.current != null && Math.abs(status.currentTime - pendingSeekTargetRef.current) < 1.5) {
    pendingSeekTargetRef.current = null;
  }
  const displayPosition = seeking ? seekValue : (pendingSeekTargetRef.current ?? status.currentTime);
  const duration = status.duration || 0;
  const isLoading = episodeLoading || status.isBuffering;
  const miniProgress = duration > 0 ? status.currentTime / duration : 0;

  function commitSeek(value: number) {
    pendingSeekTargetRef.current = value;
    seekTo(value);
  }

  function skipBy(deltaSeconds: number) {
    const upperBound = duration > 0 ? duration : Infinity;
    commitSeek(Math.min(Math.max(status.currentTime + deltaSeconds, 0), upperBound));
  }

  const podcastFeedUrl = nowPlaying ? subscriptions.find((podcast) => podcast.id === nowPlaying.podcastId)?.feedUrl : undefined;

  function goToPodcast() {
    if (!podcastFeedUrl) return;
    collapsePlayer();
    router.push({ pathname: '/my-podcasts', params: { openFeedUrl: podcastFeedUrl } });
  }

  async function handleOpenTranscript() {
    setTranscriptModalVisible(true);
    if (!nowPlaying) return;
    const { transcriptUrl, transcriptType, guid } = nowPlaying.episode;
    if (!transcriptUrl || !transcriptType) return;
    if (transcriptGuidRef.current === guid && (transcriptText || transcriptError)) return;
    transcriptGuidRef.current = guid;
    setTranscriptLoading(true);
    setTranscriptError(false);
    setTranscriptText(null);
    try {
      setTranscriptText(await fetchTranscriptText(transcriptUrl, transcriptType));
    } catch {
      setTranscriptError(true);
    } finally {
      setTranscriptLoading(false);
    }
  }

  return (
    <Reanimated.View style={[styles.container, containerStyle]} pointerEvents="box-none">
      <Reanimated.View
        style={[styles.fill, miniContentStyle]}
        pointerEvents={playerExpanded ? 'none' : 'auto'}>
        <Pressable onPress={expandPlayer} style={styles.miniPressable}>
          <Image source={{ uri: artworkUrl }} style={styles.miniArtwork} />
          <View style={styles.miniText}>
            <ThemedText numberOfLines={1}>{nowPlaying.episode.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {nowPlaying.podcastTitle}
            </ThemedText>
          </View>
          <EpisodePlayButton
            playing={status.playing}
            loading={isLoading}
            progress={miniProgress}
            onPress={() => (status.playing ? pause() : play())}
            size={32}
          />
        </Pressable>
      </Reanimated.View>

      <Reanimated.View style={[styles.fill, fullContentStyle]} pointerEvents={playerExpanded ? 'auto' : 'none'}>
        <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <GestureDetector gesture={dragHandleGesture}>
            <View>
              <View style={styles.dragHandle} />
              <ThemedView style={styles.topBar}>
                <Pressable onPress={collapsePlayer} hitSlop={8}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {t('player.close')}
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </View>
          </GestureDetector>

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

            <View style={styles.metaButtonsRow}>
              <Pressable onPress={() => setShowInfo((value) => !value)} hitSlop={8} style={styles.infoToggle}>
                <ThemedText type="small" themeColor="accent">
                  {showInfo ? t('player.hideInfo') : t('player.episodeInfo')}
                </ThemedText>
              </Pressable>
              {nowPlaying.episode.transcriptUrl && (
                <Pressable onPress={handleOpenTranscript} hitSlop={8} style={styles.infoToggle}>
                  <ThemedText type="small" themeColor="accent">
                    {t('player.transcript')}
                  </ThemedText>
                </Pressable>
              )}
            </View>

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
                      {t('player.fading')}
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
                          {t('player.end')}
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
        </View>
      </Reanimated.View>

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

      <ModalSheet visible={transcriptModalVisible} onClose={() => setTranscriptModalVisible(false)}>
        <ThemedText type="subtitle" style={styles.centerText}>
          {t('player.transcript')}
        </ThemedText>
        <ScrollView style={styles.transcriptScroll}>
          {transcriptLoading && <ThemedText themeColor="textSecondary">{t('player.transcriptLoading')}</ThemedText>}
          {transcriptError && <ThemedText themeColor="textSecondary">{t('player.transcriptError')}</ThemedText>}
          {!transcriptLoading && !transcriptError && transcriptText != null && (
            <ThemedText>{transcriptText || t('player.transcriptEmpty')}</ThemedText>
          )}
        </ScrollView>
      </ModalSheet>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    overflow: 'hidden',
    zIndex: 500,
    elevation: 500,
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
  safeArea: {
    flex: 1,
  },
  miniPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  miniArtwork: {
    width: 40,
    height: 40,
    borderRadius: Spacing.two,
  },
  miniText: {
    flex: 1,
    gap: Spacing.half,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.two,
    backgroundColor: 'rgba(128,128,128,0.4)',
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
  metaButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  infoToggle: {
    marginTop: Spacing.one,
  },
  transcriptScroll: {
    maxHeight: 400,
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
