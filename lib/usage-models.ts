// Maps each category to its usage-tracking model and the units used to express
// cost-per-use. Pure data + lookups — no React, no DB. This is the single source
// of truth for "how is this kind of thing used?" (SPEC §7).
import { Category } from '@/types';

/** The three usage-tracking models, plus "none" for set-and-forget items. */
export type UsageModel = 'digital' | 'check_in' | 'consumption';

/** The unit cost-per-use is expressed in, per model. */
export type CostUnit = 'hour' | 'visit' | 'unit';

/**
 * Category → usage model. `null` means set-and-forget (Insurance, Warranty,
 * Government document) — these get no usage card. "Other" defaults to digital.
 */
const CATEGORY_USAGE_MODEL: Record<Category, UsageModel | null> = {
  'Streaming/OTT': 'digital',
  Music: 'digital',
  'AI tools': 'digital',
  'Cloud/Software': 'digital',
  'Gym/Fitness': 'check_in',
  Membership: 'check_in',
  Utilities: 'consumption',
  Telecom: 'consumption',
  Insurance: null,
  Warranty: null,
  'Government document': null,
  Other: 'digital',
};

export function usageModelFor(category: Category): UsageModel | null {
  return CATEGORY_USAGE_MODEL[category];
}

export function hasUsageModel(category: Category): boolean {
  return CATEGORY_USAGE_MODEL[category] !== null;
}

export const COST_UNIT_FOR_MODEL: Record<UsageModel, CostUnit> = {
  digital: 'hour',
  check_in: 'visit',
  consumption: 'unit',
};

/** Suffix for a compact cost-per-use chip, e.g. "₹16/hr". */
export const COST_UNIT_SUFFIX: Record<CostUnit, string> = {
  hour: '/hr',
  visit: '/visit',
  unit: '/unit',
};

/** Singular noun used in verdict copy ("per hour", "per use"). */
export const COST_UNIT_NOUN: Record<CostUnit, string> = {
  hour: 'hour',
  visit: 'visit',
  unit: 'use',
};

/** Plural noun used in verdict copy ("12 hours", "4 visits"). */
export const USAGE_NOUN_PLURAL: Record<UsageModel, string> = {
  digital: 'hours',
  check_in: 'visits',
  consumption: 'units',
};

/** Default consumption unit label suggested in the log sheet, per category. */
export const DEFAULT_CONSUMPTION_UNIT: Partial<Record<Category, string>> = {
  Utilities: 'kWh',
  Telecom: 'GB',
};

/** Minutes recorded by a one-tap digital "Used today" when no duration is given. */
export const DEFAULT_DIGITAL_MINUTES = 30;
