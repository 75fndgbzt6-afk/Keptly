// Money dashboard math. Every total, breakdown, and "what's due" computation the
// Home and Insights screens show goes through here (Phase 4 rule). Pure functions
// take the already-loaded item list; the alert lookup reads the reminders DAO.
import { Category, Item, Reminder } from '@/types';
import { itemMonthly, monthlyTotal as sumMonthly, yearlyTotal as sumYearly } from '@/lib/billing';
import { daysUntil, toISODate } from '@/lib/date';
import { listReminders } from '@/db/reminders';

const DEFAULT_RENEWAL_LIMIT = 5;
const DEFAULT_RENEWAL_WINDOW = 30;
const DEFAULT_ALERT_LIMIT = 3;

function isActive(item: Item): boolean {
  return item.status === 'active';
}

/** Total monthly-equivalent spend across active items. */
export function getMonthlyTotal(items: Item[]): number {
  return sumMonthly(items.filter(isActive));
}

/** Total yearly spend across active items. */
export function getYearlyTotal(items: Item[]): number {
  return sumYearly(items.filter(isActive));
}

/** How many items are currently active. */
export function getActiveItemCount(items: Item[]): number {
  return items.filter(isActive).length;
}

export interface CategorySpend {
  category: Category;
  monthlyAmount: number;
}

/** Active spend grouped by category, descending, excluding zero-cost categories. */
export function getSpendByCategory(items: Item[]): CategorySpend[] {
  const totals = new Map<Category, number>();
  for (const item of items) {
    if (!isActive(item)) continue;
    const monthly = itemMonthly(item);
    if (monthly <= 0) continue;
    totals.set(item.category, (totals.get(item.category) ?? 0) + monthly);
  }
  return [...totals.entries()]
    .map(([category, monthlyAmount]) => ({ category, monthlyAmount }))
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

/** The single highest-spend category, or null when there's no spend. */
export function getTopCategory(items: Item[]): CategorySpend | null {
  return getSpendByCategory(items)[0] ?? null;
}

/** Active items with a nextDate inside the window, soonest first. */
export function getUpcomingRenewals(
  items: Item[],
  limit = DEFAULT_RENEWAL_LIMIT,
  windowDays = DEFAULT_RENEWAL_WINDOW,
): Item[] {
  return items
    .filter((item) => {
      if (!isActive(item) || !item.nextDate) return false;
      const d = daysUntil(item.nextDate);
      return d !== null && d >= 0 && d <= windowDays;
    })
    .sort((a, b) => (daysUntil(a.nextDate) ?? 0) - (daysUntil(b.nextDate) ?? 0))
    .slice(0, limit);
}

export interface ActiveAlert {
  reminder: Reminder;
  item: Item | null;
}

/**
 * Pending reminders that have already come due (fire date in the past) and the
 * user hasn't acted on — the things that actually need attention now.
 */
export async function getActiveAlerts(
  items: Item[],
  limit = DEFAULT_ALERT_LIMIT,
): Promise<ActiveAlert[]> {
  const reminders = await listReminders();
  const byId = new Map<string, Item>(items.map((i) => [i.id, i]));
  const now = Date.now();

  return reminders
    .filter((r) => r.status === 'pending' && Date.parse(r.triggerDate) <= now)
    .sort((a, b) => Date.parse(b.triggerDate) - Date.parse(a.triggerDate))
    .slice(0, limit)
    .map((reminder) => ({ reminder, item: byId.get(reminder.itemId) ?? null }));
}

export interface MonthlyTrend {
  /** Monthly totals, oldest → newest. */
  points: number[];
  /** How many of those months actually had any active item yet. */
  dataMonths: number;
}

/**
 * Approximate monthly spend over the last `months` months, derived from item
 * start dates (we keep no spend-history table). For each month we sum the
 * monthly-equivalent of every active item that had started by that month's end.
 * The line therefore steps up as items were added.
 */
export function getMonthlyTrend(items: Item[], months = 6): MonthlyTrend {
  const active = items.filter(isActive);
  const now = new Date();
  const points: number[] = [];
  let dataMonths = 0;

  for (let i = months - 1; i >= 0; i -= 1) {
    // Last calendar day of the month `i` months ago.
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const cutoff = toISODate(monthEnd);
    const started = active.filter((item) => item.startDate <= cutoff);
    if (started.length > 0) dataMonths += 1;
    points.push(sumMonthly(started));
  }

  return { points, dataMonths };
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface CategoryTrend {
  /** Short month labels, oldest → newest. */
  labels: string[];
  /** Top categories (+ an "Other" bucket) with a monthly-spend value per label. */
  series: { category: string; values: number[] }[];
}

/**
 * Stacked spend by category over the last `months` months. The top `topN`
 * categories by total spend are kept; the rest roll up into "Other". Monthly
 * spend is approximated from item start dates (no spend-history table).
 */
export function getCategoryTrend(items: Item[], months = 6, topN = 5): CategoryTrend {
  const active = items.filter(isActive);
  const now = new Date();
  const labels: string[] = [];
  const cutoffs: string[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    labels.push(MONTH_SHORT[monthEnd.getMonth()]);
    cutoffs.push(toISODate(monthEnd));
  }

  const perCategory = new Map<string, number[]>();
  for (const item of active) {
    const monthly = itemMonthly(item);
    if (monthly <= 0) continue;
    const row = perCategory.get(item.category) ?? new Array(months).fill(0);
    cutoffs.forEach((cutoff, idx) => {
      if (item.startDate <= cutoff) row[idx] += monthly;
    });
    perCategory.set(item.category, row);
  }

  const ranked = [...perCategory.entries()].sort(
    (a, b) => b[1].reduce((s, v) => s + v, 0) - a[1].reduce((s, v) => s + v, 0),
  );
  const top = ranked.slice(0, topN);
  const rest = ranked.slice(topN);

  const series = top.map(([category, values]) => ({ category, values }));
  if (rest.length > 0) {
    const other = new Array(months).fill(0);
    for (const [, values] of rest) values.forEach((v, i) => (other[i] += v));
    series.push({ category: 'Other', values: other });
  }
  return { labels, series };
}
