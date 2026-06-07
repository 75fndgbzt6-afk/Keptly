import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Card, EmptyState } from '@/components/ui';
import { theme } from '@/constants/theme';
import { Item } from '@/types';
import { CATEGORY_ICONS } from '@/lib/category';
import { formatCurrency } from '@/lib/currency';
import { formatDate, todayISO } from '@/lib/date';
import { urgencyColor, urgencyForDate } from '@/lib/urgency';
import { useItemsStore } from '@/stores/itemsStore';

interface DayEvent {
  item: Item;
  label: string;
}

/** Collect the calendar-relevant date for each item (renewal / trial / expiry / bill). */
function buildEvents(items: Item[]): Map<string, DayEvent[]> {
  const map = new Map<string, DayEvent[]>();
  const add = (date: string | null | undefined, item: Item, label: string) => {
    if (!date) return;
    const list = map.get(date) ?? [];
    list.push({ item, label });
    map.set(date, list);
  };

  for (const item of items) {
    if (item.status === 'cancelled' || item.status === 'expired') continue;
    add(item.nextDate, item, 'Renewal');
    if (item.isFreeTrial) add(item.trialEndDate, item, 'Trial ends');
    if (item.details.kind === 'document') add(item.details.expiryDate, item, 'Expires');
    if (item.details.kind === 'utility') add(item.details.dueDate, item, 'Bill due');
  }
  return map;
}

export default function CalendarScreen() {
  const router = useRouter();
  const items = useItemsStore((s) => s.items);
  const refresh = useItemsStore((s) => s.refresh);
  const [selected, setSelected] = useState<string>(todayISO());

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const events = useMemo(() => buildEvents(items), [items]);

  const markedDates = useMemo(() => {
    const marks: Record<string, { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string }> = {};
    for (const date of events.keys()) {
      marks[date] = { marked: true, dotColor: urgencyColor(urgencyForDate(date)) };
    }
    marks[selected] = {
      ...(marks[selected] ?? {}),
      selected: true,
      selectedColor: theme.colors.accent,
    };
    return marks;
  }, [events, selected]);

  const dayEvents = events.get(selected) ?? [];
  const hasItems = items.length > 0;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <AppText size="xl" weight="bold">
          Calendar
        </AppText>
      </View>

      {!hasItems ? (
        <EmptyState
          icon="calendar-outline"
          title="Nothing scheduled"
          message="Upcoming renewals, due dates, and expiries will appear here."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.calendarCard} padded={false}>
            <Calendar
              current={selected}
              onDayPress={(day: DateData) => setSelected(day.dateString)}
              markedDates={markedDates}
              theme={{
                todayTextColor: theme.colors.accent,
                arrowColor: theme.colors.accent,
                selectedDayBackgroundColor: theme.colors.accent,
                selectedDayTextColor: theme.colors.text.inverse,
                textDayFontFamily: 'Inter_400Regular',
                textMonthFontFamily: 'Inter_600SemiBold',
                textDayHeaderFontFamily: 'Inter_500Medium',
                monthTextColor: theme.colors.text.primary,
                dayTextColor: theme.colors.text.primary,
                textDisabledColor: theme.colors.text.tertiary,
              }}
            />
          </Card>

          <View style={styles.dayHeader}>
            <AppText weight="semibold">{formatDate(selected)}</AppText>
            <AppText size="sm" color={theme.colors.text.tertiary}>
              {dayEvents.length === 0
                ? 'Nothing due'
                : `${dayEvents.length} ${dayEvents.length === 1 ? 'item' : 'items'}`}
            </AppText>
          </View>

          {dayEvents.map((ev, i) => (
            <Card
              key={`${ev.item.id}-${ev.label}-${i}`}
              onPress={() => router.push(`/item/${ev.item.id}`)}
              style={styles.eventRow}
            >
              <View style={styles.iconCircle}>
                <Ionicons name={CATEGORY_ICONS[ev.item.category]} size={18} color={theme.colors.accent} />
              </View>
              <View style={styles.eventText}>
                <AppText weight="medium" numberOfLines={1}>
                  {ev.item.name}
                </AppText>
                <AppText size="xs" color={theme.colors.text.tertiary}>
                  {ev.label}
                </AppText>
              </View>
              <AppText weight="medium">{formatCurrency(ev.item.amount, ev.item.currency)}</AppText>
            </Card>
          ))}
        </ScrollView>
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
  content: {
    padding: theme.spacing.base,
    gap: theme.spacing.md,
  },
  calendarCard: {
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventText: {
    flex: 1,
    gap: 2,
  },
});
