// Renewly AI Assist backend — Cloudflare Worker fronting Claude.
// Each route: validate deviceId → check quota → (cache) → Anthropic → consume → respond.
import { Env } from './env';
import { corsHeaders, json } from './lib/http';
import { parseEntry } from './routes/parseEntry';
import { parseImage } from './routes/parseImage';
import { narrate } from './routes/narrate';
import { chat } from './routes/chat';
import { quota } from './routes/quota';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    const { pathname } = new URL(req.url);

    try {
      if (req.method === 'POST' && pathname === '/v1/parse-entry') return await parseEntry(req, env);
      if (req.method === 'POST' && pathname === '/v1/parse-image') return await parseImage(req, env);
      if (req.method === 'POST' && pathname === '/v1/narrate-recommendation') return await narrate(req, env);
      if (req.method === 'POST' && pathname === '/v1/chat') return await chat(req, env);
      if (req.method === 'GET' && pathname === '/v1/quota') return await quota(req, env);
      if (req.method === 'GET' && pathname === '/') return json({ ok: true, service: 'renewly-api' }, env);
      return json({ error: 'not_found' }, env, 404);
    } catch {
      // Never leak internals.
      return json({ error: 'internal_error', retryable: true }, env, 500);
    }
  },
} satisfies ExportedHandler<Env>;
