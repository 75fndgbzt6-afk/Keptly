import { Env } from '../env';
import { json, quotaExceeded, upstreamError, badRequest } from '../lib/http';
import { isValidDeviceId, checkQuota, consumeQuota } from '../lib/quota';
import { callClaudeText, UpstreamError } from '../lib/anthropic';
import { redactSensitive } from '../lib/sanitize';
import { CHAT_SYSTEM } from '../prompts/chat';

export async function chat(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as
    | { query?: unknown; financialDigest?: unknown; deviceId?: unknown }
    | null;
  if (!body || !isValidDeviceId(body.deviceId)) return badRequest(env, 'invalid_device');
  if (typeof body.query !== 'string' || !body.query.trim()) return badRequest(env, 'missing_query');
  if (!body.financialDigest || typeof body.financialDigest !== 'object') {
    return badRequest(env, 'missing_digest');
  }

  const deviceId = body.deviceId;
  const digest = redactSensitive(JSON.stringify(body.financialDigest)).slice(0, 8000);
  const query = redactSensitive(body.query.trim()).slice(0, 500);
  const content = `Question: ${query}\n\nFinancial digest (JSON):\n${digest}`;

  const quota = await checkQuota(env, deviceId);
  if (!quota.ok) return quotaExceeded(env, quota.resetsAt);

  try {
    const answer = await callClaudeText(env, {
      model: env.MODEL_SONNET,
      system: CHAT_SYSTEM,
      content,
      maxTokens: 1024,
    });
    await consumeQuota(env, deviceId);
    return json({ answer }, env);
  } catch (err) {
    if (err instanceof UpstreamError) return upstreamError(env);
    return upstreamError(env);
  }
}
