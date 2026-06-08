import { Env } from '../env';
import { json, quotaExceeded, upstreamError, badRequest } from '../lib/http';
import { isValidDeviceId, checkQuota, consumeQuota } from '../lib/quota';
import { callClaudeText, UpstreamError } from '../lib/anthropic';
import { redactSensitive } from '../lib/sanitize';
import { NARRATE_SYSTEM } from '../prompts/narrate';

export async function narrate(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as
    | { recommendationData?: unknown; deviceId?: unknown }
    | null;
  if (!body || !isValidDeviceId(body.deviceId)) return badRequest(env, 'invalid_device');
  if (!body.recommendationData || typeof body.recommendationData !== 'object') {
    return badRequest(env, 'missing_recommendation');
  }

  const deviceId = body.deviceId;
  const payload = redactSensitive(JSON.stringify(body.recommendationData)).slice(0, 2000);

  const quota = await checkQuota(env, deviceId);
  if (!quota.ok) return quotaExceeded(env, quota.resetsAt);

  try {
    const text = await callClaudeText(env, {
      model: env.MODEL_SONNET,
      system: NARRATE_SYSTEM,
      content: payload,
      maxTokens: 512,
    });
    await consumeQuota(env, deviceId);
    return json({ text }, env);
  } catch (err) {
    if (err instanceof UpstreamError) return upstreamError(env);
    return upstreamError(env);
  }
}
