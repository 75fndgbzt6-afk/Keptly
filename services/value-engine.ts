// Value engine: cost-per-use, utilization trend, and an intent-aware verdict.
// Pure value math lives here and nowhere else (Phase 3 rule). It reads items and
// usage logs from the DB but performs no UI work and holds no React state.
import { Item, IntentFlag, UsageLog } from '@/types';
import {
  UsageModel,
  CostUnit,
  usageModelFor,
  COST_UNIT_FOR_MODEL,
  COST_UNIT_NOUN,
  USAGE_NOUN_PLURAL,
} from '@/lib/usage-models';
import { formatCurrency } from '@/lib/currency';
import { addDays, toISODate } from '@/lib/date';
import { getItem } from '@/db/items';
import { listUsageLogsByItem, listAllUsageLogsSince } from '@/db/usage';

const DEFAULT_WINDOW = 30;

/** Minimum number of logs in the window before cost-per-use is trustworthy. */
const MIN_SAMPLE: Record<CostUnit, number> = { hour: 2, visit: 2, unit: 1 };

/** Usage-level thresholds in "uses per window", per model. Consumption stays neutral. */
const LEVEL_THRESHOLDS: Record<UsageModel, { low: number; high: number }> = {
  digital: { low: 3, high: 12 }, // hours / 30 days
  check_in: { low: 3, high: 10 }, // visits / 30 days
  consumption: { low: -1, high: Number.POSITIVE_INFINITY }, // never high/low
};

/** Δ% within ±this is treated as flat. */
const FLAT_BAND_PCT = 10;

export interface CostPerUse {
  value: number | null;
  unit: CostUnit;
  sampleSize: number;
}

/** Usage summary over a window, for items that have a usage model. */
export interface UsageStat {
  /** Normalized uses (hours for digital; visit/unit counts otherwise). */
  uses: number;
  /** Number of usage_logs rows in the window. 0 = no usage in the window. */
  logCount: number;
  level: 'low' | 'mid' | 'high';
}

export interface UtilizationTrend {
  thisPeriod: number;
  lastPeriod: number;
  deltaPct: number;
  direction: 'up' | 'down' | 'flat';
}

export type ValueSignal =
  | 'good_value'
  | 'overpriced'
  | 'underused'
  | 'overused'
  | 'no_data';

export interface ValueVerdict {
  signal: ValueSignal;
  headline: string;
  body: string;
}

// --- Pure helpers (operate on already-fetched data) ---

/** The item's monthly-equivalent cost. one_time has no recurring monthly cost. */
function monthlyCost(item: Item): number | null {
  if (item.amount === null || item.amount === undefined) return null;
  switch (item.billingCycle) {
    case 'weekly':
      return (item.amount * 52) / 12;
    case 'monthly':
      return item.amount;
    case 'quarterly':
      return item.amount / 3;
    case 'yearly':
      return item.amount / 12;
    case 'variable':
      return item.amount; // treated as the current monthly bill
    case 'one_time':
      return null;
  }
}

/** Normalize logs to "uses": hours for digital, visit/unit counts otherwise. */
function usesFromLogs(model: UsageModel, logs: UsageLog[]): number {
  const sum = logs.reduce((acc, l) => acc + l.value, 0);
  return model === 'digital' ? sum / 60 : sum;
}

function windowStartISO(windowDays: number, from: Date): string {
  return toISODate(addDays(from, -(windowDays - 1)));
}

function logsInRange(logs: UsageLog[], startISO: string, endISO: string): UsageLog[] {
  return logs.filter((l) => l.date >= startISO && l.date <= endISO);
}

function usageLevel(model: UsageModel, usesPerWindow: number): 'low' | 'mid' | 'high' {
  const t = LEVEL_THRESHOLDS[model];
  if (usesPerWindow <= t.low) return 'low';
  if (usesPerWindow >= t.high) return 'high';
  return 'mid';
}

function costPerUseFrom(item: Item, model: UsageModel, windowLogs: UsageLog[]): CostPerUse {
  const unit = COST_UNIT_FOR_MODEL[model];
  const sampleSize = windowLogs.length;
  const uses = usesFromLogs(model, windowLogs);
  const mc = monthlyCost(item);
  const enough = sampleSize >= MIN_SAMPLE[unit];
  const value = enough && mc !== null && uses > 0 ? mc / uses : null;
  return { value, unit, sampleSize };
}

// --- Public API ---

/** Cost-per-use over the window. value is null when the sample is too small. */
export async function getCostPerUse(
  itemId: string,
  windowDays = DEFAULT_WINDOW,
): Promise<CostPerUse> {
  const item = await getItem(itemId);
  const model = item ? usageModelFor(item.category) : null;
  if (!item || !model) return { value: null, unit: 'unit', sampleSize: 0 };

  const now = new Date();
  const startISO = windowStartISO(windowDays, now);
  const logs = (await listUsageLogsByItem(itemId)).filter((l) => l.date >= startISO);
  return costPerUseFrom(item, model, logs);
}

