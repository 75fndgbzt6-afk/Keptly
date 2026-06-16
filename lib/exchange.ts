// Currency conversion. The app uses ONE global currency (see lib/currency.ts);
// when the user switches it, every stored amount is converted once via these
// rates so all downstream math/display stays in a single currency.
//
// Rates are approximate static values (units of each currency per 1 USD). They
// are fine for a personal tracker; swap in a live feed later if needed. Any
// currency missing here converts 1:1 (no silent zeroing).

const RATES_PER_USD: Record<string, number> = {
  USD: 1,
  INR: 86,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
};

/** Multiplier to convert an amount FROM one currency TO another. */
export function conversionFactor(from: string, to: string): number {
  if (from === to) return 1;
  const fromRate = RATES_PER_USD[from];
  const toRate = RATES_PER_USD[to];
  if (!fromRate || !toRate) return 1; // unknown currency → leave the value unchanged
  return toRate / fromRate;
}

/** Convert a single amount from one currency to another, rounded to 2 dp. */
export function convertAmount(amount: number, from: string, to: string): number {
  const converted = amount * conversionFactor(from, to);
  return Math.round(converted * 100) / 100;
}
