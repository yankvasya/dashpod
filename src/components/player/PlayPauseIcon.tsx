import { View, StyleSheet } from 'react-native';

interface PlayPauseIconProps {
  playing: boolean;
  size?: number;
  color: string;
}

/** Hand-drawn play/pause glyph so we don't depend on platform icon-name coverage. */
export function PlayPauseIcon({ playing, size = 16, color }: PlayPauseIconProps) {
  if (playing) {
    const barWidth = size * 0.28;
    const barHeight = size * 0.85;
    return (
      <View style={[styles.pauseContainer, { width: size, height: size, gap: size * 0.2 }]}>
        <View style={{ width: barWidth, height: barHeight, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: barWidth, height: barHeight, backgroundColor: color, borderRadius: 1 }} />
      </View>
    );
  }

  return (
    <View style={[styles.playContainer, { width: size, height: size }]}>
      <View
        style={{
          width: 0,
          height: 0,
          marginLeft: size * 0.12,
          borderTopWidth: size * 0.5,
          borderBottomWidth: size * 0.5,
          borderLeftWidth: size * 0.85,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pauseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
