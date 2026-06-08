// Per-device monthly quota, backed by KV. The monetization hook lives here:
// every check first reads paidUntil for the device — if active, the cap is skipped
// entirely. Phase 9 only needs to set that value (purchase flow); no client change.
import { Env } from '../env';

const QUOTA_TTL_SECONDS = 60 * 60 * 24 * 40; // ~40 days; monthly keys self-expire

/** Accept anonymous device IDs: 8–100 chars of [A-Za-z0-9-] (UUIDs qualify). */
export function isValidDeviceId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9-]{8,100}$/.test(id);
}

function monthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function quotaKey(deviceId: string): string {
  return `quota:${deviceId}:${monthKey()}`;
}

function paidKey(deviceId: string): string {
  return `paid:${deviceId}`;
}

/** First instant of next month (UTC), ISO — when the free counter resets. */
function resetsAt(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

/** Monetization hook: a future paid tier writes an ISO timestamp to paid:<id>. */
export async function isPaid(env: Env, deviceId: string): Promise<boolean> {
  const raw = await env.QUOTA.get(paidKey(deviceId));
  if (!raw) return false;
  const until = Date.parse(raw);
  return !Number.isNaN(until) && until > Date.now();
}

async function getUsed(env: Env, deviceId: string): Promise<number> {
  const raw = await env.QUOTA.get(quotaKey(deviceId));
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isNaN(n) ? 0 : n;
}

export interface QuotaStatus {
  used: number;
  limit: number; // -1 means unlimited (paid)
  resetsAt: string;
  paid: boolean;
}

export async function getQuota(env: Env, deviceId: string): Promise<QuotaStatus> {
  const [used, paid] = await Promise.all([getUsed(env, deviceId), isPaid(env, deviceId)]);
  const limit = paid ? -1 : parseInt(env.MONTHLY_QUOTA, 10) || 50;
  return { used, limit, resetsAt: resetsAt(), paid };
}

/** Allowed when paid, or when the free counter is below the cap. */
export async function checkQuota(
  env: Env,
  deviceId: string,
): Promise<{ ok: true } | { ok: false; resetsAt: string }> {
  if (await isPaid(env, deviceId)) return { ok: true };
  const used = await getUsed(env, deviceId);
  const limit = parseInt(env.MONTHLY_QUOTA, 10) || 50;
  if (used >= limit) return { ok: false, resetsAt: resetsAt() };
  return { ok: true };
}

/** Increment the monthly counter after a successful AI call. Paid devices uncounted. */
export async function consumeQuota(env: Env, deviceId: string): Promise<void> {
  if (await isPaid(env, deviceId)) return;
  const used = await getUsed(env, deviceId);
  await env.QUOTA.put(quotaKey(deviceId), String(used + 1), {
    expirationTtl: QUOTA_TTL_SECONDS,
  });
}
