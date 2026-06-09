import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { hapticSelection } from '@/lib/haptics';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Card, Input, EmptyState, SkeletonList, Button } from '@/components/ui';
import { ItemRow, SummaryRings, useItemContextMenu, RingDatum } from '@/components/items';
import { ActivityRings, ChartModal, Donut } from '@/components/charts';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { RING_COLORS, chartColorAt } from '@/constants/chart-palette';
import { Item } from '@/types';
import { CATEGORIES } from '@/lib/category';
import { daysUntil } from '@/lib/date';
import { formatCurrency } from '@/lib/currency';
import { getCostPerUseMap, CostPerUse, getUsageStatsMap, UsageStat } from '@/services/value-engine';
import { getMonthlyTotal, getUpcomingRenewals, getActiveAlerts } from '@/services/dashboard';
import { useItemsStore } from '@/stores/itemsStore';
import { useCategoriesStore } from '@/stores/categoriesStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useUiStore } from '@/stores/uiStore';

type ChipValue = string; // 'all' | category name

const LEVEL_FRACTION: Record<UsageStat['level'], number> = { low: 0.34, mid: 0.67, high: 1 };

/** Round a number up to a soft, friendly budget ceiling. */
function softBudget(monthly: number): number {
  if (monthly <= 0) return 1;
  const step = monthly < 5000 ? 1000 : 5000;
  return Math.ceil((monthly * 1.1) / step) * step;
}

/** Default ordering: soonest due first (no user-facing sort control). */
function sortByNextDate(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const da = daysUntil(a.nextDate);
    const db = daysUntil(b.nextDate);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
}

