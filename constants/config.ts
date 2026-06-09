// App-wide non-design configuration.

export const DEFAULT_CURRENCY = 'INR';

/**
 * Base URL of the Renewly AI backend (Cloudflare Worker).
 * Deployed at: https://renewly-api.keptly.workers.dev
 * The Anthropic API key lives only on that backend — never in the app.
 */
export const AI_API_BASE_URL = 'https://renewly-api.keptly.workers.dev';

export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
};
