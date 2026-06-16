// Currency conversion. The app uses ONE global currency (see lib/currency.ts);
// when the user switches it, every stored amount is converted once via these
// rates so all downstream math/display stays in a single currency.
//
// Rates are units of each currency per 1 USD. The STATIC table below is the
// offline fallback (baked in); at runtime it's replaced by live rates fetched
// + cached by services/exchange-rates.ts. Any currency missing here converts
// 1:1 (no silent zeroing).

/** Baked-in fallback rates (per 1 USD). Used until live/cached rates load. */
export const STATIC_RATES_PER_USD: Record<string, number> = {
  USD: 1,
  INR: 86,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
};

// Mutable active rates — starts at the static fallback, updated by setRates().
let ratesPerUsd: Record<string, number> = { ...STATIC_RATES_PER_USD };

/** Replace the active rates (e.g. with live values). Missing keys keep their fallback. */
export function setRates(rates: Record<string, number>): void {
  ratesPerUsd = { ...STATIC_RATES_PER_USD, ...rates };
}

export function getRates(): Record<string, number> {
  return ratesPerUsd;
}

/** Multiplier to convert an amount FROM one currency TO another. */
export function conversionFactor(from: string, to: string): number {
  if (from === to) return 1;
  const fromRate = ratesPerUsd[from];
  const toRate = ratesPerUsd[to];
  if (!fromRate || !toRate) return 1; // unknown currency → leave the value unchanged
  return toRate / fromRate;
}

/** Convert a single amount from one currency to another, rounded to 2 dp. */
export function convertAmount(amount: number, from: string, to: string): number {
  const converted = amount * conversionFactor(from, to);
  return Math.round(converted * 100) / 100;
}