export default function ItemsScreen() {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const items = useItemsStore((s) => s.items);
  const loaded = useItemsStore((s) => s.loaded);
  const refresh = useItemsStore((s) => s.refresh);
  const customCategories = useCategoriesStore((s) => s.custom);
  const refreshCategories = useCategoriesStore((s) => s.refresh);
  const monthlyBudget = usePreferencesStore((s) => s.monthlyBudget);
  const usageGoalPct = usePreferencesStore((s) => s.usageGoalPct);
  const updatePrefs = usePreferencesStore((s) => s.update);
  const onLongPress = useItemContextMenu();
  const [ringsOpen, setRingsOpen] = useState(false);
  const [listScrollEnabled, setListScrollEnabled] = useState(true);
  const listRef = useRef<FlatList>(null);
  const scrollYRef = useRef(0);
  const chipRef = useRef<ChipValue>('all');
  const navigation = useNavigation();

  // Tab-press: scroll-to-top first; if already at top reset to "All".
  useEffect(() => {
    return navigation.addListener('tabPress' as never, () => {
      if (!navigation.isFocused()) return;
      if (scrollYRef.current > 8) {
        hapticSelection();
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      } else if (chipRef.current !== 'all') {
        hapticSelection();
        setChip('all');
      }
    });
  }, [navigation]);

  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ChipValue>('all');
  chipRef.current = chip; // keep ref in sync every render
  const [cpuMap, setCpuMap] = useState<Map<string, CostPerUse>>(new Map());
  const [statsMap, setStatsMap] = useState<Map<string, UsageStat>>(new Map());
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    refresh();
    refreshCategories();
  }, [refresh, refreshCategories]);

  // Drill-down from the Insights spend-by-category chart preselects a category filter.
  useEffect(() => {
    if (params.category) setChip(params.category);
  }, [params.category]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [cpu, stats, alerts] = await Promise.all([
        getCostPerUseMap(items),
        getUsageStatsMap(items),
        getActiveAlerts(items, 99),
      ]);
      if (!active) return;
      setCpuMap(cpu);
      setStatsMap(stats);
      setOverdueCount(alerts.length);
    })();
    return () => {
      active = false;
    };
  }, [items]);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const chips = useMemo<ChipValue[]>(
    () => ['all', ...CATEGORIES, ...customCategories],
    [customCategories],
  );

  const rings = useMemo<RingDatum[]>(() => {
    const tracked = [...statsMap.values()];
    const usedCount = tracked.filter((s) => s.logCount > 0).length;
    const usedShare = tracked.length > 0 ? usedCount / tracked.length : 0;
    const goal = usageGoalPct > 0 ? usageGoalPct / 100 : 1;
    const usedFraction = Math.min(1, goal > 0 ? usedShare / goal : usedShare);

    const monthly = getMonthlyTotal(items);
    const budget = monthlyBudget && monthlyBudget > 0 ? monthlyBudget : softBudget(monthly);
    const spendFraction = budget > 0 ? Math.min(1, monthly / budget) : 0;

    const upcoming = getUpcomingRenewals(items, 99).length;
    const handledFraction = upcoming === 0 ? 1 : Math.max(0, (upcoming - overdueCount) / upcoming);

    return [
      { fraction: spendFraction, color: RING_COLORS.red, icon: 'wallet-outline', label: 'Spend vs budget', caption: `${formatCurrency(monthly)} of ${formatCurrency(budget)}` },
      { fraction: usedFraction, color: RING_COLORS.green, icon: 'pulse-outline', label: 'Used this month', caption: `${usedCount} of ${tracked.length} tracked` },
      { fraction: handledFraction, color: RING_COLORS.blue, icon: 'refresh-outline', label: 'Renewals handled', caption: overdueCount > 0 ? `${overdueCount} need attention` : 'All on track' },
    ];
  }, [statsMap, items, monthlyBudget, usageGoalPct, overdueCount]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const matchesChip = chip === 'all' || item.category === chip;
      const matchesQuery = q === '' || item.name.toLowerCase().includes(q);
      return matchesChip && matchesQuery;
    });
    return sortByNextDate(filtered);
  }, [items, query, chip]);

  const hasItems = items.length > 0;
  const noResults = hasItems && visible.length === 0;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <AppText size="xl" weight="bold" accessibilityRole="header">
          My Items
        </AppText>
      </View>

      {!loaded ? (
        <SkeletonList count={6} />
      ) : hasItems ? (
        <>
          <View style={styles.controls}>
            <Input
              placeholder="Search items"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              rightElement={
                <Ionicons
                  name="search"
                  size={18}
                  color={theme.colors.text.tertiary}
                />
              }
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {chips.map((c) => {
                const active = c === chip;
                const label = c === 'all' ? 'All' : c;
                return (
                  <TouchableOpacity
                    key={c}
                    activeOpacity={0.7}
                    onPress={() => { hapticSelection(); setChip(c); }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <AppText
                      size="sm"
                      weight={active ? 'semibold' : 'regular'}
                      color={active ? theme.colors.text.inverse : theme.colors.text.secondary}
                    >
                      {label}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {chip === 'Government document' ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/vault')}
              style={styles.vaultBanner}
              accessibilityRole="button"
            >
              <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.accent} />
              <AppText size="sm" color={theme.colors.accent} weight="medium" style={styles.vaultBannerText}>
                These items also live in the secured Vault
              </AppText>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.accent} />
            </TouchableOpacity>
          ) : null}

          {noResults ? (
            <EmptyState
              icon="search-outline"
              title="No matches"
              message="Try a different search or category filter."
            />
          ) : (
            <FlatList
              ref={listRef}
              data={visible}
              keyExtractor={(item) => item.id}
              scrollEnabled={listScrollEnabled}
              onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={100}
              ListHeaderComponent={
                chip === 'all'
                  ? <SummaryRings rings={rings} onExpand={() => setRingsOpen(true)} />
                  : <CategoryHeader
                      items={visible}
                      category={chip}
                      onInteractionStart={() => { setListScrollEnabled(false); useUiStore.getState().beginInteraction(); }}
                      onInteractionEnd={() => { setListScrollEnabled(true); useUiStore.getState().endInteraction(); }}
                    />
              }
              renderItem={({ item }) => {
                const stat = statsMap.get(item.id);
                return (
                  <ItemRow
                    item={item}
                    onPress={() => router.push(`/item/${item.id}`)}
                    onLongPress={() => onLongPress(item)}
                    costPerUse={cpuMap.get(item.id) ?? null}
                    utilization={stat ? LEVEL_FRACTION[stat.level] : null}
                  />
                );
              }}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      ) : (
        <EmptyState
          icon="list-outline"
          title="No items yet"
          message="Your subscriptions, bills, warranties, and documents will appear here."
          action={{
            label: 'Add an item',
            onPress: () => router.push('/(modal)/add-item'),
          }}
        />
      )}

      <ChartModal visible={ringsOpen} title="Your month at a glance" onClose={() => setRingsOpen(false)}>
        <View style={styles.modalRings}>
          <ActivityRings size={200} thickness={18} gap={6} rings={rings.map((r) => ({ fraction: r.fraction, color: r.color }))} />
        </View>
        <View style={styles.modalLegend}>
          {rings.map((r) => (
            <View key={r.label} style={styles.modalLegendRow}>
              <View style={[styles.iconChip, { backgroundColor: r.color }]}>
                <Ionicons name={r.icon} size={13} color={theme.colors.text.inverse} />
              </View>
              <View style={styles.flex1}>
                <AppText size="sm" weight="medium">
                  {r.label}
                </AppText>
                <AppText size="xs" color={theme.colors.text.tertiary}>
                  {r.caption}
                </AppText>
              </View>
              <AppText size="sm" weight="semibold">
                {Math.round(r.fraction * 100)}%
              </AppText>
            </View>
          ))}
        </View>
        <Button label="Done" variant="secondary" onPress={() => setRingsOpen(false)} fullWidth />
      </ChartModal>
    </Screen>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  modalRings: {
    alignItems: 'center',
  },
  modalLegend: {
    gap: theme.spacing.sm,
  },
  modalLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex1: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  controls: {
    paddingHorizontal: theme.spacing.base,
    gap: theme.spacing.md,
  },
  chipRow: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
  },
  chipActive: {
    backgroundColor: theme.colors.accent,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sortField: {
    minWidth: 160,
  },
  listContent: {
    padding: theme.spacing.base,
    gap: theme.spacing.sm,
  },
  vaultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.base,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentLight,
  },
  vaultBannerText: {
    flex: 1,
  },
});

// ─── Category spend header (shown instead of SummaryRings when a chip is active) ─

function CategoryHeader({
  items,
  category,
  onInteractionStart,
  onInteractionEnd,
}: {
  items: Item[];
  category: string;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeCatStyles);
  const [selectedSlice, setSelectedSlice] = useState<number | null>(null);

  const slices = useMemo(
    () => items.map((item, i) => ({
      value: item.amount && item.billingCycle
        ? item.billingCycle === 'monthly' ? item.amount
          : item.billingCycle === 'yearly' ? item.amount / 12
          : item.billingCycle === 'weekly' ? item.amount * 4.33
          : item.amount
        : 0,
      color: chartColorAt(i),
      name: item.name,
    })),
    [items],
  );
  const total = slices.reduce((s, d) => s + d.value, 0);
  const donutData = slices.map((s) => ({ value: s.value, color: s.color }));

  return (
    <Card style={styles.card}>
      <View style={styles.donutWrap}>
        <Donut
          data={donutData}
          size={100}
          thickness={13}
          selectedIndex={selectedSlice}
          onSelect={setSelectedSlice}
          onInteractionStart={onInteractionStart}
          onInteractionEnd={onInteractionEnd}
        >
          {selectedSlice != null && slices[selectedSlice] ? (
            <>
              <AppText size="xs" color={theme.colors.text.tertiary} numberOfLines={1} align="center">
                {slices[selectedSlice].name}
              </AppText>
              <AppText size="sm" weight="bold" numberOfLines={1}>
                {formatCurrency(slices[selectedSlice].value)}
              </AppText>
            </>
          ) : (
            <>
              <AppText size="xs" color={theme.colors.text.tertiary}>
                /mo
              </AppText>
              <AppText size="sm" weight="bold">
                {formatCurrency(total)}
              </AppText>
            </>
          )}
        </Donut>
      </View>
      <View style={styles.legend}>
        {slices.map((s, i) => (
          <TouchableOpacity
            key={s.name}
            activeOpacity={0.7}
            style={[styles.legendRow, selectedSlice != null && selectedSlice !== i && styles.dim]}
            onPress={() => setSelectedSlice(selectedSlice === i ? null : i)}
            accessibilityRole="button"
          >
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <AppText size="xs" style={styles.flex1} numberOfLines={1}>
              {s.name}
            </AppText>
            <AppText size="xs" weight="medium">
              {formatCurrency(s.value)}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );
}

const makeCatStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.base,
    },
    donutWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    legend: {
      flex: 1,
      gap: 6,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    flex1: {
      flex: 1,
    },
    dim: {
      opacity: 0.4,
    },
  });