/** Cost-per-use for many items in one DB pass (used by the Items list). */
export async function getCostPerUseMap(
  items: Item[],
  windowDays = DEFAULT_WINDOW,
): Promise<Map<string, CostPerUse>> {
  const now = new Date();
  const startISO = windowStartISO(windowDays, now);
  const allLogs = await listAllUsageLogsSince(startISO);

  const byItem = new Map<string, UsageLog[]>();
  for (const log of allLogs) {
    const list = byItem.get(log.itemId) ?? [];
    list.push(log);
    byItem.set(log.itemId, list);
  }

  const result = new Map<string, CostPerUse>();
  for (const item of items) {
    const model = usageModelFor(item.category);
    if (!model) continue;
    result.set(item.id, costPerUseFrom(item, model, byItem.get(item.id) ?? []));
  }
  return result;
}

/**
 * Usage stats (uses, log count, level) for many items in one DB pass.
 * Only items with a usage model are included; set-and-forget categories are skipped.
 */
export async function getUsageStatsMap(
  items: Item[],
  windowDays = DEFAULT_WINDOW,
): Promise<Map<string, UsageStat>> {
  const now = new Date();
  const startISO = windowStartISO(windowDays, now);
  const allLogs = await listAllUsageLogsSince(startISO);

  const byItem = new Map<string, UsageLog[]>();
  for (const log of allLogs) {
    const list = byItem.get(log.itemId) ?? [];
    list.push(log);
    byItem.set(log.itemId, list);
  }

  const result = new Map<string, UsageStat>();
  for (const item of items) {
    const model = usageModelFor(item.category);
    if (!model) continue;
    const logs = byItem.get(item.id) ?? [];
    const uses = usesFromLogs(model, logs);
    result.set(item.id, {
      uses,
      logCount: logs.length,
      level: usageLevel(model, uses),
    });
  }
  return result;
}

/** Usage this window vs the window before it. */
export async function getUtilizationTrend(
  itemId: string,
  windowDays = DEFAULT_WINDOW,
): Promise<UtilizationTrend> {
  const item = await getItem(itemId);
  const model = item ? usageModelFor(item.category) : null;
  if (!item || !model) return { thisPeriod: 0, lastPeriod: 0, deltaPct: 0, direction: 'flat' };

  const now = new Date();
  const todayISO = toISODate(now);
  const thisStartISO = windowStartISO(windowDays, now);
  const lastEndISO = toISODate(addDays(now, -windowDays));
  const lastStartISO = toISODate(addDays(now, -(2 * windowDays - 1)));

  const logs = await listUsageLogsByItem(itemId);
  const thisPeriod = usesFromLogs(model, logsInRange(logs, thisStartISO, todayISO));
  const lastPeriod = usesFromLogs(model, logsInRange(logs, lastStartISO, lastEndISO));

  let deltaPct: number;
  if (lastPeriod === 0) {
    deltaPct = thisPeriod > 0 ? 100 : 0;
  } else {
    deltaPct = ((thisPeriod - lastPeriod) / lastPeriod) * 100;
  }

  const direction: UtilizationTrend['direction'] =
    Math.abs(deltaPct) < FLAT_BAND_PCT ? 'flat' : deltaPct > 0 ? 'up' : 'down';

  return { thisPeriod, lastPeriod, deltaPct, direction };
}

function formatUses(model: UsageModel, uses: number): string {
  const n = model === 'digital' ? Math.round(uses * 10) / 10 : Math.round(uses);
  return `${n} ${USAGE_NOUN_PLURAL[model]}`;
}

function buildVerdict(
  intent: IntentFlag,
  model: UsageModel,
  level: 'low' | 'mid' | 'high',
  uses: number,
  cpu: CostPerUse,
): ValueVerdict {
  const usesLabel = formatUses(model, uses);
  const perNoun = COST_UNIT_NOUN[cpu.unit];

  if (intent === 'less' && level === 'high') {
    return {
      signal: 'overused',
      headline: "You're on this a lot lately.",
      body: `About ${usesLabel} in the last 30 days.`,
    };
  }

  if (intent === 'more' && level === 'low') {
    return {
      signal: 'underused',
      headline: "Haven't used this much this month.",
      body: `Just ${usesLabel} so far — still keen to use it more?`,
    };
  }

  if (intent === 'neutral' && level === 'low' && cpu.value !== null) {
    return {
      signal: 'overpriced',
      headline: `Costing ${formatCurrency(cpu.value)} per ${perNoun} — worth a look?`,
      body: 'Not much use lately for what it costs.',
    };
  }

  const headline = level === 'high' ? "Great value — you're using this plenty." : 'Looks worth it.';
  const body =
    cpu.value !== null
      ? `About ${formatCurrency(cpu.value)} per ${perNoun}.`
      : `${usesLabel} in the last 30 days.`;
  return { signal: 'good_value', headline, body };
}

/** Intent-aware verdict. Calm and observational — never moralizing. */
export async function getValueVerdict(
  itemId: string,
  windowDays = DEFAULT_WINDOW,
): Promise<ValueVerdict> {
  const item = await getItem(itemId);
  const model = item ? usageModelFor(item.category) : null;
  if (!item || !model) {
    return { signal: 'no_data', headline: '', body: '' };
  }

  const now = new Date();
  const startISO = windowStartISO(windowDays, now);
  const windowLogs = (await listUsageLogsByItem(itemId)).filter((l) => l.date >= startISO);
  const cpu = costPerUseFrom(item, model, windowLogs);

  if (cpu.sampleSize < MIN_SAMPLE[cpu.unit]) {
    return { signal: 'no_data', headline: '', body: '' };
  }

  const uses = usesFromLogs(model, windowLogs);
  const level = usageLevel(model, uses);
  return buildVerdict(item.intentFlag, model, level, uses, cpu);
}
