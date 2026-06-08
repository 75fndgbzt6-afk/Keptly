import { Env } from '../env';
import { json, quotaExceeded, upstreamError, badRequest } from '../lib/http';
import { isValidDeviceId, checkQuota, consumeQuota } from '../lib/quota';
import { cacheKey, cacheGet, cacheSet } from '../lib/cache';
import { callClaudeText, imageContent, UpstreamError } from '../lib/anthropic';
import { redactObject } from '../lib/sanitize';
import { toParseResult } from '../lib/parse-result';
import { PARSE_IMAGE_SYSTEM } from '../prompts/parse';

const MAX_BASE64 = 7_000_000; // ~5MB image

export async function parseImage(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as
    | { imageBase64?: unknown; deviceId?: unknown }
    | null;
  if (!body || !isValidDeviceId(body.deviceId)) return badRequest(env, 'invalid_device');
  if (typeof body.imageBase64 !== 'string' || !body.imageBase64) return badRequest(env, 'missing_image');
  if (body.imageBase64.length > MAX_BASE64) return badRequest(env, 'image_too_large');

  const deviceId = body.deviceId;
  // Strip a possible data-URL prefix.
  const base64 = body.imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const quota = await checkQuota(env, deviceId);
  if (!quota.ok) return quotaExceeded(env, quota.resetsAt);

  const key = await cacheKey('parse-image', base64);
  const cached = await cacheGet(env, key);
  if (cached) return json(cached, env);

  try {
    const out = await callClaudeText(env, {
      model: env.MODEL_HAIKU,
      system: PARSE_IMAGE_SYSTEM,
      content: imageContent(base64, 'Extract the subscription or bill details as JSON.'),
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
