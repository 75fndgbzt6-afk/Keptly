// The only module that talks to Anthropic. Uses the official SDK. The system
// prompt carries a cache_control breakpoint (prompt caching). Any upstream failure
// is rethrown as UpstreamError so routes can return a generic 503 without leaking.
import Anthropic from '@anthropic-ai/sdk';
import { Env } from '../env';

/** Thrown on any Anthropic failure; the route maps it to a generic 503. */
export class UpstreamError extends Error {}

type UserContent = string | Anthropic.ContentBlockParam[];

interface CallOptions {
  model: string;
  system: string;
  content: UserContent;
  maxTokens: number;
}

/** Single text completion. System prompt is cached; returns the concatenated text. */
export async function callClaudeText(env: Env, opts: CallOptions): Promise<string> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const message = await client.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens,
      system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: opts.content }],
    });
    return message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
  } catch (err) {
    throw new UpstreamError(err instanceof Error ? err.message : 'upstream error');
  }
}

/** Build a vision user-content array from base64 image data. */
export function imageContent(base64: string, prompt: string, mediaType = 'image/jpeg'): Anthropic.ContentBlockParam[] {
  return [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: base64,
      },
    },
    { type: 'text', text: prompt },
  ];
}
