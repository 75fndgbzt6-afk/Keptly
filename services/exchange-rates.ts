// Live exchange rates. Loads cached rates first (instant + offline), then does
// a best-effort fetch from a free, no-key endpoint to refresh them. Rates feed
// lib/exchange.ts, which converts stored amounts when the user switches the
// app's global currency. Always falls back to the baked-in static rates.
import { setRates, STATIC_RATES_PER_USD } from '@/lib/exchange';
import { CURRENCY_SYMBOLS } from '@/constants/config';
import { getSetting, setSetting } from '@/db/settings';

const CACHE_KEY = 'exchange_rates';
// Free, no-API-key endpoint. Returns { result, rates: { USD:1, INR:..., ... } }.
const RATES_URL = 'https://open.er-api.com/v6/latest/USD';
const FETCH_TIMEOUT_MS = 6000;

interface CachedRates {
  rates: Record<string, number>;
  fetchedAt: string; // ISO
}

/** Currencies the app supports — we only keep these from the API response. */
const SUPPORTED = Object.keys(CURRENCY_SYMBOLS);

function pickSupported(all: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const code of SUPPORTED) {
    if (typeof all[code] === 'number' && all[code] > 0) out[code] = all[code];
  }
  return out;
}

/** Load cached rates into lib/exchange (fast, offline). Safe to call on startup. */
async function loadCachedRates(): Promise<void> {
  try {
    const raw = await getSetting(CACHE_KEY);
    if (!raw) return;
    const cached = JSON.parse(raw) as CachedRates;
    if (cached?.rates) setRates(cached.rates);
  } catch {
    // Corrupt cache → ignore; static fallback stays in effect.
  }
}

/** Best-effort live fetch. Updates lib/exchange + persists the cache. */
export async function refreshRates(): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(RATES_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return;

    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (data.result !== 'success' || !data.rates) return;

    const rates = pickSupported(data.rates);
    if (Object.keys(rates).length < 2) return; // need at least USD + one more

    setRates(rates);
    await setSetting(CACHE_KEY, JSON.stringify({ rates, fetchedAt: new Date().toISOString() }));
  } catch {
    // Offline / timeout / bad response → keep cached or static rates.
  }
}

/**
 * Startup hook: apply cached rates immediately, then refresh in the background.
 * Never throws and never blocks on the network (the fetch is fire-and-forget).
 */
export async function initExchangeRates(): Promise<void> {
  await loadCachedRates();
  void refreshRates();
}

export { STATIC_RATES_PER_USD };
