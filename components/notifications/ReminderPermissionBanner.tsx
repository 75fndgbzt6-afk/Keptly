import React from 'react';
import { TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText } from '@/components/ui';

/** Discreet Home banner shown when notification permission is off. */
export function ReminderPermissionBanner() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => Linking.openSettings()}
      style={styles.banner}
      accessibilityRole="button"
      accessibilityLabel="Open settings to enable notifications"
    >
      <Ionicons name="notifications-off-outline" size={18} color={theme.colors.status.warning} />
      <AppText size="sm" color={theme.colors.text.secondary} style={styles.text}>
        Reminders are off — enable notifications in Settings to never miss a renewal.
      </AppText>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.text.tertiary} />
    </TouchableOpacity>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.status.warningLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginHorizontal: theme.spacing.base,
    marginBottom: theme.spacing.sm,
  },
  text: {
    flex: 1,
  },
});
