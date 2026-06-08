import { Env } from '../env';
import { json, quotaExceeded, upstreamError, badRequest } from '../lib/http';
import { isValidDeviceId, checkQuota, consumeQuota } from '../lib/quota';
import { cacheKey, cacheGet, cacheSet } from '../lib/cache';
import { callClaudeText, UpstreamError } from '../lib/anthropic';
import { redactSensitive, redactObject } from '../lib/sanitize';
import { toParseResult } from '../lib/parse-result';
import { PARSE_ENTRY_SYSTEM } from '../prompts/parse';

export async function parseEntry(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { text?: unknown; deviceId?: unknown } | null;
  if (!body || !isValidDeviceId(body.deviceId)) return badRequest(env, 'invalid_device');
  if (typeof body.text !== 'string' || !body.text.trim()) return badRequest(env, 'missing_text');

  const deviceId = body.deviceId;
  const text = redactSensitive(body.text.trim()).slice(0, 2000);

  const quota = await checkQuota(env, deviceId);
  if (!quota.ok) return quotaExceeded(env, quota.resetsAt);

  const key = await cacheKey('parse-entry', text);
  const cached = await cacheGet(env, key);
  if (cached) return json(cached, env);

  try {
    const out = await callClaudeText(env, {
      model: env.MODEL_HAIKU,
      system: PARSE_ENTRY_SYSTEM,
      content: text,
      maxTokens: 1024,
    });
    const result = redactObject(toParseResult(out));
    await consumeQuota(env, deviceId);
    await cacheSet(env, key, result);
    return json(result, env);
  } catch (err) {
    if (err instanceof UpstreamError) return upstreamError(env);
    return upstreamError(env);
  }
}
