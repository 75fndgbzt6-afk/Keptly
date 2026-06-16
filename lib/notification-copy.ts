// All notification copy lives here so the tone can be reviewed in one place.
// Calm and informative, never alarmist. Amounts go through formatCurrency.
import { Item, ReminderType } from '@/types';
import { formatCurrency } from './currency';

/** "today" / "tomorrow" / "in N days" for a lead-time in days. */
function leadPhrase(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

export interface NotificationContent {
  title: string;
  body: string;
}

/**
 * Build the title + body for a single reminder.
 * Examples:
 *  renewal:   "Netflix renews in 7 days for ₹649."
 *  trial_end: "Spotify free trial ends tomorrow — you'll be charged ₹119."
 *  bill_due:  "Electricity bill due in 3 days."
 *  doc_expiry:"Passport expires in 90 days."
 */
export function notificationContent(
  item: Item,
  type: ReminderType,
  leadTimeDays: number,
): NotificationContent {
  const when = leadPhrase(leadTimeDays);
  const amount =
    item.amount !== null && item.amount !== undefined
      ? formatCurrency(item.amount)
      : null;

  switch (type) {
    case 'renewal':
      return {
        title: 'Upcoming renewal',
        body: amount
          ? `${item.name} renews ${when} for ${amount}.`
          : `${item.name} renews ${when}.`,
      };
    case 'trial_end':
      return {
        title: 'Free trial ending',
        body: amount
          ? `${item.name} free trial ends ${when} — you'll be charged ${amount}.`
          : `${item.name} free trial ends ${when}.`,
      };
    case 'bill_due':
      return {
        title: 'Bill due soon',
        body: `${item.name} bill due ${when}.`,
      };
    case 'doc_expiry':
      return {
        title: 'Document expiring',
        body: `${item.name} expires ${when}.`,
      };
    case 'payment_failed':
    default:
      return {
        title: 'Heads up',
        body: `${item.name} needs your attention.`,
      };
  }
}

/** Short human label for a reminder type (used in the Notifications Center). */
export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  renewal: 'Renewal',
  trial_end: 'Trial ending',
  bill_due: 'Bill due',
  doc_expiry: 'Document expiry',
  payment_failed: 'Payment issue',
};

/** Notification action button labels + category, in one place for review. */
export const NOTIFICATION_CATEGORY_ID = 'renewly.reminder';

export const ACTION_IDS = {
  done: 'MARK_DONE',
  snooze: 'SNOOZE_1D',
  open: 'OPEN',
} as const;

export const ACTION_LABELS = {
  done: 'Mark done',
  snooze: 'Snooze 1 day',
  open: 'Open',
} as const;

export type ActionId = (typeof ACTION_IDS)[keyof typeof ACTION_IDS];
