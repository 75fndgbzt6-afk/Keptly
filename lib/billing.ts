// Pure billing math. Converting any billing cycle to a comparable monthly figure
// is the foundation of every dashboard total (SPEC §7). No React, no DB.
import { BillingCycle, Item } from '@/types';

/** Average weeks per month (52 / 12), used to monthly-ize weekly costs. */
const WEEKS_PER_MONTH = 52 / 12;

/**
 * Monthly-equivalent cost of an amount on a given billing cycle.
 *
 * - weekly    → amount × 52 / 12
 * - monthly   → amount
 * - quarterly → amount / 3
 * - yearly    → amount / 12
 * - variable  → amount as-is (callers pass the most recent known/entered amount,
 *               which for variable utilities IS the current monthly bill)
 * - one_time  → 0 (a one-off purchase has no recurring monthly cost)
 *
 * The switch is exhaustive: adding a BillingCycle without handling it here is a
 * compile error (the `never` assignment in the default branch fails to typecheck).
 */
export function monthlyEquivalent(
  amount: number | null | undefined,
  cycle: BillingCycle,
): number {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return 0;
  switch (cycle) {
    case 'weekly':
      return amount * WEEKS_PER_MONTH;
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'yearly':
      return amount / 12;
    case 'variable':
      return amount;
    case 'one_time':
      return 0;
    default: {
      const _exhaustive: never = cycle;
      return _exhaustive;
    }
  }
}

/** Monthly-equivalent cost of a single item. */
export function itemMonthly(item: Item): number {
  return monthlyEquivalent(item.amount, item.billingCycle);
}

/** Sum of monthly-equivalent costs across the given items. */
export function monthlyTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + itemMonthly(item), 0);
}

/** Sum of yearly cost across the given items (12 × monthly-equivalent). */
export function yearlyTotal(items: Item[]): number {
  return monthlyTotal(items) * 12;
}
