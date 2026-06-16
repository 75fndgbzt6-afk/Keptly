// Pure currency formatting. All amount display goes through here (SPEC §10).
import { CURRENCY_SYMBOLS, DEFAULT_CURRENCY } from '@/constants/config';

/**
 * The user's active default currency. Aggregate displays (dashboard totals,
 * insights, recommendations) carry no per-item currency, so they format in
 * this. The preferences store keeps it in sync via setActiveCurrency(), which
 * lets this pure formatter honour the user's choice without importing the store.
 */
let activeCurrency = DEFAULT_CURRENCY;

export function setActiveCurrency(code: string): void {
  if (code) activeCurrency = code;
}

export function getActiveCurrency(): string {
  return activeCurrency;
}

/** Indian-style digit grouping: 12,34,567 (last 3, then groups of 2). */
function groupIndian(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits;
  const last3 = intDigits.slice(-3);
  const rest = intDigits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** Standard Western grouping: 1,234,567 (groups of 3). */
function groupStandard(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format a numeric amount with its currency symbol. INR uses Indian grouping;
 * every other currency uses standard thousands grouping. Drops trailing ".00";
 * keeps decimals when present. When no currency is passed, the user's active
 * default currency is used (not a hard-coded ₹).
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = activeCurrency,
): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return `${symbol}—`;
  }

  const negative = amount < 0;
  const fixed = Math.abs(amount).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const grouped = currency === 'INR' ? groupIndian(intPart) : groupStandard(intPart);
  const decimals = decPart === '00' ? '' : `.${decPart}`;
  return `${negative ? '-' : ''}${symbol}${grouped}${decimals}`;
}
