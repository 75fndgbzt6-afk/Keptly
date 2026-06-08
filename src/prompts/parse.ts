// Shared parse instructions for text and image entry. Structured JSON-only output.
const CATEGORIES = [
  'Streaming/OTT',
  'Music',
  'AI tools',
  'Cloud/Software',
  'Gym/Fitness',
  'Utilities',
  'Telecom',
  'Insurance',
  'Warranty',
  'Government document',
  'Membership',
  'Other',
].join(', ');

const SHAPE = `Return ONLY a JSON object (no prose, no markdown fences) with exactly these keys:
{
  "name": string,                                  // the service/bill name, e.g. "Netflix"
  "amount": number | null,                         // numeric only, no currency symbol; null if unknown
  "currency": string,                              // ISO code like "INR", "USD"; default "INR"
  "category": string,                              // one of: ${CATEGORIES}
  "billingCycle": "weekly"|"monthly"|"quarterly"|"yearly"|"one_time"|"variable",
  "isFreeTrial": boolean,
  "startDate": string | null,                      // "yyyy-mm-dd" if clearly stated, else null
  "notes": string | null                           // short extra detail, else null
}
Choose the best-fitting category; use "Other" if unclear. Default billingCycle to "monthly" for subscriptions and "variable" for utility bills when unstated.
If the input is NOT about a subscription, bill, warranty, membership, or document to track, return exactly {"error":"unparseable"}.
Never include full card numbers or ID numbers in any field.`;

export const PARSE_ENTRY_SYSTEM = `You convert a short natural-language note into structured fields for a personal finance tracker.
${SHAPE}`;

export const PARSE_IMAGE_SYSTEM = `You read a photo of a receipt, invoice, or subscription confirmation and extract structured fields for a personal finance tracker.
Focus on the merchant/service name, amount, and billing period. Ignore unrelated text.
${SHAPE}`;
