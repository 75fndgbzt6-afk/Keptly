// Centralized select-option lists + display labels for the enums in §5.
import {
  BillingCycle,
  IntentFlag,
  ItemStatus,
  Option,
  PaymentMethodType,
} from '@/types';

export const BILLING_CYCLE_OPTIONS: Option<BillingCycle>[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
  { label: 'One-time', value: 'one_time' },
  { label: 'Variable', value: 'variable' },
];

export const BILLING_CYCLE_SHORT: Record<BillingCycle, string> = {
  weekly: '/wk',
  monthly: '/mo',
  quarterly: '/qtr',
  yearly: '/yr',
  one_time: '',
  variable: '',
};

export const STATUS_OPTIONS: Option<ItemStatus>[] = [
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Expired', value: 'expired' },
];

export const STATUS_LABELS: Record<ItemStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export const INTENT_OPTIONS: Option<IntentFlag>[] = [
  { label: 'Neutral', value: 'neutral' },
  { label: 'Want to use more', value: 'more' },
  { label: 'Want to use less', value: 'less' },
];

export const INTENT_LABELS: Record<IntentFlag, string> = {
  neutral: 'Neutral',
  more: 'Want to use more',
  less: 'Want to use less',
};

export const PAYMENT_TYPE_OPTIONS: Option<PaymentMethodType>[] = [
  { label: 'Card', value: 'card' },
  { label: 'UPI', value: 'upi' },
  { label: 'Net banking', value: 'netbanking' },
  { label: 'Wallet', value: 'wallet' },
  { label: 'Cash', value: 'cash' },
];

export const PAYMENT_TYPE_LABELS: Record<PaymentMethodType, string> = {
  card: 'Card',
  upi: 'UPI',
  netbanking: 'Net banking',
  wallet: 'Wallet',
  cash: 'Cash',
};

export type SortKey = 'next_date' | 'amount' | 'name';

export const SORT_OPTIONS: Option<SortKey>[] = [
  { label: 'Next date', value: 'next_date' },
  { label: 'Amount', value: 'amount' },
  { label: 'Name', value: 'name' },
];

// Common government document types (SPEC §6). Free text also allowed.
export const DOC_TYPES = [
  'Passport',
  'Driving License',
  'Vehicle RC',
  'Voter ID',
  'PAN',
  'Aadhaar',
  'Other',
];

/**
 * Mask an identifier so a full ID number is never stored (SPEC §8).
 * Keeps only the last 4 characters, prefixed with bullets.
 */
export function maskIdNumber(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 4) return trimmed;
  return `•••• ${trimmed.slice(-4)}`;
}

/** Keep only up to 4 digits for a card/account "last 4" (SPEC §8). */
export function sanitizeLast4(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4);
}
