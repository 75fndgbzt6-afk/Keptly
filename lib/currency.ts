// Pure currency formatting. All amount display goes through here (SPEC §10).
import { CURRENCY_SYMBOLS, DEFAULT_CURRENCY } from '@/constants/config';

/** Indian-style digit grouping: 12,34,567 (last 3, then groups of 2). */
function groupIndian(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits;
  const last3 = intDigits.slice(-3);
  const rest = intDigits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/**
 * Format a numeric amount with a currency symbol (₹ for the INR default).
 * Drops trailing ".00"; keeps paise when present.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return `${symbol}—`;
  }

  const negative = amount < 0;
  const fixed = Math.abs(amount).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const grouped = groupIndian(intPart);
  const decimals = decPart === '00' ? '' : `.${decPart}`;
  return `${negative ? '-' : ''}${symbol}${grouped}${decimals}`;
}
