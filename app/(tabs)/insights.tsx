import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Card, Badge, Button, EmptyState } from '@/components/ui';
import { RecommendationCard } from '@/components/insights';
import { Donut, AreaChart, StackedAreaChart, ChartModal } from '@/components/charts';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { chartColorAt } from '@/constants/chart-palette';
import { Item, Recommendation } from '@/types';
import { iconForCategory } from '@/lib/category';
import { RECOMMENDATION_META } from '@/lib/recommendations';
import { COST_UNIT_SUFFIX } from '@/lib/usage-models';
import { formatCurrency } from '@/lib/currency';
import { getSpendByCategory, getMonthlyTrend, getCategoryTrend } from '@/services/dashboard';
import { getCostPerUseMap, CostPerUse } from '@/services/value-engine';
import { applyRecommendation, dismissRecommendation } from '@/services/recommendation-engine';
import { narrateRecommendation } from '@/services/ai';
import { seedSampleData } from '@/services/dev-seed';
import { hapticSelection } from '@/lib/haptics';
import { useItemsStore } from '@/stores/itemsStore';
import { useRecommendationsStore } from '@/stores/recommendationsStore';
import { useAiStore } from '@/stores/aiStore';
import { useUiStore } from '@/stores/uiStore';

interface LeaderEntry {
  item: Item;
  cpu: CostPerUse;
}

