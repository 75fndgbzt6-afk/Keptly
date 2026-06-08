// HTTP helpers: CORS, JSON responses, and a generic upstream-error response that
// never leaks Anthropic's message (returns a generic retryable 503).
import { Env } from '../env';

export function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export function json(data: unknown, env: Env, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

/** 429 — quota exhausted. */
export function quotaExceeded(env: Env, resetsAt: string): Response {
  return json({ error: 'quota_exceeded', resetsAt }, env, 429);
}

/** 503 — generic upstream failure. Never includes the upstream message. */
export function upstreamError(env: Env): Response {
  return json({ error: 'unavailable', retryable: true }, env, 503);
}

export function badRequest(env: Env, message = 'invalid_request'): Response {
  return json({ error: message }, env, 400);
}
