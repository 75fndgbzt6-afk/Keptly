import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText } from './AppText';

type BadgeVariant = 'good' | 'warning' | 'danger' | 'neutral' | 'accent';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

function variantColors(theme: Theme): Record<BadgeVariant, { bg: string; text: string }> {
  const c = theme.colors;
  return {
    good: { bg: c.status.goodLight, text: c.status.good },
    warning: { bg: c.status.warningLight, text: c.status.warning },
    danger: { bg: c.status.dangerLight, text: c.status.danger },
    neutral: { bg: c.surfaceAlt, text: c.text.secondary },
    accent: { bg: c.accentLight, text: c.accent },
  };
}

export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { bg, text } = variantColors(theme)[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <AppText size="xs" weight="medium" color={text}>
        {label}
      </AppText>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    alignSelf: 'flex-start',
  },
});
