import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Input, EmptyState } from '@/components/ui';
import { ItemRow } from '@/components/items';
import { SelectField } from '@/components/form';
import { theme } from '@/constants/theme';
import { Category, Item } from '@/types';
import { CATEGORIES } from '@/lib/category';
import { SORT_OPTIONS, SortKey } from '@/lib/options';
import { daysUntil } from '@/lib/date';
import { useItemsStore } from '@/stores/itemsStore';

type ChipValue = 'all' | Category;
const CHIPS: ChipValue[] = ['all', ...CATEGORIES];

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
  const router = useRouter();
  const items = useItemsStore((s) => s.items);
  const refresh = useItemsStore((s) => s.refresh);

  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ChipValue>('all');
  const [sort, setSort] = useState<SortKey>('next_date');

  useEffect(() => {
    refresh();
  }, [refresh]);

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

const styles = StyleSheet.create({
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
});