export default function InsightsScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const navigation = useNavigation();
  const items = useItemsStore((s) => s.items);
  const refreshItems = useItemsStore((s) => s.refresh);
  const recommendations = useRecommendationsStore((s) => s.recommendations);
  const refreshRecs = useRecommendationsStore((s) => s.refresh);

  const aiEnabled = useAiStore((s) => s.enabled);
  const [cpuMap, setCpuMap] = useState<Map<string, CostPerUse>>(new Map());
  const [seeding, setSeeding] = useState(false);
  const [narrations, setNarrations] = useState<Record<string, string>>({});
  const [selectedDonutSlice, setSelectedDonutSlice] = useState<number | null>(null);
  const [selectedStackSeries, setSelectedStackSeries] = useState<number | null>(null);
  const [trendModalOpen, setTrendModalOpen] = useState(false);
  const [stackModalOpen, setStackModalOpen] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  // Lock the page scroll AND the global tab-swipe while a chart is being scrubbed.
  const beginChart = useCallback(() => {
    setScrollEnabled(false);
    useUiStore.getState().beginInteraction();
  }, []);
  const endChart = useCallback(() => {
    setScrollEnabled(true);
    useUiStore.getState().endInteraction();
  }, []);

  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);

  useEffect(() => {
    return navigation.addListener('tabPress' as never, () => {
      if (!navigation.isFocused()) return;
      if (scrollYRef.current > 8) {
        hapticSelection();
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    });
  }, [navigation]);

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
  const categoryTrend = useMemo(() => getCategoryTrend(items), [items]);

  const monthlyTotal = useMemo(
    () => spendByCategory.reduce((s, c) => s + c.monthlyAmount, 0),
    [spendByCategory],
  );
  const donutData = useMemo(() => {
    const withColor = spendByCategory.map((c, i) => ({ ...c, color: chartColorAt(i) }));
    const total = withColor.reduce((s, c) => s + c.monthlyAmount, 0);
    // Drop categories below 1 % of total spend — they'd render as near-invisible
    // arcs that produce SVG artefacts and confuse the hit test.
    return total > 0 ? withColor.filter((c) => c.monthlyAmount / total >= 0.01) : withColor;
  }, [spendByCategory]);
  const stackSeries = useMemo(
    () => categoryTrend.series.map((s, i) => ({ color: chartColorAt(i), values: s.values })),
    [categoryTrend],
  );

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

  // When AI is on, auto-narrate only the top 3 recommendations to preserve quota.
  // The rest show deterministic copy and can be narrated on demand in the future.
  // Falls back silently when off / failed / quota-exhausted.
  const AUTO_NARRATE_LIMIT = 3;
  useEffect(() => {
    if (!aiEnabled || orderedRecs.length === 0) return;
    let active = true;
    (async () => {
      let fetched = 0;
      for (const rec of orderedRecs) {
        if (fetched >= AUTO_NARRATE_LIMIT) break;
        if (narrations[rec.id]) { fetched++; continue; }
        try {
          const text = await narrateRecommendation(rec);
          if (active) setNarrations((prev) => ({ ...prev, [rec.id]: text }));
          fetched++;
        } catch {
          // keep deterministic reason; don't count towards limit
        }
      }
    })();
    return () => {
      active = false;
    };
    // narrations intentionally omitted to avoid a refetch loop
  }, [aiEnabled, orderedRecs]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <ScrollView
          ref={scrollRef}
          scrollEnabled={scrollEnabled}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={100}
        >
          {donutData.length > 0 ? (
            <Section title="Spend by category">
              <Card style={styles.donutCard}>
                <Donut
                  data={donutData.map((d) => ({ value: d.monthlyAmount, color: d.color }))}
                  size={148}
                  thickness={20}
                  selectedIndex={selectedDonutSlice}
                  onSelect={setSelectedDonutSlice}
                  onInteractionStart={beginChart}
                  onInteractionEnd={endChart}
                >
                  {selectedDonutSlice != null && donutData[selectedDonutSlice] ? (
                    <>
                      <AppText size="xs" color={theme.colors.text.tertiary} numberOfLines={1} align="center">
                        {donutData[selectedDonutSlice].category}
                      </AppText>
                      <AppText size="md" weight="bold">
                        {formatCurrency(donutData[selectedDonutSlice].monthlyAmount)}
                      </AppText>
                      <AppText size="xs" color={theme.colors.text.tertiary}>
                        {monthlyTotal > 0
                          ? Math.round((donutData[selectedDonutSlice].monthlyAmount / monthlyTotal) * 100)
                          : 0}%
                      </AppText>
                    </>
                  ) : (
                    <>
                      <AppText size="xs" color={theme.colors.text.tertiary}>
                        Monthly
                      </AppText>
                      <AppText size="md" weight="bold">
                        {formatCurrency(monthlyTotal)}
                      </AppText>
                    </>
                  )}
                </Donut>
                <View style={styles.legend}>
                  {donutData.map((d, i) => (
                    <TouchableOpacity
                      key={d.category}
                      activeOpacity={0.7}
                      style={[styles.legendRow, selectedDonutSlice != null && selectedDonutSlice !== i && styles.legendDim]}
                      onPress={() => setSelectedDonutSlice(selectedDonutSlice === i ? null : i)}
                      accessibilityRole="button"
                      accessibilityLabel={`${d.category}, ${formatCurrency(d.monthlyAmount)} per month`}
                    >
                      <View style={[styles.dot, { backgroundColor: d.color }]} />
                      <AppText size="sm" style={styles.legendName} numberOfLines={1}>
                        {d.category}
                      </AppText>
                      <AppText size="sm" weight="medium">
                        {formatCurrency(d.monthlyAmount)}
                      </AppText>
                      <AppText size="xs" color={theme.colors.text.tertiary} style={styles.legendPct}>
                        {monthlyTotal > 0 ? Math.round((d.monthlyAmount / monthlyTotal) * 100) : 0}%
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </View>
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
                  narration={narrations[rec.id] ?? null}
                />
              ))}
            </Section>
          ) : null}

          {trend.dataMonths >= 2 ? (
            <Section
              title="Monthly trend"
              action={
                <TouchableOpacity
                  onPress={() => setTrendModalOpen(true)}
                  style={styles.expandBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Expand chart"
                  hitSlop={8}
                >
                  <Ionicons name="expand-outline" size={16} color={theme.colors.text.tertiary} />
                </TouchableOpacity>
              }
            >
              <Card>
                <AreaChart
                  data={trend.points}
                  color={theme.colors.accent}
                  labels={categoryTrend.labels}
                  onInteractionStart={beginChart}
                  onInteractionEnd={endChart}
                />
                <AppText size="xs" color={theme.colors.text.tertiary} style={styles.trendCaption}>
                  Estimated monthly spend over the last {trend.points.length} months.
                </AppText>
              </Card>
            </Section>
          ) : null}

          {trend.dataMonths >= 2 && stackSeries.length > 0 ? (
            <Section
              title="Spend mix (6 months)"
              action={
                <TouchableOpacity
                  onPress={() => setStackModalOpen(true)}
                  style={styles.expandBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Expand chart"
                  hitSlop={8}
                >
                  <Ionicons name="expand-outline" size={16} color={theme.colors.text.tertiary} />
                </TouchableOpacity>
              }
            >
              <Card>
                <StackedAreaChart
                  series={stackSeries}
                  seriesLabels={categoryTrend.series.map((s) => s.category)}
                  labels={categoryTrend.labels}
                  selectedSeries={selectedStackSeries}
                  onSelectSeries={setSelectedStackSeries}
                  onInteractionStart={beginChart}
                  onInteractionEnd={endChart}
                />
                <View style={styles.stackLegend}>
                  {categoryTrend.series.map((s, i) => (
                    <TouchableOpacity
                      key={s.category}
                      style={[
                        styles.stackLegendItem,
                        selectedStackSeries !== null && selectedStackSeries !== i && styles.legendDim,
                      ]}
                      onPress={() => setSelectedStackSeries(selectedStackSeries === i ? null : i)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                    >
                      <View style={[styles.dot, { backgroundColor: chartColorAt(i) }]} />
                      <AppText size="xs" color={theme.colors.text.secondary} numberOfLines={1}>
                        {s.category}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            </Section>
          ) : null}

          {/* Monthly trend full-screen modal */}
          <ChartModal
            visible={trendModalOpen}
            title="Monthly trend"
            onClose={() => setTrendModalOpen(false)}
          >
            <AreaChart
              data={trend.points}
              color={theme.colors.accent}
              height={200}
              labels={categoryTrend.labels}
            />
          </ChartModal>

          {/* Spend mix full-screen modal */}
          <ChartModal
            visible={stackModalOpen}
            title="Spend mix"
            onClose={() => setStackModalOpen(false)}
          >
            <StackedAreaChart
              series={stackSeries}
              seriesLabels={categoryTrend.series.map((s) => s.category)}
              labels={categoryTrend.labels}
              height={200}
              selectedSeries={selectedStackSeries}
              onSelectSeries={setSelectedStackSeries}
            />
            <View style={styles.stackLegend}>
              {categoryTrend.series.map((s, i) => (
                <TouchableOpacity
                  key={s.category}
                  style={[
                    styles.stackLegendItem,
                    selectedStackSeries !== null && selectedStackSeries !== i && styles.legendDim,
                  ]}
                  onPress={() => setSelectedStackSeries(selectedStackSeries === i ? null : i)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <View style={[styles.dot, { backgroundColor: chartColorAt(i) }]} />
                  <AppText size="xs" color={theme.colors.text.secondary} numberOfLines={1}>
                    {s.category}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
          </ChartModal>

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

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText size="sm" weight="semibold" color={theme.colors.text.tertiary}>
          {title.toUpperCase()}
        </AppText>
        {action ?? null}
      </View>
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
        <Ionicons name={iconForCategory(item.category)} size={18} color={theme.colors.accent} />
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionBody: {
    gap: theme.spacing.sm,
  },
  expandBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    paddingVertical: 0,
  },
  donutCard: {
    alignItems: 'center',
    gap: theme.spacing.base,
  },
  legend: {
    alignSelf: 'stretch',
    gap: theme.spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  legendName: {
    flex: 1,
  },
  legendDim: {
    opacity: 0.35,
  },
  legendPct: {
    width: 40,
    textAlign: 'right',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stackLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  stackLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: theme.radius.sm,
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
