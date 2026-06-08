// Shared types for the AI surface. These mirror the backend's response shapes.
import { BillingCycle } from '@/types';

/** Structured fields the backend extracts from text or an image. */
export interface ParsedEntry {
  name: string;
  amount: number | null;
  currency: string;
  category: string;
  billingCycle: BillingCycle;
  isFreeTrial: boolean;
  startDate: string | null;
  notes: string | null;
}

export type ParseResult = ParsedEntry | { error: 'unparseable' };

export interface QuotaStatus {
  used: number;
  limit: number; // -1 = unlimited (paid)
  resetsAt: string;
  paid: boolean;
}

/** A single chat turn, persisted locally. */
export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

// --- Financial digest (chat context). Inflows-ready: only 'out' flows exist
// today; income ('in') slots in for v2 with no schema change. Sanitized — no
// names, IDs, scan paths, or payment-method labels (type only). ---

export interface DigestFlow {
  direction: 'out' | 'in';
  label: string; // a generic label (item name) — safe to send; no IDs/secrets
  category: string;
  monthlyAmount: number;
  costPerUse: number | null;
  usageTrend: 'up' | 'down' | 'flat' | null;
  intent: 'more' | 'less' | 'neutral';
}

export interface FinancialDigest {
  currency: string;
  flows: DigestFlow[];
  totals: { monthlyOut: number; monthlyIn: number; net: number };
}
