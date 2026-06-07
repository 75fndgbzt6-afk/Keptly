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
}

export function Card({ children, style, padded = true, elevated = false, onPress }: CardProps) {
  const styles = useThemedStyles(makeStyles);
  const cardStyle = [styles.card, padded && styles.padded, elevated && styles.elevated, style];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={cardStyle}>
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
