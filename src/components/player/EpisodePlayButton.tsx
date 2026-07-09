import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { LoadingRing } from '@/components/player/LoadingRing';
import { PlayPauseIcon } from '@/components/player/PlayPauseIcon';
import { useTheme } from '@/hooks/use-theme';

interface EpisodePlayButtonProps {
  playing: boolean;
  loading?: boolean;
  /** 0-1 */
  progress: number;
  onPress: () => void;
  size?: number;
}

export function EpisodePlayButton({
  playing,
  loading = false,
  progress,
  onPress,
  size = 36,
}: EpisodePlayButtonProps) {
  const theme = useTheme();
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const strokeDashoffset = circumference * (1 - clampedProgress);

  return (
    <Pressable onPress={onPress} hitSlop={8} style={[styles.container, { width: size, height: size }]}>
      {loading ? (
        <LoadingRing size={size} color={theme.accent} strokeWidth={strokeWidth} />
      ) : (
        <>
          <Svg width={size} height={size} style={styles.ring}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={theme.backgroundSelected}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {clampedProgress > 0 && (
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={theme.accent}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                rotation={-90}
                origin={`${size / 2}, ${size / 2}`}
              />
            )}
          </Svg>
          <View style={styles.iconContainer}>
            <PlayPauseIcon playing={playing} size={size * 0.4} color={theme.text} />
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
