// Recommendation engine. All savings/nudge rules live here (Phase 4 rule). Pure
// rule functions take the loaded items + usage stats and return proposed rows;
// persistence diffs them against the table so user-dismissed picks don't return.
import {
  Category,
  Item,
  Recommendation,
  RecommendationType,
  ProposedRecommendation,
} from '@/types';
import { itemMonthly } from '@/lib/billing';
import { formatCurrency } from '@/lib/currency';
import { daysUntil } from '@/lib/date';
import { hasUsageModel } from '@/lib/usage-models';
import { COUNTS_TOWARD_SAVINGS } from '@/lib/recommendations';
import { getUsageStatsMap, UsageStat } from '@/services/value-engine';
import { listItems, updateItem } from '@/db/items';
import {
  createRecommendation,
  listRecommendations,
  listActiveRecommendations,
  getRecommendation,
  updateRecommendationStatus,
  updateRecommendationContent,
} from '@/db/recommendations';

/** Categories where holding several at once is the classic "do you need all of these?" case. */
const OVERLAP_CATEGORIES: Category[] = ['Streaming/OTT', 'Music', 'AI tools'];
/** A trial within this many days counts as "ending soon". */
const TRIAL_WINDOW_DAYS = 7;
/** Window for "no recent usage" / utilization judgements. */
const USAGE_WINDOW_DAYS = 30;

type StatMap = Map<string, UsageStat>;

function isActive(item: Item): boolean {
  return item.status === 'active';
}

function relativeDays(d: number): string {
  if (d <= 0) return 'today';
  if (d === 1) return 'tomorrow';
  return `in ${d} days`;
}

// --- Pure rule functions ---

/** Active, trackable items with no usage in the window and not flagged "want more". */
export function findCancelCandidates(items: Item[], stats: StatMap): ProposedRecommendation[] {
  const out: ProposedRecommendation[] = [];
  for (const item of items) {
    if (!isActive(item)) continue;
    if (!hasUsageModel(item.category)) continue; // set-and-forget items aren't "unused"
    if (item.intentFlag === 'more') continue;
    const monthly = itemMonthly(item);
    if (monthly <= 0) continue; // nothing to save (one-time / no amount)
    const logCount = stats.get(item.id)?.logCount ?? 0;
    if (logCount > 0) continue; // used at least once in the last 30 days
    out.push({
      itemId: item.id,
      type: 'cancel',
      reason: `No usage in the last 30 days — cancelling saves ${formatCurrency(monthly)}/month.`,
      estimatedSavings: monthly,
    });
  }
  return out;
}

/** 2+ active items in an overlap-prone category → suggest dropping the least-used. */
export function findDuplicates(items: Item[], stats: StatMap): ProposedRecommendation[] {
  const out: ProposedRecommendation[] = [];
  for (const category of OVERLAP_CATEGORIES) {
    const group = items.filter((i) => isActive(i) && i.category === category);
    if (group.length < 2) continue;

    // Least utilized first; tie-break to the pricier one (bigger saving).
    const sorted = [...group].sort((a, b) => {
      const ua = stats.get(a.id)?.uses ?? 0;
      const ub = stats.get(b.id)?.uses ?? 0;
      if (ua !== ub) return ua - ub;
      return itemMonthly(b) - itemMonthly(a);
    });
    const candidate = sorted[0];
    const monthly = itemMonthly(candidate);
    const savingsClause =
      monthly > 0 ? ` — cancelling ${candidate.name} saves ${formatCurrency(monthly)}/month` : '';
    out.push({
      itemId: candidate.id,
      type: 'duplicate',
      reason: `You have ${group.length} ${category} subscriptions${savingsClause}.`,
      estimatedSavings: monthly > 0 ? monthly : null,
    });
  }
  return out;
}

/** Active free trials ending within the next week. */
export function findTrialEndings(items: Item[]): ProposedRecommendation[] {
  const out: ProposedRecommendation[] = [];
  for (const item of items) {
    if (!isActive(item)) continue;
    if (!item.isFreeTrial || !item.trialEndDate) continue;
    const d = daysUntil(item.trialEndDate);
    if (d === null || d < 0 || d > TRIAL_WINDOW_DAYS) continue;
    const monthly = itemMonthly(item);
    const chargeClause =
      monthly > 0 ? ` Cancel before then to avoid a ${formatCurrency(monthly)}/month charge.` : '';
    out.push({
      itemId: item.id,
      type: 'trial_ending',
      reason: `Free trial ends ${relativeDays(d)}.${chargeClause}`,
      estimatedSavings: null,
    });
  }
  return out;
}

