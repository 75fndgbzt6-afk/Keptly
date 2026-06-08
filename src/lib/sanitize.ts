// Defense-in-depth redaction. The app already strips sensitive values, but the
// backend strips again before anything reaches Anthropic and before responses go
// back — long digit runs (card numbers 13–19 digits, Aadhaar 12, etc.) become
// [redacted]. Short numbers (amounts, years, last-4) are left intact.

const LONG_NUMBER = /(?:\d[ -]?){9,}\d/g;

/** Replace any 9+ digit sequence (optionally space/dash grouped) with [redacted]. */
export function redactSensitive(text: string): string {
  return text.replace(LONG_NUMBER, '[redacted]');
}

/** Recursively redact string fields in a parsed object (output safety net). */
export function redactObject<T>(value: T): T {
  if (typeof value === 'string') return redactSensitive(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => redactObject(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactObject(v);
    return out as T;
  }
  return value;
}
