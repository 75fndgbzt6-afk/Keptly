// Coerce the model's JSON text into a strict ParseResult. Tolerant of stray prose
// or code fences; falls back to { error: 'unparseable' } on anything unexpected.
import { ParseResult, ParsedEntry } from '../env';

const CYCLES = ['weekly', 'monthly', 'quarterly', 'yearly', 'one_time', 'variable'] as const;

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function toParseResult(modelText: string): ParseResult {
  const obj = extractJson(modelText);
  if (!obj || typeof obj !== 'object') return { error: 'unparseable' };
  const o = obj as Record<string, unknown>;
  if (o.error === 'unparseable') return { error: 'unparseable' };

  const name = typeof o.name === 'string' ? o.name.trim() : '';
  if (!name) return { error: 'unparseable' };

  const cycle = CYCLES.includes(o.billingCycle as (typeof CYCLES)[number])
    ? (o.billingCycle as ParsedEntry['billingCycle'])
    : 'monthly';

  return {
    name,
    amount: typeof o.amount === 'number' && Number.isFinite(o.amount) ? o.amount : null,
    currency: typeof o.currency === 'string' && o.currency.trim() ? o.currency.trim() : 'INR',
    category: typeof o.category === 'string' && o.category.trim() ? o.category.trim() : 'Other',
    billingCycle: cycle,
    isFreeTrial: o.isFreeTrial === true,
    startDate:
      typeof o.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.startDate)
        ? o.startDate
        : null,
    notes: typeof o.notes === 'string' && o.notes.trim() ? o.notes.trim() : null,
  };
}
