import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  elevated?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
}

export function Card({
  children,
  style,
  padded = true,
  elevated = false,
  onPress,
  onLongPress,
  accessibilityLabel,
}: CardProps) {
  const styles = useThemedStyles(makeStyles);
  const cardStyle = [styles.card, padded && styles.padded, elevated && styles.elevated, style];

  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={cardStyle}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  padded: {
    padding: theme.spacing.base,
  },
  elevated: {
    borderWidth: 0,
    ...theme.shadow.sm,
  },
});
