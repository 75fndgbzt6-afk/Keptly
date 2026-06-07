// Dev-only sample data. Behind __DEV__ in the UI. Creates a spread of items across
// every category — with varied billing cycles, intent flags, and usage histories —
// so the dashboard and recommendation engine are exercisable without manual setup.
// Idempotent: every seeded item is tagged, and re-seeding is a no-op while the tag
// is present.
import { BillingCycle, Category, IntentFlag, NewItemInput } from '@/types';
import { DEFAULT_CURRENCY } from '@/constants/config';
import { toISODate, addDays } from '@/lib/date';
import { emptyDetailsFor } from '@/lib/category';
import { listItems, createItem } from '@/db/items';
import { addSampleUsage } from '@/services/usage';

/** Stored in `notes` so we can detect (and avoid duplicating) seeded items. */
export const SEED_TAG = '[sample data]';

interface SeedSpec {
  name: string;
  category: Category;
  amount: number | null;
  cycle: BillingCycle;
  intent: IntentFlag;
  /** Item start date = this many days before today (drives nextDate). */
  startOffsetDays: number;
  /** Days of synthetic usage to seed (0 = never used in the window). */
  usageDays: number;
  isFreeTrial?: boolean;
  /** Days from today the free trial ends (only when isFreeTrial). */
  trialInDays?: number;
}

// ~14 items: one per category, plus extra Streaming/Music to trigger overlaps.
const SEED_ITEMS: SeedSpec[] = [
  // Streaming/OTT — Netflix heavily used (monthly → annual tip); Disney+ unused (cancel + overlap)
  { name: 'Netflix', category: 'Streaming/OTT', amount: 649, cycle: 'monthly', intent: 'neutral', startOffsetDays: 25, usageDays: 25 },
  { name: 'Disney+ Hotstar', category: 'Streaming/OTT', amount: 299, cycle: 'monthly', intent: 'neutral', startOffsetDays: 20, usageDays: 0 },
  // Music — Spotify lightly used; Apple Music unused + "want less" (cancel + overlap)
  { name: 'Spotify', category: 'Music', amount: 119, cycle: 'monthly', intent: 'neutral', startOffsetDays: 12, usageDays: 4 },
  { name: 'Apple Music', category: 'Music', amount: 99, cycle: 'monthly', intent: 'less', startOffsetDays: 8, usageDays: 0 },
  // AI tools — ChatGPT heavily used, "want more" (annual tip, never a cancel)
  { name: 'ChatGPT Plus', category: 'AI tools', amount: 1650, cycle: 'monthly', intent: 'more', startOffsetDays: 18, usageDays: 25 },
  // Cloud/Software — yearly, lightly used (monthly tip)
  { name: 'Google One', category: 'Cloud/Software', amount: 1300, cycle: 'yearly', intent: 'neutral', startOffsetDays: 200, usageDays: 3 },
  // Gym/Fitness — moderate check-ins, "want more"
  { name: 'Cult.fit', category: 'Gym/Fitness', amount: 1499, cycle: 'monthly', intent: 'more', startOffsetDays: 22, usageDays: 14 },
  // Utilities — variable bill, consumption logs
  { name: 'Electricity Bill', category: 'Utilities', amount: 2200, cycle: 'variable', intent: 'neutral', startOffsetDays: 15, usageDays: 10 },
  // Telecom — monthly, consumption logs
  { name: 'Airtel Fiber', category: 'Telecom', amount: 799, cycle: 'monthly', intent: 'neutral', startOffsetDays: 27, usageDays: 12 },
  // Insurance — yearly, no usage model (never a cancel candidate)
  { name: 'Car Insurance', category: 'Insurance', amount: 12000, cycle: 'yearly', intent: 'neutral', startOffsetDays: 100, usageDays: 0 },
  // Warranty — one-time, no recurring cost, no usage model
  { name: 'MacBook Warranty', category: 'Warranty', amount: null, cycle: 'one_time', intent: 'neutral', startOffsetDays: 300, usageDays: 0 },
  // Government document — one-time, no usage model
  { name: 'Passport', category: 'Government document', amount: null, cycle: 'one_time', intent: 'neutral', startOffsetDays: 400, usageDays: 0 },
  // Membership — free trial ending soon (trial warning); a couple check-ins so it isn't a cancel
  { name: 'Amazon Prime', category: 'Membership', amount: 299, cycle: 'monthly', intent: 'neutral', startOffsetDays: 2, usageDays: 2, isFreeTrial: true, trialInDays: 5 },
  // Other — unused + "want less" (cancel candidate; "Other" uses the digital model)
  { name: 'The Hindu ePaper', category: 'Other', amount: 299, cycle: 'monthly', intent: 'less', startOffsetDays: 10, usageDays: 0 },
];

/** True when seeded sample items are already present. */
export async function isSampleSeeded(): Promise<boolean> {
  const items = await listItems();
  return items.some((i) => i.notes === SEED_TAG);
}

/**
 * Seed the sample dataset if not already present.
 * Returns how many items were created (0 when it was already seeded).
 */
export async function seedSampleData(): Promise<{ created: number; alreadySeeded: boolean }> {
  if (await isSampleSeeded()) return { created: 0, alreadySeeded: true };

  let created = 0;
  for (const spec of SEED_ITEMS) {
    const input: NewItemInput = {
      name: spec.name,
      category: spec.category,
      holderName: null,
      paymentMethodId: null,
      amount: spec.amount,
      currency: DEFAULT_CURRENCY,
      billingCycle: spec.cycle,
      startDate: toISODate(addDays(new Date(), -spec.startOffsetDays)),
      autoRenew: true,
      isFreeTrial: spec.isFreeTrial ?? false,
      trialEndDate:
        spec.trialInDays !== undefined ? toISODate(addDays(new Date(), spec.trialInDays)) : null,
      status: 'active',
      intentFlag: spec.intent,
      notes: SEED_TAG,
      attachmentUri: null,
      details: emptyDetailsFor(spec.category),
    };
    const item = await createItem(input);
    if (spec.usageDays > 0) await addSampleUsage(item, spec.usageDays);
    created += 1;
  }

  return { created, alreadySeeded: false };
}
