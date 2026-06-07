// Pure, unit-testable masking for sensitive identifiers (SPEC §8). These take a
// FULL value and return the masked display form; the full value itself is only
// ever kept in expo-secure-store, never in a regular table. No I/O here.
import { Item } from '@/types';

const MASK = 'X';
const BULLET = '•';

/** Strip everything but [A-Za-z0-9] and upper-case — IDs are case-insensitive. */
function normalize(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** Keep the first `start` and last `end` chars; mask the middle. Short values pass through. */
function maskMiddle(value: string, start: number, end: number): string {
  if (value.length <= start + end) return value;
  const middle = MASK.repeat(value.length - start - end);
  return `${value.slice(0, start)}${middle}${end > 0 ? value.slice(-end) : ''}`;
}

/** Card / account: only the last 4 are ever known. e.g. "•••• 1234". */
export function maskCardLast4(last4: string | null | undefined): string {
  const tail = (last4 ?? '').replace(/\D/g, '').slice(-4);
  return tail ? `${BULLET.repeat(4)} ${tail}` : `${BULLET.repeat(4)}`;
}

/** Aadhaar (12 digits) → "XXXX XXXX 1234" (last 4 shown, grouped in fours). */
export function maskAadhaar(raw: string): string {
  const v = normalize(raw);
  if (v.length < 5) return v;
  const last4 = v.slice(-4);
  const hiddenGroups = Math.ceil((v.length - 4) / 4);
  const masked = Array.from({ length: hiddenGroups }, () => MASK.repeat(4));
  return [...masked, last4].join(' ');
}

/** PAN (ABCDE1234F) → "XXXXX1234X" (only the 4 middle digits shown). */
export function maskPan(raw: string): string {
  const v = normalize(raw);
  if (v.length !== 10) return maskMiddle(v, 2, 2); // graceful fallback
  return `${MASK.repeat(5)}${v.slice(5, 9)}${MASK}`;
}

/** Passport (1 letter + digits) → "A12XXXXX" (first 3 shown). */
export function maskPassport(raw: string): string {
  const v = normalize(raw);
  if (v.length <= 3) return v;
  return `${v.slice(0, 3)}${MASK.repeat(v.length - 3)}`;
}

/** Driving License / Voter ID / generic doc → first 2 + last 2 shown. */
export function maskFirst2Last2(raw: string): string {
  return maskMiddle(normalize(raw), 2, 2);
}

/** Dispatch to the right masking style for a document type (free text tolerated). */
export function documentMask(docType: string | undefined, raw: string): string {
  const t = (docType ?? '').toLowerCase();
  if (t.includes('aadhaar') || t.includes('aadhar')) return maskAadhaar(raw);
  if (t.includes('pan')) return maskPan(raw);
  if (t.includes('passport')) return maskPassport(raw);
  // Driving License, Voter ID, Vehicle RC, Other, and anything else.
  return maskFirst2Last2(raw);
}

/**
 * The masked ID string to display for a document item, or null when none is set.
 * The masked form is what we persist in the item's details; the full value lives
 * only in secure store and is reached via the Reveal flow (requireUnlock).
 */
export function documentDisplayId(item: Item): string | null {
  if (item.details.kind !== 'document') return null;
  const masked = item.details.maskedIdNumber?.trim();
  return masked ? masked : null;
}
