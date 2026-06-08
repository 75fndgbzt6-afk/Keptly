import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { AppText } from '@/components/ui';
import { toISODate, todayISO } from '@/lib/date';
import { urgencyColor, urgencyForDate, UrgencyLevel } from '@/lib/urgency';

// ─── constants ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
// Monday-first
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const MAX_DOTS = 3;
const DOT_SIZE = 6;
const CELL_HEIGHT = 52; // enough for number + dots + breathing room (≥44 tap target)

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Days in a given month (0-indexed). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Monday-first day-of-week index for the 1st of the month (0 = Mon … 6 = Sun). */
function firstDayOffset(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function isoFor(year: number, month: number, day: number): string {
  return toISODate(new Date(year, month, day));
}

// ─── types ───────────────────────────────────────────────────────────────────

export interface EventDot {
  /** ISO yyyy-mm-dd — used to compute urgency color */
  date: string;
}

interface MonthCalendarProps {
  /** Map from ISO date string to array of events on that day */
  events: Map<string, EventDot[]>;
  selected: string;
  onSelectDay: (date: string) => void;
}

// ─── DayCell ─────────────────────────────────────────────────────────────────

function DayCell({
  day,
  dateStr,
  isToday,
  isSelected,
  dots,
  onPress,
}: {
  day: number;
  dateStr: string;
  isToday: boolean;
  isSelected: boolean;
  dots: string[]; // urgency colors, max MAX_DOTS + overflow
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useThemedStyles(makeCellStyles);
  const filled = isSelected;
  const ring = isToday && !isSelected;
  const overflow = Math.max(0, dots.length - MAX_DOTS);
  const visibleDots = dots.slice(0, MAX_DOTS);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.cell}
      accessibilityRole="button"
      accessibilityLabel={`${day}, ${dots.length > 0 ? `${dots.length} events` : 'no events'}`}
      accessibilityState={{ selected: isSelected }}
    >
      <View style={[
        styles.bubble,
        filled && styles.bubbleFilled,
        ring && styles.bubbleRing,
      ]}>
        <AppText
          size="sm"
          weight={isToday || isSelected ? 'semibold' : 'regular'}
          color={
            filled
              ? theme.colors.text.inverse
              : isToday
              ? theme.colors.accent
              : theme.colors.text.primary
          }
          align="center"
        >
          {String(day)}
        </AppText>
      </View>

      <View style={styles.dotsRow}>
        {visibleDots.map((color, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: color }]} />
        ))}
        {overflow > 0 ? (
          <AppText size="xs" color={theme.colors.text.tertiary} style={styles.overflow}>
            +{overflow}
          </AppText>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const makeCellStyles = (theme: Theme) =>
  StyleSheet.create({
    cell: {
      width: `${100 / 7}%`,
      height: CELL_HEIGHT,
      alignItems: 'center',
      paddingTop: theme.spacing.xs,
    },
    bubble: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bubbleFilled: {
      backgroundColor: theme.colors.accent,
    },
    bubbleRing: {
      borderWidth: 1.5,
      borderColor: theme.colors.accent,
    },
    dotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginTop: 3,
      height: DOT_SIZE + 2,
    },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
    },
    overflow: {
      fontSize: 9,
      lineHeight: DOT_SIZE + 2,
    },
  });

// ─── MonthCalendar ────────────────────────────────────────────────────────────

export function MonthCalendar({ events, selected, onSelectDay }: MonthCalendarProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const today = todayISO();

  // Parse selected to init month display
  const [year, setYear] = useState(() => parseInt(selected.slice(0, 4), 10));
  const [month, setMonth] = useState(() => parseInt(selected.slice(5, 7), 10) - 1);

  function goToPrev() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function goToNext() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }
  function goToToday() {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    onSelectDay(today);
  }

  const isCurrentMonth =
    year === new Date().getFullYear() && month === new Date().getMonth();

  // Build grid: leading empty cells + days + trailing empty cells to fill 6 rows
  const offset = firstDayOffset(year, month);
  const total = daysInMonth(year, month);
  const cells: Array<number | null> = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  // Pad to multiple of 7
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={styles.container}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={goToPrev}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={styles.chevron}
          >
            <AppText size="lg" color={theme.colors.text.secondary}>‹</AppText>
          </TouchableOpacity>
          <AppText size="md" weight="semibold">
            {MONTH_NAMES[month]} {year}
          </AppText>
          <TouchableOpacity
            onPress={goToNext}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={styles.chevron}
          >
            <AppText size="lg" color={theme.colors.text.secondary}>›</AppText>
          </TouchableOpacity>
        </View>

        {!isCurrentMonth ? (
          <TouchableOpacity
            onPress={goToToday}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go to today"
            style={styles.todayBtn}
          >
            <AppText size="sm" weight="medium" color={theme.colors.accent}>
              Today
            </AppText>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ── Weekday labels ─────────────────────────────────────────────── */}
      <View style={styles.weekRow}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={styles.weekCell}>
            <AppText
              size="xs"
              weight="medium"
              color={theme.colors.text.tertiary}
              align="center"
            >
              {label}
            </AppText>
          </View>
        ))}
      </View>

      {/* ── Day grid ───────────────────────────────────────────────────── */}
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) {
            return <View key={`empty-${i}`} style={styles.emptyCell} />;
          }
          const dateStr = isoFor(year, month, day);
          const dayEvents = events.get(dateStr) ?? [];

          // Sort dots by urgency severity: danger → warning → good
          const urgencyOrder: Record<UrgencyLevel, number> = { danger: 0, warning: 1, good: 2, none: 3 };
          const sortedEvents = [...dayEvents].sort(
            (a, b) =>
              urgencyOrder[urgencyForDate(a.date)] - urgencyOrder[urgencyForDate(b.date)],
          );
          const dots = sortedEvents.map((e) => urgencyColor(urgencyForDate(e.date), theme.colors));

          return (
            <DayCell
              key={dateStr}
              day={day}
              dateStr={dateStr}
              isToday={dateStr === today}
              isSelected={dateStr === selected}
              dots={dots}
              onPress={() => onSelectDay(dateStr)}
            />
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.md,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    chevron: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    todayBtn: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.accentLight,
    },
    weekRow: {
      flexDirection: 'row',
      marginBottom: theme.spacing.xs,
    },
    weekCell: {
      width: `${100 / 7}%`,
      alignItems: 'center',
      paddingVertical: theme.spacing.xs,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    emptyCell: {
      width: `${100 / 7}%`,
      height: CELL_HEIGHT,
    },
  });
