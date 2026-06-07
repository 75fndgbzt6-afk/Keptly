import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText, Card } from '@/components/ui';
import { Heatmap, Sparkline } from '@/components/charts';
import { Item } from '@/types';
import { hasUsageModel } from '@/lib/usage-models';
import { getDailyUsageCounts, getCostPerUseTrend } from '@/services/value-engine';

/** 12-week usage heatmap + cost-per-use sparkline. Tracked categories only. */
export function UsageHistoryCard({ item }: { item: Item }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [counts, setCounts] = useState<number[]>([]);
  const [cpuTrend, setCpuTrend] = useState<number[]>([]);
  const tracked = hasUsageModel(item.category);

  useEffect(() => {
    if (!tracked) return;
    let active = true;
    (async () => {
      const [c, t] = await Promise.all([
        getDailyUsageCounts(item.id),
        getCostPerUseTrend(item.id),
      ]);
      if (!active) return;
      setCounts(c);
      setCpuTrend(t);
    })();
    return () => {
      active = false;
    };
  }, [item.id, tracked]);

  if (!tracked) return null;
  const hasAny = counts.some((c) => c > 0);

  return (
    <Card style={styles.card}>
      <AppText weight="semibold">Usage history</AppText>

      {hasAny ? (
        <View style={styles.block}>
          <AppText size="xs" color={theme.colors.text.tertiary}>
            Last 12 weeks
          </AppText>
          <Heatmap counts={counts} accent={theme.colors.accent} />
        </View>
      ) : (
        <AppText size="sm" color={theme.colors.text.tertiary}>
          Log usage to see your 12-week activity here.
        </AppText>
      )}

      {cpuTrend.length >= 2 ? (
        <View style={styles.trendRow}>
          <AppText size="sm" color={theme.colors.text.secondary}>
            Cost-per-use trend
          </AppText>
          <Sparkline data={cpuTrend} color={theme.colors.accent} />
        </View>
      ) : null}
    </Card>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: theme.spacing.md,
    },
    block: {
      gap: theme.spacing.sm,
    },
    trendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  });
