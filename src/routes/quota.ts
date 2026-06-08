import { Env } from '../env';
import { json, badRequest } from '../lib/http';
import { isValidDeviceId, getQuota } from '../lib/quota';

export async function quota(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const deviceId = url.searchParams.get('deviceId');
  if (!isValidDeviceId(deviceId)) return badRequest(env, 'invalid_device');

  const status = await getQuota(env, deviceId);
  return json(
    { used: status.used, limit: status.limit, resetsAt: status.resetsAt, paid: status.paid },
    env,
  );
}
