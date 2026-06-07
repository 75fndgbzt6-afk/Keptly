import React, { useCallback, useEffect, useState } from 'react';
import { View, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Button, Card } from '@/components/ui';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/components/theme';
import { Item, UsageLog } from '@/types';
import {
  usageModelFor,
  UsageModel,
  COST_UNIT_SUFFIX,
  DEFAULT_CONSUMPTION_UNIT,
} from '@/lib/usage-models';
import { formatCurrency } from '@/lib/currency';
import { relativeDateLabel, daysUntil } from '@/lib/date';
import {
  logDigitalUsage,
  logCheckIn,
  logConsumption,
  deleteUsageLog,
  listUsageLogs,
  addSampleUsage,
  clearUsage,
} from '@/services/usage';
import { getCostPerUse, getUtilizationTrend, CostPerUse, UtilizationTrend } from '@/services/value-engine';
import { UsageChart } from './UsageChart';
import { LogValueSheet } from './LogValueSheet';

const WINDOW_DAYS = 30;
const RECENT_LIMIT = 10;

interface UsageSectionProps {
  item: Item;
  /** Called after any change so the parent can refresh its verdict / list. */
  onChanged: () => void;
}

type SheetMode = 'minutes' | 'reading' | null;

function buildChartData(logs: UsageLog[]): number[] {
  const days = new Array<number>(WINDOW_DAYS).fill(0);
  for (const log of logs) {
    const delta = daysUntil(log.date); // 0 today, negative in the past
    if (delta === null) continue;
    const idx = WINDOW_DAYS - 1 + delta;
    if (idx >= 0 && idx < WINDOW_DAYS) days[idx] += log.value;
  }
  return days;
}

function logLabel(log: UsageLog, model: UsageModel): string {
  if (model === 'digital') return `${log.value} min`;
  if (model === 'check_in') return 'Check-in';
  return `${log.value}${log.unit ? ` ${log.unit}` : ''}`;
}

function trendLabel(trend: UtilizationTrend): string {
  const arrow = trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→';
  if (trend.direction === 'flat') return `${arrow} steady vs. last month`;
  return `${arrow} ${Math.abs(Math.round(trend.deltaPct))}% vs. last month`;
}

