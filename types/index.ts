// Central typed data model for Renewly (SPEC.md §5, §6).
// String-literal-union enums + interfaces for every entity. No `any`.

export type Category =
  | 'Streaming/OTT'
  | 'Music'
  | 'AI tools'
  | 'Cloud/Software'
  | 'Gym/Fitness'
  | 'Utilities'
  | 'Telecom'
  | 'Insurance'
  | 'Warranty'
  | 'Government document'
  | 'Membership'
  | 'Other';

export type BillingCycle =
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'one_time'
  | 'variable';

export type ItemStatus = 'active' | 'paused' | 'cancelled' | 'expired';

export type IntentFlag = 'more' | 'less' | 'neutral';

export type PaymentMethodType = 'card' | 'upi' | 'netbanking' | 'wallet' | 'cash';

export type UsageSource = 'auto' | 'manual';

export type ReminderType =
  | 'renewal'
  | 'trial_end'
  | 'bill_due'
  | 'doc_expiry'
  | 'payment_failed';

export type ReminderStatus = 'pending' | 'sent' | 'dismissed';

export type RecommendationStatus = 'active' | 'accepted' | 'dismissed';

export type RecommendationType =
  | 'trial_ending'
  | 'cancel'
  | 'duplicate'
  | 'cycle_optimization';

// --- Category-specific details (discriminated union by `kind`) ---

export interface NoDetails {
  kind: 'none';
}

export interface WarrantyDetails {
  kind: 'warranty';
  product?: string;
  brand?: string;
  purchaseDate?: string; // ISO yyyy-mm-dd
  warrantyMonths?: number;
}

export interface DocumentDetails {
  kind: 'document';
  docType?: string;
  issuingAuthority?: string;
  maskedIdNumber?: string; // never a full ID number (SPEC §8)
  issueDate?: string;
  expiryDate?: string;
}

export interface UtilityDetails {
  kind: 'utility';
  biller?: string;
  accountNumber?: string;
  dueDate?: string;
}

export interface InsuranceDetails {
  kind: 'insurance';
  provider?: string;
  policyNumber?: string;
  premium?: number;
  coverageEndDate?: string;
  renewalDate?: string;
}

export type ItemDetails =
  | NoDetails
  | WarrantyDetails
  | DocumentDetails
  | UtilityDetails
  | InsuranceDetails;

export type DetailKind = ItemDetails['kind'];

// --- Entities ---

export interface Item {
  id: string;
  name: string;
  category: Category;
  holderName: string | null;
  paymentMethodId: string | null;
  amount: number | null;
  currency: string;
  billingCycle: BillingCycle;
  startDate: string; // ISO yyyy-mm-dd
  nextDate: string | null; // computed from startDate + billingCycle
  autoRenew: boolean;
  isFreeTrial: boolean;
  trialEndDate: string | null;
  status: ItemStatus;
  intentFlag: IntentFlag;
  notes: string | null;
  cancelUrl: string | null;
  payUrl: string | null;
  attachmentUri: string | null;
  details: ItemDetails;
  /** Per-item override of reminder lead-time days for its primary track. null = category defaults. */
  reminderLeadDays: number[] | null;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

export interface PaymentMethod {
  id: string;
  label: string;
  type: PaymentMethodType;
  last4: string | null; // up to 4 digits — never the full number/CVV (SPEC §8)
  holderName: string | null;
}

export interface UsageLog {
  id: string;
  itemId: string;
  date: string;
  value: number;
  /** Display unit for consumption logs (e.g. "kWh", "GB"). null for digital/check-in. */
  unit: string | null;
  source: UsageSource;
}

export interface Reminder {
  id: string;
  itemId: string;
  triggerDate: string;
  leadTimeDays: number;
  type: ReminderType;
  status: ReminderStatus;
  notificationId: string | null;
}

export interface Recommendation {
  id: string;
  itemId: string;
  type: RecommendationType;
  reason: string;
  estimatedSavings: number | null;
  status: RecommendationStatus;
}

// --- Input shapes for the data-access layer ---

export type NewItemInput = Omit<
  Item,
  'id' | 'nextDate' | 'createdAt' | 'updatedAt' | 'reminderLeadDays'
>;
export type ItemPatch = Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt'>>;

export type NewUsageLogInput = Omit<UsageLog, 'id'>;

export type NewPaymentMethodInput = Omit<PaymentMethod, 'id'>;
export type PaymentMethodPatch = Partial<Omit<PaymentMethod, 'id'>>;

export type NewRecommendationInput = Omit<Recommendation, 'id'>;
/** A proposed recommendation from a rule, before persistence assigns id/status. */
export type ProposedRecommendation = Omit<Recommendation, 'id' | 'status'>;

// --- Generic option type for selects ---

export interface Option<T> {
  label: string;
  value: T;
}
