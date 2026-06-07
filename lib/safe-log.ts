// Safe logging. Sensitive values (full IDs, card numbers, document contents) must
// never reach the console or any sink (SPEC §8). Route any necessary logging
// through here; it deep-strips known-sensitive fields before printing, and only
// prints at all in development.

/** Field names whose values are redacted wherever they appear in a logged object. */
const SENSITIVE_KEYS = new Set([
  'idExtra',
  'idFull',
  'idNumber',
  'fullId',
  'cardNumber',
  'cardnumber',
  'cvv',
  'pan',
  'aadhaar',
  'aadhar',
  'passportNumber',
  'policyNumber',
  'accountNumber',
  'secret',
  'password',
  'token',
]);

const REDACTED = '[redacted]';

/** Recursively copy a value, replacing any sensitive field's value with [redacted]. */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return '[circular]';
  seen.add(value as object);

  if (Array.isArray(value)) return value.map((v) => redact(v, seen));

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEYS.has(key) ? REDACTED : redact(v, seen);
  }
  return out;
}

/** Dev-only, sensitive-stripped console.log. No-op in production builds. */
export function safeLog(message: string, data?: unknown): void {
  if (!__DEV__) return;
  if (data === undefined) {
    console.log(message);
  } else {
    console.log(message, redact(data));
  }
}

/** Dev-only, sensitive-stripped console.warn. No-op in production builds. */
export function safeWarn(message: string, data?: unknown): void {
  if (!__DEV__) return;
  if (data === undefined) {
    console.warn(message);
  } else {
    console.warn(message, redact(data));
  }
}
