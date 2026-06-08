// App-wide non-design configuration.

export const DEFAULT_CURRENCY = 'INR';

/**
 * Base URL of the Renewly AI backend (Cloudflare Worker).
 * Run `bash renewly-backend/deploy.sh` to deploy — it prints the URL.
 * Paste the https://renewly-api.<account>.workers.dev URL here.
 * The Anthropic API key lives only on that backend — never in the app.
 *
 * ⚠️  The worker is NOT YET DEPLOYED. AI features will silently no-op until
 *     this is replaced with the real deployed URL.
 */
export const AI_API_BASE_URL = 'https://renewly-api.example.workers.dev';

export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
};
