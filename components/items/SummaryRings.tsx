import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText, Card } from '@/components/ui';
import { ActivityRings } from '@/components/charts';

export interface RingDatum {
  fraction: number;
  color: string;
  label: string;
  caption: string;
}

/** Apple-Watch-style summary card: three rings + a compact legend (no clutter). */
export function SummaryRings({ rings }: { rings: RingDatum[] }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      <ActivityRings
        size={104}
        thickness={11}
        gap={4}
        rings={rings.map((r) => ({ fraction: r.fraction, color: r.color }))}
      />
      <View style={styles.legend}>
        {rings.map((r) => (
          <View key={r.label} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: r.color }]} />
            <View style={styles.legendText}>
              <AppText size="sm" weight="medium">
                {r.label}
              </AppText>
              <AppText size="xs" color={theme.colors.text.tertiary}>
                {r.caption}
              </AppText>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.lg,
    },
    legend: {
      flex: 1,
      gap: theme.spacing.sm,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      flex: 1,
    },
  });
