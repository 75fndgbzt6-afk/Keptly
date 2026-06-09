// The ONLY place the app talks to the AI backend. Every wrapper checks the opt-in
// setting first, enforces a timeout, caches parse/narrate results by input hash,
// and maps failures to friendly, typed errors. No component fetches directly.
import { AI_API_BASE_URL } from '@/constants/config';
import { ParsedEntry, ParseResult, QuotaStatus, FinancialDigest } from '@/lib/ai-types';
import { Recommendation } from '@/types';
import { useAiStore } from '@/stores/aiStore';

const PARSE_TIMEOUT = 8000;
const IMAGE_TIMEOUT = 15000;
const CHAT_TIMEOUT = 20000;

export type AiErrorCode =
  | 'disabled'
  | 'no-device'
  | 'quota'
  | 'unavailable'
  | 'unparseable'
  | 'timeout';

const FRIENDLY: Record<AiErrorCode, string> = {
  disabled: 'AI Assist is off. Turn it on in Settings.',
  'no-device': 'AI isn’t ready yet. Try again in a moment.',
  quota: 'You’ve used all your free AI actions this month.',
  unavailable: 'AI is unavailable right now. Please try again.',
  unparseable: 'I couldn’t turn that into an item. Try rephrasing.',
  timeout: 'That took too long. Please try again.',
};

export class AiError extends Error {
  code: AiErrorCode;
  constructor(code: AiErrorCode) {
    super(FRIENDLY[code]);
    this.code = code;
  }
}

// --- Local in-memory cache (per session), keyed by a stable input hash ---
const memo = new Map<string, unknown>();
function hashKey(parts: string): string {
  let h = 0;
  for (let i = 0; i < parts.length; i += 1) h = (Math.imul(31, h) + parts.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

function requireEnabled(): string {
  const { enabled, deviceId } = useAiStore.getState();
  if (!enabled) throw new AiError('disabled');
  if (!deviceId) throw new AiError('no-device');
  return deviceId;
}

async function postJson<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${AI_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'RenewlyApp/1.0' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new AiError(err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'unavailable');
  }
  clearTimeout(timer);
  if (res.status === 429) throw new AiError('quota');
  if (!res.ok) throw new AiError('unavailable');
  const data = (await res.json()) as T & { quotaUsed?: number };
  // Server embeds the exact post-increment count in every quota-consuming response.
  // This is more precise than a separate GET (avoids KV eventual-consistency lag
  // and never double-counts cached responses where quota was not consumed).
  if (typeof data.quotaUsed === 'number') {
    const current = useAiStore.getState().quota;
    if (current) {
      useAiStore.getState().setQuota({ ...current, used: data.quotaUsed });
    }
  }
  return data;
}

const VALID_CYCLES = ['weekly', 'monthly', 'quarterly', 'yearly', 'one_time', 'variable'];
function normalize(entry: ParsedEntry): ParsedEntry {
  return {
    ...entry,
    billingCycle: VALID_CYCLES.includes(entry.billingCycle) ? entry.billingCycle : 'monthly',
  };
}

/** Parse a natural-language note into structured item fields. */
export async function parseEntry(text: string): Promise<ParsedEntry> {
  const deviceId = requireEnabled();
  const key = `parse:${hashKey(text.trim().toLowerCase())}`;
  const cached = memo.get(key);
  if (cached) return cached as ParsedEntry;

  const result = await postJson<ParseResult>('/v1/parse-entry', { text, deviceId }, PARSE_TIMEOUT);
  if ('error' in result) throw new AiError('unparseable');
  const entry = normalize(result);
  memo.set(key, entry);
  return entry;
}

/** Parse a receipt/subscription image (base64, no data-URL prefix needed) into fields. */
export async function parseImage(imageBase64: string): Promise<ParsedEntry> {
  const deviceId = requireEnabled();
  const key = `image:${hashKey(imageBase64.slice(0, 256) + imageBase64.length)}`;
  const cached = memo.get(key);
  if (cached) return cached as ParsedEntry;

  const result = await postJson<ParseResult>('/v1/parse-image', { imageBase64, deviceId }, IMAGE_TIMEOUT);
  if ('error' in result) throw new AiError('unparseable');
  const entry = normalize(result);
  memo.set(key, entry);
  return entry;
}

/** Warm narration of a single recommendation; cached per recommendation id. */
export async function narrateRecommendation(rec: Recommendation): Promise<string> {
  const deviceId = requireEnabled();
  const key = `narrate:${rec.id}:${hashKey(rec.reason)}`;
  const cached = memo.get(key);
  if (cached) return cached as string;

  const recommendationData = {
    type: rec.type,
    reason: rec.reason,
    estimatedSavings: rec.estimatedSavings,
  };
  const out = await postJson<{ text: string }>(
    '/v1/narrate-recommendation',
    { recommendationData, deviceId },
    PARSE_TIMEOUT,
  );
  memo.set(key, out.text);
  return out.text;
}

/** Ask a money question grounded only in the digest. */
export async function chat(query: string, financialDigest: FinancialDigest): Promise<string> {
  const deviceId = requireEnabled();
  const out = await postJson<{ answer: string }>(
    '/v1/chat',
    { query, financialDigest, deviceId },
    CHAT_TIMEOUT,
  );
  return out.answer;
}

/** Fetch current quota (allowed even when disabled, for the Settings meter). */
export async function getQuota(): Promise<QuotaStatus | null> {
  const { deviceId } = useAiStore.getState();
  if (!deviceId) return null;
  try {
    const res = await fetch(`${AI_API_BASE_URL}/v1/quota?deviceId=${encodeURIComponent(deviceId)}`, {
      headers: { 'User-Agent': 'RenewlyApp/1.0' },
    });
    if (!res.ok) return null;
    return (await res.json()) as QuotaStatus;
  } catch {
    return null;
  }
}

/** Refresh quota into the store (best-effort). Used on app open / settings mount.
 * Real-time increments come from quotaUsed embedded in API responses, so this
 * is only needed for initial load and manual refreshes. */
export async function refreshQuota(): Promise<void> {
  const quota = await getQuota();
  if (quota) useAiStore.getState().setQuota(quota);
}

/** Dev-only: clear the in-memory parse/narrate cache. */
export function clearAiCache(): void {
  memo.clear();
}
