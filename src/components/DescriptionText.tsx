import { Linking, Text, type TextStyle } from 'react-native';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { parseDescriptionSegments } from '@/utils/format';

interface DescriptionTextProps extends Omit<ThemedTextProps, 'children'> {
  html: string;
}

/** Renders a feed description with any <a href> links kept tappable, instead of the plain-text
 * stripHtml() gives you. Returns null when there's nothing to show. */
export function DescriptionText({ html, ...themedTextProps }: DescriptionTextProps) {
  const theme = useTheme();
  const segments = parseDescriptionSegments(html);
  if (segments.length === 0) return null;

  const linkStyle: TextStyle = { color: theme.accent, textDecorationLine: 'underline' };

  return (
    <ThemedText {...themedTextProps}>
      {segments.map((segment, index) =>
        segment.href ? (
          <Text key={index} style={linkStyle} onPress={() => Linking.openURL(segment.href!)}>
            {segment.text}
          </Text>
        ) : (
          segment.text
        )
      )}
    </ThemedText>
  );
}
