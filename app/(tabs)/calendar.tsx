import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Screen, AppText, EmptyState } from '@/components/ui';
import { theme } from '@/constants/theme';

export default function CalendarScreen() {
  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <AppText size="xl" weight="bold">
          Calendar
        </AppText>
      </View>

      <EmptyState
        icon="calendar-outline"
        title="Nothing scheduled"
        message="Upcoming renewals, due dates, and expiries will appear here."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
});
