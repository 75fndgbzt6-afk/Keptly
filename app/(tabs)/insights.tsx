import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Screen, AppText, EmptyState } from '@/components/ui';
import { theme } from '@/constants/theme';

export default function InsightsScreen() {
  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <AppText size="xl" weight="bold">
          Insights
        </AppText>
      </View>

      <EmptyState
        icon="bar-chart-outline"
        title="No insights yet"
        message="Add items to see your spending breakdown and savings recommendations."
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
