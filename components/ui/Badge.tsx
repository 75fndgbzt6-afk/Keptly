import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '@/constants/theme';
import { AppText } from './AppText';

type BadgeVariant = 'good' | 'warning' | 'danger' | 'neutral' | 'accent';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; text: string }> = {
  good: { bg: theme.colors.status.goodLight, text: theme.colors.status.good },
  warning: { bg: theme.colors.status.warningLight, text: theme.colors.status.warning },
  danger: { bg: theme.colors.status.dangerLight, text: theme.colors.status.danger },
  neutral: { bg: theme.colors.surfaceAlt, text: theme.colors.text.secondary },
  accent: { bg: theme.colors.accentLight, text: theme.colors.accent },
};

export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const { bg, text } = VARIANT_COLORS[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <AppText size="xs" weight="medium" color={text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    alignSelf: 'flex-start',
  },
});
