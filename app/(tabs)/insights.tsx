import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Card, Badge, Button, EmptyState } from '@/components/ui';
import { SpendByCategoryChart, MonthlyTrendChart, RecommendationCard } from '@/components/insights';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { Category, Item, Recommendation } from '@/types';
import { CATEGORY_ICONS } from '@/lib/category';
import { RECOMMENDATION_META } from '@/lib/recommendations';
import { COST_UNIT_SUFFIX } from '@/lib/usage-models';
import { formatCurrency } from '@/lib/currency';
import { getSpendByCategory, getMonthlyTrend } from '@/services/dashboard';
import { getCostPerUseMap, CostPerUse } from '@/services/value-engine';
import { applyRecommendation, dismissRecommendation } from '@/services/recommendation-engine';
import { seedSampleData } from '@/services/dev-seed';
import { useItemsStore } from '@/stores/itemsStore';
import { useRecommendationsStore } from '@/stores/recommendationsStore';

interface LeaderEntry {
  item: Item;
  cpu: CostPerUse;
}

export default function InsightsScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const items = useItemsStore((s) => s.items);
  const refreshItems = useItemsStore((s) => s.refresh);
  const recommendations = useRecommendationsStore((s) => s.recommendations);
  const refreshRecs = useRecommendationsStore((s) => s.refresh);

  const [cpuMap, setCpuMap] = useState<Map<string, CostPerUse>>(new Map());
  const [seeding, setSeeding] = useState(false);

  const reload = useCallback(async () => {
    await refreshItems();
    await refreshRecs();
    setCpuMap(await getCostPerUseMap(useItemsStore.getState().items));
  }, [refreshItems, refreshRecs]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const spendByCategory = useMemo(() => getSpendByCategory(items), [items]);
  const trend = useMemo(() => getMonthlyTrend(items), [items]);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Worst value first: highest cost-per-use at the top; skip items without enough data.
  const leaderboard = useMemo<LeaderEntry[]>(() => {
    const rows: LeaderEntry[] = [];
    for (const item of items) {
      const cpu = cpuMap.get(item.id);
      if (cpu && cpu.value !== null) rows.push({ item, cpu });
    }
    return rows.sort((a, b) => (b.cpu.value ?? 0) - (a.cpu.value ?? 0));
  }, [items, cpuMap]);

  // Recommendations grouped and ordered by RECOMMENDATION_META order (trial→cancel→duplicate→cycle).
  const orderedRecs = useMemo(
    () =>
      [...recommendations].sort(
        (a, b) => RECOMMENDATION_META[a.type].order - RECOMMENDATION_META[b.type].order,
      ),
    [recommendations],
  );

  const onApply = async (rec: Recommendation) => {
    const action = await applyRecommendation(rec.id);
    switch (action.kind) {
      case 'refresh':
        await reload();
        break;
      case 'open-item':
        router.push(`/item/${action.itemId}`);
        break;
      case 'edit-item':
        router.push({ pathname: '/(modal)/add-item', params: { id: action.itemId } });
        break;
    }
  };

  const onDismiss = async (rec: Recommendation) => {
    await dismissRecommendation(rec.id);
    await refreshRecs();
  };

  const onSeed = async () => {
    setSeeding(true);
    try {
      await seedSampleData();
      await reload();
    } finally {
      setSeeding(false);
    }
  };

  const hasItems = items.length > 0;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <AppText size="xl" weight="bold" accessibilityRole="header">
          Insights
        </AppText>
      </View>

      {!hasItems ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="bar-chart-outline"
            title="No insights yet"
            message="Add items to see your spending breakdown and savings recommendations."
          />
          {__DEV__ ? (
            <View style={styles.devButton}>
              <Button
                label={seeding ? 'Seeding…' : 'Seed sample data'}
                variant="ghost"
                size="sm"
                onPress={onSeed}
                disabled={seeding}
              />
            </View>
          ) : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {spendByCategory.length > 0 ? (
            <Section title="Spend by category">
              <Card>
                <SpendByCategoryChart
                  data={spendByCategory}
                  onSelect={(category: Category) =>
                    router.push({ pathname: '/(tabs)/items', params: { category } })
                  }
                />
              </Card>
            </Section>
          ) : null}

          {leaderboard.length > 0 ? (
            <Section title="Value leaderboard">
              <Card style={styles.listCard}>
                {leaderboard.map((entry, i) => (
                  <LeaderRow
                    key={entry.item.id}
                    entry={entry}
                    last={i === leaderboard.length - 1}
                    onPress={() => router.push(`/item/${entry.item.id}`)}
                  />
                ))}
              </Card>
            </Section>
          ) : null}

          {orderedRecs.length > 0 ? (
            <Section title="Recommendations">
              {orderedRecs.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  itemName={itemsById.get(rec.itemId)?.name ?? 'Item'}
                  onApply={() => onApply(rec)}
                  onDismiss={() => onDismiss(rec)}
                />
              ))}
            </Section>
          ) : null}

          {trend.dataMonths >= 2 ? (
            <Section title="Monthly trend">
              <Card>
                <MonthlyTrendChart data={trend.points} />
                <AppText size="xs" color={theme.colors.text.tertiary} style={styles.trendCaption}>
                  Estimated monthly spend over the last {trend.points.length} months.
                </AppText>
              </Card>
            </Section>
          ) : null}

          {__DEV__ ? (
            <View style={styles.devButton}>
              <Button
                label={seeding ? 'Seeding…' : 'Seed sample data'}
                variant="ghost"
                size="sm"
                onPress={onSeed}
                disabled={seeding}
              />
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <AppText size="sm" weight="semibold" color={theme.colors.text.tertiary}>
        {title.toUpperCase()}
      </AppText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function LeaderRow({
  entry,
  last,
  onPress,
}: {
  entry: LeaderEntry;
  last: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { item, cpu } = entry;
  const label =
    cpu.value !== null ? `${formatCurrency(cpu.value)}${COST_UNIT_SUFFIX[cpu.unit]}` : '—';
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.leaderRow, !last && styles.rowBorder]}
      accessibilityRole="button"
    >
      <View style={styles.iconCircle}>
        <Ionicons name={CATEGORY_ICONS[item.category]} size={18} color={theme.colors.accent} />
      </View>
      <View style={styles.leaderMiddle}>
        <AppText weight="medium" numberOfLines={1}>
          {item.name}
        </AppText>
        <Badge label={item.category} variant="neutral" />
      </View>
      <AppText weight="semibold">{label}</AppText>
    </TouchableOpacity>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  emptyWrap: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.base,
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionBody: {
    gap: theme.spacing.sm,
  },
  listCard: {
    paddingVertical: 0,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderMiddle: {
    flex: 1,
    gap: theme.spacing.xs,
    alignItems: 'flex-start',
  },
  trendCaption: {
    marginTop: theme.spacing.sm,
  },
  devButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
});
