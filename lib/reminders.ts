// Pure reminder-ladder logic. No expo-notifications, no DB — just date math.
// The notification service consumes these to schedule/persist reminders.
import { BillingCycle, Item, ReminderType } from '@/types';
import { isoDateTimeAtHour } from './date';

/** Hour of day (local) at which reminders fire. */
export const NOTIFY_HOUR = 9;

/** Default lead-time ladders per reminder type (SPEC §7). */
export const DEFAULT_LEAD_DAYS: Record<ReminderType, number[]> = {
  renewal: [30, 14, 7, 1],
  doc_expiry: [90, 30, 7],
  bill_due: [7, 3, 1],
  trial_end: [1, 0], // 24h before + same day
  payment_failed: [],
};

const RECURRING_CYCLES: BillingCycle[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

export function isRecurring(cycle: BillingCycle): boolean {
  return RECURRING_CYCLES.includes(cycle);
}

/** The item's primary reminder track — the one whose lead times are user-editable. */
export function primaryTrackType(item: Item): ReminderType | null {
  if (item.details.kind === 'document' && item.details.expiryDate) return 'doc_expiry';
  if (item.details.kind === 'utility' && item.details.dueDate) return 'bill_due';
  if (isRecurring(item.billingCycle) && item.nextDate) return 'renewal';
  return null;
}

/** The date a given track counts back from, if any. */
function anchorDateForType(item: Item, type: ReminderType): string | null {
  switch (type) {
    case 'renewal':
      return item.nextDate;
    case 'doc_expiry':
      return item.details.kind === 'document' ? item.details.expiryDate ?? null : null;
    case 'bill_due':
      return item.details.kind === 'utility' ? item.details.dueDate ?? null : null;
    case 'trial_end':
      return item.isFreeTrial ? item.trialEndDate : null;
    case 'payment_failed':
    default:
      return null;
  }
}

/** Lead-time days for the primary track: per-item override if set, else the default. */
export function leadDaysForItem(item: Item): number[] {
  const type = primaryTrackType(item);
  if (!type) return [];
  return item.reminderLeadDays ?? DEFAULT_LEAD_DAYS[type];
}

export interface ReminderTrack {
  type: ReminderType;
  anchorDate: string;
  leadDays: number[];
}

/** Every reminder track an item needs (primary + trial-end add-on). */
export function reminderTracksForItem(item: Item): ReminderTrack[] {
  const tracks: ReminderTrack[] = [];

  const primary = primaryTrackType(item);
  if (primary) {
    const anchor = anchorDateForType(item, primary);
    if (anchor) {
      tracks.push({
        type: primary,
        anchorDate: anchor,
        leadDays: item.reminderLeadDays ?? DEFAULT_LEAD_DAYS[primary],
      });
    }
  }

  // Trial-end is an independent track with fixed lead times.
  if (primary !== 'trial_end' && item.isFreeTrial && item.trialEndDate) {
    tracks.push({
      type: 'trial_end',
      anchorDate: item.trialEndDate,
      leadDays: DEFAULT_LEAD_DAYS.trial_end,
    });
  }

  return tracks;
}

export interface ComputedTrigger {
  type: ReminderType;
  anchorDate: string;
  leadTimeDays: number;
  fireAt: Date;
}

/** All future triggers for an item (caller filters by window / cap). */
export function computeTriggers(item: Item, from: Date = new Date()): ComputedTrigger[] {
  const triggers: ComputedTrigger[] = [];
  for (const track of reminderTracksForItem(item)) {
    for (const lead of track.leadDays) {
      const fireAt = isoDateTimeAtHour(track.anchorDate, NOTIFY_HOUR, -lead);
      if (fireAt.getTime() > from.getTime()) {
        triggers.push({
          type: track.type,
          anchorDate: track.anchorDate,
          leadTimeDays: lead,
          fireAt,
        });
      }
    }
  }
  return triggers.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}
