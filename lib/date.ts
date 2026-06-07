// Pure date helpers. No React, no side effects.
import { BillingCycle } from '@/types';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MS_PER_DAY = 86_400_000;

/** Convert a Date to an ISO date string (yyyy-mm-dd), local time. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse an ISO date string (yyyy-mm-dd) to a local Date at midnight. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Today as an ISO date string. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Strip time from a date (local midnight). */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Add one billing period to a date. Non-recurring cycles return the date unchanged. */
export function addPeriod(date: Date, cycle: BillingCycle): Date {
  const d = new Date(date.getTime());
  switch (cycle) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case 'one_time':
    case 'variable':
      break;
  }
  return d;
}

/**
 * Compute the next occurrence date from a start date + billing cycle.
 * - recurring: first occurrence on/after `from` (today by default)
 * - one_time: the start date itself
 * - variable: null (no fixed schedule)
 */
export function calcNextDate(
  startDate: string,
  cycle: BillingCycle,
  from: Date = new Date(),
): string | null {
  if (cycle === 'variable') return null;
  const start = fromISODate(startDate);
  if (cycle === 'one_time') return toISODate(start);

  const today = startOfDay(from);
  let next = start;
  let guard = 0;
  while (next.getTime() < today.getTime() && guard < 5000) {
    next = addPeriod(next, cycle);
    guard += 1;
  }
  return toISODate(next);
}

/** Whole days from today until the given ISO date. Negative if in the past. */
export function daysUntil(iso: string | null | undefined, from: Date = new Date()): number | null {
  if (!iso) return null;
  const target = startOfDay(fromISODate(iso));
  const today = startOfDay(from);
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

/** Human-readable absolute date, e.g. "7 Jun 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = fromISODate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Human-readable relative date, e.g. "Today", "in 5 days", "3 days ago". */
export function relativeDateLabel(iso: string | null | undefined, from: Date = new Date()): string {
  const d = daysUntil(iso, from);
  if (d === null) return '—';
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  if (d < 0) return `${Math.abs(d)} days ago`;
  return `in ${d} days`;
}
