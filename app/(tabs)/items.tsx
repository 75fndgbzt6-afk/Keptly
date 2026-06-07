import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Input, EmptyState, SkeletonList } from '@/components/ui';
import { ItemRow, SummaryRings, useItemContextMenu, RingDatum } from '@/components/items';
import { SelectField } from '@/components/form';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { Item } from '@/types';
import { CATEGORIES } from '@/lib/category';
import { SORT_OPTIONS, SortKey } from '@/lib/options';
import { daysUntil } from '@/lib/date';
import { formatCurrency } from '@/lib/currency';
import { getCostPerUseMap, CostPerUse, getUsageStatsMap, UsageStat } from '@/services/value-engine';
import { getMonthlyTotal, getUpcomingRenewals, getActiveAlerts } from '@/services/dashboard';
import { useItemsStore } from '@/stores/itemsStore';
import { useCategoriesStore } from '@/stores/categoriesStore';
import { usePreferencesStore } from '@/stores/preferencesStore';

type ChipValue = string; // 'all' | category name

const LEVEL_FRACTION: Record<UsageStat['level'], number> = { low: 0.34, mid: 0.67, high: 1 };

/** Round a number up to a soft, friendly budget ceiling. */
function softBudget(monthly: number): number {
  if (monthly <= 0) return 1;
  const step = monthly < 5000 ? 1000 : 5000;
  return Math.ceil((monthly * 1.1) / step) * step;
}

function sortItems(items: Item[], key: SortKey): Item[] {
  const sorted = [...items];
  switch (key) {
    case 'next_date':
      return sorted.sort((a, b) => {
        const da = daysUntil(a.nextDate);
        const db = daysUntil(b.nextDate);
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
    case 'amount':
      return sorted.sort((a, b) => {
        const aa = a.amount ?? -Infinity;
        const ba = b.amount ?? -Infinity;
        return ba - aa;
      });
    case 'name':
      return sorted.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );
  }
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
  const onLongPress = useItemContextMenu();

  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ChipValue>('all');
  const [sort, setSort] = useState<SortKey>('next_date');
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
    const usedFraction = tracked.length > 0 ? usedCount / tracked.length : 0;

    const monthly = getMonthlyTotal(items);
    const budget = monthlyBudget && monthlyBudget > 0 ? monthlyBudget : softBudget(monthly);
    const spendFraction = budget > 0 ? Math.min(1, monthly / budget) : 0;

    const upcoming = getUpcomingRenewals(items, 99).length;
    const handledFraction = upcoming === 0 ? 1 : Math.max(0, (upcoming - overdueCount) / upcoming);

    return [
      { fraction: usedFraction, color: theme.colors.accent, label: 'Used this month', caption: `${usedCount} of ${tracked.length} tracked` },
      { fraction: spendFraction, color: theme.colors.status.good, label: 'Spend vs budget', caption: `${formatCurrency(monthly)} of ${formatCurrency(budget)}` },
      { fraction: handledFraction, color: theme.colors.status.warning, label: 'Renewals handled', caption: overdueCount > 0 ? `${overdueCount} need attention` : 'All on track' },
    ];
  }, [statsMap, items, monthlyBudget, overdueCount, theme]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const matchesChip = chip === 'all' || item.category === chip;
      const matchesQuery = q === '' || item.name.toLowerCase().includes(q);
      return matchesChip && matchesQuery;
    });
    return sortItems(filtered, sort);
  }, [items, query, chip, sort]);

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
                    onPress={() => setChip(c)}
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

            <View style={styles.sortRow}>
              <View style={styles.sortField}>
                <SelectField<SortKey>
                  label="Sort by"
                  value={sort}
                  options={SORT_OPTIONS}
                  onChange={setSort}
                />
              </View>
            </View>
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
              data={visible}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={<SummaryRings rings={rings} />}
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
    </Screen>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
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