/** Heavy monthly → consider annual; light annual → consider monthly. Soft, no number. */
export function findCycleOptimizations(items: Item[], stats: StatMap): ProposedRecommendation[] {
  const out: ProposedRecommendation[] = [];
  for (const item of items) {
    if (!isActive(item)) continue;
    if (!hasUsageModel(item.category)) continue;
    const stat = stats.get(item.id);
    if (!stat || stat.logCount === 0) continue; // need real usage to judge

    if (item.billingCycle === 'monthly' && stat.level === 'high') {
      out.push({
        itemId: item.id,
        type: 'cycle_optimization',
        reason: `You use ${item.name} a lot — an annual plan often costs less than paying monthly.`,
        estimatedSavings: null,
      });
    } else if (item.billingCycle === 'yearly' && stat.level === 'low') {
      out.push({
        itemId: item.id,
        type: 'cycle_optimization',
        reason: `Light use on a yearly plan — switching to monthly keeps you flexible.`,
        estimatedSavings: null,
      });
    }
  }
  return out;
}

// --- Orchestration ---

/** Run every rule against current data and return the merged proposed set. */
export async function generateRecommendations(): Promise<ProposedRecommendation[]> {
  const items = await listItems();
  const stats = await getUsageStatsMap(items, USAGE_WINDOW_DAYS);
  return [
    ...findTrialEndings(items),
    ...findCancelCandidates(items, stats),
    ...findDuplicates(items, stats),
    ...findCycleOptimizations(items, stats),
  ];
}

const keyOf = (r: { itemId: string; type: RecommendationType }): string => `${r.itemId}::${r.type}`;

/**
 * Diff the freshly-generated set against the table:
 * - new proposals → inserted as active
 * - still-valid active rows → reason/savings refreshed
 * - active rows no longer proposed → marked dismissed (gone stale)
 * - dismissed/accepted rows → left untouched, so they don't keep popping back
 * Returns the resulting active list.
 */
export async function persistRecommendations(): Promise<Recommendation[]> {
  const proposed = await generateRecommendations();
  const existing = await listRecommendations();
  const existingByKey = new Map(existing.map((r) => [keyOf(r), r]));
  const proposedKeys = new Set<string>();

  for (const p of proposed) {
    const key = keyOf(p);
    proposedKeys.add(key);
    const ex = existingByKey.get(key);
    if (!ex) {
      await createRecommendation({ ...p, status: 'active' });
    } else if (ex.status === 'active') {
      await updateRecommendationContent(ex.id, p.reason, p.estimatedSavings);
    }
  }

  for (const ex of existing) {
    if (ex.status === 'active' && !proposedKeys.has(keyOf(ex))) {
      await updateRecommendationStatus(ex.id, 'dismissed');
    }
  }

  return listActiveRecommendations();
}

/** Hide a recommendation for good (user's explicit choice). */
export async function dismissRecommendation(id: string): Promise<void> {
  await updateRecommendationStatus(id, 'dismissed');
}

/** What the UI should do after Apply — the engine never navigates itself. */
export type RecommendationAction =
  | { kind: 'refresh' } // underlying data changed; reload screens
  | { kind: 'open-item'; itemId: string }
  | { kind: 'edit-item'; itemId: string };

/**
 * Apply a recommendation by its type:
 * - cancel             → set the item's status to cancelled, mark accepted
 * - duplicate / trial  → open the item's detail so the user can decide
 * - cycle_optimization → open the item's edit form
 */
export async function applyRecommendation(id: string): Promise<RecommendationAction> {
  const rec = await getRecommendation(id);
  if (!rec) return { kind: 'refresh' };

  switch (rec.type) {
    case 'cancel':
      await updateItem(rec.itemId, { status: 'cancelled' });
      await updateRecommendationStatus(id, 'accepted');
      return { kind: 'refresh' };
    case 'duplicate':
    case 'trial_ending':
      return { kind: 'open-item', itemId: rec.itemId };
    case 'cycle_optimization':
      return { kind: 'edit-item', itemId: rec.itemId };
    default: {
      const _exhaustive: never = rec.type;
      return _exhaustive;
    }
  }
}

/**
 * Potential monthly savings: estimatedSavings summed over active cancel + duplicate
 * recommendations, de-duplicated by item (cancelling an item only saves its cost once).
 */
export function sumPotentialSavings(recs: Recommendation[]): number {
  const perItem = new Map<string, number>();
  for (const r of recs) {
    if (r.status !== 'active') continue;
    if (!COUNTS_TOWARD_SAVINGS[r.type]) continue;
    if (r.estimatedSavings === null) continue;
    perItem.set(r.itemId, Math.max(perItem.get(r.itemId) ?? 0, r.estimatedSavings));
  }
  return [...perItem.values()].reduce((sum, v) => sum + v, 0);
}
