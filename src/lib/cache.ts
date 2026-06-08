// Parse-result cache (KV). Keyed by a SHA-256 of route + normalized input, so the
// same text/image returns instantly and without spending an Anthropic call.
import { Env } from '../env';

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function cacheKey(route: string, input: string): Promise<string> {
  return `cache:${route}:${await sha256(input)}`;
}

export async function cacheGet<T>(env: Env, key: string): Promise<T | null> {
  const raw = await env.CACHE.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(env: Env, key: string, value: unknown): Promise<void> {
  await env.CACHE.put(key, JSON.stringify(value), { expirationTtl: CACHE_TTL_SECONDS });
}
