// Local, collision-resistant ID generator (timestamp + randomness).
// Sufficient for on-device, single-user data.
export function generateId(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${time}-${rand}`;
}
