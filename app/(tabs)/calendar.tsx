import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, AppText, Card, EmptyState } from '@/components/ui';
import { MonthCalendar, EventDot } from '@/components/calendar/MonthCalendar';
import { Theme } from '@/constants/theme';
import { useThemedStyles, useTheme } from '@/components/theme';
import { Item } from '@/types';
import { iconForCategory } from '@/lib/category';
import { formatCurrency } from '@/lib/currency';
import { formatDate, todayISO } from '@/lib/date';
import { urgencyColor, urgencyForDate } from '@/lib/urgency';
import { hapticSelection } from '@/lib/haptics';
import { useItemContextMenu } from '@/components/items';
import { useItemsStore } from '@/stores/itemsStore';

interface DayEvent {
  item: Item;
  label: string;
  /** ISO date of this specific event (renewal / trial / expiry / bill) */
  date: string;
}

/** Collect the calendar-relevant date for each item (renewal / trial / expiry / bill). */
function buildEvents(items: Item[]): Map<string, DayEvent[]> {
  const map = new Map<string, DayEvent[]>();
  const add = (date: string | null | undefined, item: Item, label: string) => {
    if (!date) return;
    const list = map.get(date) ?? [];
    list.push({ item, label, date });
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
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const navigation = useNavigation();
  const items = useItemsStore((s) => s.items);
  const refresh = useItemsStore((s) => s.refresh);
  const onLongPress = useItemContextMenu();
  const [selected, setSelected] = useState<string>(todayISO());

  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    return navigation.addListener('tabPress' as never, () => {
      if (!navigation.isFocused()) return;
      const today = todayISO();
      const scrolled = scrollYRef.current > 8;
      const notToday = selectedRef.current !== today;
      if (scrolled || notToday) hapticSelection();
      if (scrolled) scrollRef.current?.scrollTo({ y: 0, animated: true });
      if (notToday) setSelected(today);
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const events = useMemo(() => buildEvents(items), [items]);

  // MonthCalendar needs EventDot maps (just the date for urgency coloring)
  const dotEvents = useMemo<Map<string, EventDot[]>>(() => {
    const m = new Map<string, EventDot[]>();
    for (const [date, dayEvs] of events) {
      m.set(date, dayEvs.map((ev) => ({ date: ev.date })));
    }
    return m;
  }, [events]);

  const dayEvents = events.get(selected) ?? [];
  const hasItems = items.length > 0;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <AppText size="xl" weight="bold" accessibilityRole="header">
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
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={100}
        >
          <Card padded={false} style={styles.calendarCard}>
            <MonthCalendar
              events={dotEvents}
              selected={selected}
              onSelectDay={setSelected}
            />
          </Card>

          {/* ── Day detail ──────────────────────────────────────────────── */}
          <View style={styles.dayHeader}>
            <AppText weight="semibold">{formatDate(selected)}</AppText>
            <AppText size="sm" color={theme.colors.text.tertiary}>
              {dayEvents.length === 0
                ? 'Nothing due'
                : `${dayEvents.length} ${dayEvents.length === 1 ? 'item' : 'items'}`}
            </AppText>
          </View>

          {dayEvents.length === 0 ? (
            <View style={styles.emptyDay}>
              <AppText size="sm" color={theme.colors.text.tertiary}>
                No renewals, bills, or expiries on this day.
              </AppText>
            </View>
          ) : null}

          {dayEvents.map((ev, i) => {
            const level = urgencyForDate(ev.date);
            const dotColor = urgencyColor(level, theme.colors);
            return (
              <Card
                key={`${ev.item.id}-${ev.label}-${i}`}
                onPress={() => router.push(`/item/${ev.item.id}`)}
                onLongPress={() => onLongPress(ev.item)}
                style={styles.eventRow}
              >
                <View style={[styles.urgencyBar, { backgroundColor: dotColor }]} />
                <View style={styles.iconCircle}>
                  <Ionicons name={iconForCategory(ev.item.category)} size={18} color={theme.colors.accent} />
                </View>
                <View style={styles.eventText}>
                  <AppText weight="medium" numberOfLines={1}>
                    {ev.item.name}
                  </AppText>
                  <AppText size="xs" color={theme.colors.text.tertiary}>
                    {ev.label}
                  </AppText>
                </View>
                <AppText weight="medium">{formatCurrency(ev.item.amount)}</AppText>
              </Card>
            );
          })}
        </ScrollView>
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
    marginTop: theme.spacing.xs,
  },
  emptyDay: {
    paddingVertical: theme.spacing.md,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.base,
    overflow: 'hidden',
  },
  urgencyBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 3,
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
