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
import { Screen, AppText, Input, EmptyState } from '@/components/ui';
import { ItemRow } from '@/components/items';
import { SelectField } from '@/components/form';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { Category, Item } from '@/types';
import { CATEGORIES } from '@/lib/category';
import { SORT_OPTIONS, SortKey } from '@/lib/options';
import { daysUntil } from '@/lib/date';
import { getCostPerUseMap, CostPerUse } from '@/services/value-engine';
import { useItemsStore } from '@/stores/itemsStore';

type ChipValue = 'all' | Category;
const CHIPS: ChipValue[] = ['all', ...CATEGORIES];

function isCategory(value: string | undefined): value is Category {
  return value !== undefined && (CATEGORIES as string[]).includes(value);
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
  const refresh = useItemsStore((s) => s.refresh);

  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ChipValue>('all');
  const [sort, setSort] = useState<SortKey>('next_date');
  const [cpuMap, setCpuMap] = useState<Map<string, CostPerUse>>(new Map());

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Drill-down from the Insights spend-by-category chart preselects a category filter.
  useEffect(() => {
    if (isCategory(params.category)) setChip(params.category);
  }, [params.category]);

  useEffect(() => {
    let active = true;
    getCostPerUseMap(items).then((map) => {
      if (active) setCpuMap(map);
    });
    return () => {
      active = false;
    };
  }, [items]);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

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
        <AppText size="xl" weight="bold">
          My Items
        </AppText>
      </View>

      {hasItems ? (
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
              {CHIPS.map((c) => {
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
              renderItem={({ item }) => (
                <ItemRow
                  item={item}
                  onPress={() => router.push(`/item/${item.id}`)}
                  costPerUse={cpuMap.get(item.id) ?? null}
                />
              )}
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
