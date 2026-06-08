// Worker bindings + environment. Set ANTHROPIC_API_KEY via `wrangler secret put`.
export interface Env {
  // KV namespaces
  QUOTA: KVNamespace;
  CACHE: KVNamespace;
  // Secret
  ANTHROPIC_API_KEY: string;
  // Vars (strings — Workers env vars are always strings)
  MONTHLY_QUOTA: string;
  MODEL_HAIKU: string;
  MODEL_SONNET: string;
  ALLOWED_ORIGIN: string;
}

/** Structured fields parsed from a natural-language entry or a receipt image. */
export interface ParsedEntry {
  name: string;
  amount: number | null;
  currency: string;
  category: string;
  billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one_time' | 'variable';
  isFreeTrial: boolean;
  startDate: string | null; // ISO yyyy-mm-dd
  notes: string | null;
}

export type ParseResult = ParsedEntry | { error: 'unparseable' };
