// Usage logging service. Every write to usage_logs goes through here — never
// directly from a component (Phase 3 rule). The value engine reads the rows
// these functions produce.
import { Item, UsageLog } from '@/types';
import { todayISO, toISODate, addDays } from '@/lib/date';
import {
  usageModelFor,
  DEFAULT_DIGITAL_MINUTES,
  DEFAULT_CONSUMPTION_UNIT,
} from '@/lib/usage-models';
import {
  createUsageLog,
  deleteUsageLog as dbDeleteUsageLog,
  deleteUsageLogsByItem,
  listUsageLogsSince,
  countUsageLogsOnDate,
} from '@/db/usage';

/**
 * Log a digital session. Without an explicit duration we record a sensible
 * default; the returned `minutes` lets the UI tell the user what was saved.
 */
export async function logDigitalUsage(
  itemId: string,
  minutes?: number,
): Promise<{ log: UsageLog; minutes: number }> {
  const recorded = minutes && minutes > 0 ? Math.round(minutes) : DEFAULT_DIGITAL_MINUTES;
  const log = await createUsageLog({
    itemId,
    date: todayISO(),
    value: recorded,
    unit: null,
    source: 'manual',
  });
  return { log, minutes: recorded };
}

/** Record a physical check-in for today. Idempotent: one check-in per day. */
export async function logCheckIn(itemId: string): Promise<{ created: boolean }> {
  const today = todayISO();
  const existing = await countUsageLogsOnDate(itemId, today);
  if (existing > 0) return { created: false };
  await createUsageLog({ itemId, date: today, value: 1, unit: null, source: 'manual' });
  return { created: true };
}

/** Record a consumption reading (value + unit label, e.g. 12 kWh). */
export async function logConsumption(
  itemId: string,
  value: number,
  unit: string,
): Promise<{ log: UsageLog }> {
  const log = await createUsageLog({
    itemId,
    date: todayISO(),
    value,
    unit: unit.trim() || null,
    source: 'manual',
  });
  return { log };
}

/** Delete a single log (fat-finger fix). */
export async function deleteUsageLog(logId: string): Promise<void> {
  await dbDeleteUsageLog(logId);
}

/** Logs for an item within the trailing window, newest first. */
export async function listUsageLogs(itemId: string, windowDays = 30): Promise<UsageLog[]> {
  const sinceISO = toISODate(addDays(new Date(), -(windowDays - 1)));
  return listUsageLogsSince(itemId, sinceISO);
}

// --- Dev-only helpers (called behind __DEV__) ---

/** Seed `days` of realistic sample usage for the item's model, to test charts/verdicts. */
export async function addSampleUsage(item: Item, days = 7): Promise<void> {
  const model = usageModelFor(item.category);
  if (!model) return;
  const now = new Date();

  for (let i = 0; i < days; i += 1) {
    const date = toISODate(addDays(now, -i));
    if (model === 'digital') {
      const minutes = 25 + ((i * 13) % 70); // 25–94 min, varied
      await createUsageLog({ itemId: item.id, date, value: minutes, unit: null, source: 'auto' });
    } else if (model === 'check_in') {
      if (i % 3 === 1) continue; // skip some days for a realistic gym cadence
      await createUsageLog({ itemId: item.id, date, value: 1, unit: null, source: 'auto' });
    } else {
      const unit = DEFAULT_CONSUMPTION_UNIT[item.category] ?? 'units';
      const value = 4 + ((i * 3) % 9); // 4–12 units, varied
      await createUsageLog({ itemId: item.id, date, value, unit, source: 'auto' });
    }
  }
}

/** Remove all usage logs for an item (dev convenience + clean delete path). */
export async function clearUsage(itemId: string): Promise<void> {
  await deleteUsageLogsByItem(itemId);
}