export function UsageSection({ item, onChanged }: UsageSectionProps) {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const model = usageModelFor(item.category);

  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [cpu, setCpu] = useState<CostPerUse | null>(null);
  const [trend, setTrend] = useState<UtilizationTrend | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [windowLogs, cpuRes, trendRes] = await Promise.all([
      listUsageLogs(item.id, WINDOW_DAYS),
      getCostPerUse(item.id, WINDOW_DAYS),
      getUtilizationTrend(item.id, WINDOW_DAYS),
    ]);
    setLogs(windowLogs);
    setCpu(cpuRes);
    setTrend(trendRes);
  }, [item.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!model) return null;

  const reloadAll = async () => {
    await load();
    onChanged();
  };

  const checkedInToday = logs.some((l) => daysUntil(l.date) === 0);

  const onUsedToday = async () => {
    const { minutes } = await logDigitalUsage(item.id);
    setNote(`Logged ${minutes} min for today.`);
    await reloadAll();
  };

  const onCheckIn = async () => {
    const { created } = await logCheckIn(item.id);
    setNote(created ? 'Logged for today.' : 'Already logged for today.');
    await reloadAll();
  };

  const onSheetSubmit = async (value: number, unit?: string) => {
    if (sheetMode === 'minutes') {
      const res = await logDigitalUsage(item.id, value);
      setNote(`Logged ${res.minutes} min for today.`);
    } else if (sheetMode === 'reading') {
      await logConsumption(item.id, value, unit ?? 'units');
      setNote(`Logged ${value}${unit ? ` ${unit}` : ''} for today.`);
    }
    setSheetMode(null);
    await reloadAll();
  };

  const onDelete = async (logId: string) => {
    await deleteUsageLog(logId);
    await reloadAll();
  };

  const onAddSample = async () => {
    await addSampleUsage(item, 7);
    setNote('Added 7 days of sample data.');
    await reloadAll();
  };

  const onClear = () => {
    Alert.alert('Clear usage data', 'Delete all usage logs for this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearUsage(item.id);
          setNote(null);
          await reloadAll();
        },
      },
    ]);
  };

  const chartData = buildChartData(logs);
  const recent = logs.slice(0, RECENT_LIMIT);
  const hasData = cpu !== null && cpu.value !== null;

  // Prefer the concrete logged unit (e.g. "/kWh") for consumption display.
  const latestUnit = logs.find((l) => l.unit)?.unit ?? null;
  const cpuSuffix =
    model === 'consumption' && latestUnit ? `/${latestUnit}` : cpu ? COST_UNIT_SUFFIX[cpu.unit] : '';

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <AppText weight="semibold">Usage</AppText>
        {cpu && cpu.sampleSize > 0 && trend ? (
          <AppText size="xs" color={theme.colors.text.tertiary}>
            {trendLabel(trend)}
          </AppText>
        ) : null}
      </View>

      {hasData ? (
        <View style={styles.costRow}>
          <AppText size="xl" weight="bold">
            {formatCurrency(cpu!.value)}
          </AppText>
          <AppText size="sm" color={theme.colors.text.secondary} style={styles.costSuffix}>
            {cpuSuffix}
          </AppText>
        </View>
      ) : (
        <AppText size="sm" color={theme.colors.text.tertiary}>
          Log a few times to see your cost-per-use.
        </AppText>
      )}

      <UsageChart data={chartData} />

      <View style={styles.actions}>
        {model === 'digital' ? (
          <>
            <Button label="Used today" onPress={onUsedToday} fullWidth />
            <TouchableOpacity
              onPress={() => setSheetMode('minutes')}
              style={styles.linkBtn}
              accessibilityRole="button"
            >
              <AppText size="sm" weight="medium" color={theme.colors.accent}>
                Log specific minutes…
              </AppText>
            </TouchableOpacity>
          </>
        ) : null}

        {model === 'check_in' ? (
          <Button
            label={checkedInToday ? 'Logged for today' : 'I used it today'}
            variant={checkedInToday ? 'secondary' : 'primary'}
            onPress={onCheckIn}
            size="lg"
            fullWidth
          />
        ) : null}

        {model === 'consumption' ? (
          <Button label="Log reading…" onPress={() => setSheetMode('reading')} fullWidth />
        ) : null}

        {note ? (
          <AppText size="xs" color={theme.colors.text.tertiary} align="center">
            {note}
          </AppText>
        ) : null}
      </View>

      <View style={styles.recent}>
        <AppText size="xs" weight="semibold" color={theme.colors.text.tertiary}>
          RECENT ACTIVITY
        </AppText>
        {recent.length === 0 ? (
          <AppText size="sm" color={theme.colors.text.tertiary} style={styles.recentEmpty}>
            No usage logged yet.
          </AppText>
        ) : (
          recent.map((log) => (
            <Swipeable
              key={log.id}
              renderRightActions={() => (
                <TouchableOpacity
                  style={styles.deleteAction}
                  onPress={() => onDelete(log.id)}
                  accessibilityLabel="Delete log"
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={18} color={theme.colors.text.inverse} />
                </TouchableOpacity>
              )}
            >
              <View style={styles.logRow}>
                <AppText size="sm">{logLabel(log, model)}</AppText>
                <AppText size="sm" color={theme.colors.text.tertiary}>
                  {relativeDateLabel(log.date)}
                </AppText>
              </View>
            </Swipeable>
          ))
        )}
      </View>

      {__DEV__ ? (
        <View style={styles.devRow}>
          <Button label="Add 7 days sample" variant="ghost" size="sm" onPress={onAddSample} style={styles.flex1} />
          <Button label="Clear usage" variant="ghost" size="sm" onPress={onClear} style={styles.flex1} />
        </View>
      ) : null}

      <LogValueSheet
        visible={sheetMode !== null}
        title={sheetMode === 'minutes' ? 'Log minutes' : 'Log a reading'}
        valueLabel={sheetMode === 'minutes' ? 'Minutes used' : 'Amount'}
        valuePlaceholder={sheetMode === 'minutes' ? 'e.g. 45' : 'e.g. 12'}
        defaultUnit={
          sheetMode === 'reading'
            ? DEFAULT_CONSUMPTION_UNIT[item.category] ?? 'units'
            : undefined
        }
        onClose={() => setSheetMode(null)}
        onSubmit={onSheetSubmit}
      />
    </Card>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: {
    gap: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  costSuffix: {
    marginLeft: 2,
  },
  actions: {
    gap: theme.spacing.sm,
  },
  linkBtn: {
    alignSelf: 'center',
    paddingVertical: theme.spacing.xs,
  },
  recent: {
    gap: theme.spacing.xs,
  },
  recentEmpty: {
    paddingVertical: theme.spacing.sm,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  deleteAction: {
    backgroundColor: theme.colors.status.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
  },
  devRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  flex1: {
    flex: 1,
  },
});
