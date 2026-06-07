// The ONLY module that touches expo-secure-store. Everything that must never sit
// in plaintext on disk — encryption-backed secrets, the full digits behind a
// masked ID, lock timestamps, security flags — flows through here (SPEC §8).
//
// Hard rule: never put amounts, dates, names, or any regular item field in here.
// Those belong in SQLite. Secure store is exclusively for secrets + lock state.
import * as SecureStore from 'expo-secure-store';

/**
 * Centralized key registry so no call site ever hand-writes a raw key string.
 * Keys must match expo-secure-store's allowed charset [A-Za-z0-9._-]; our item
 * ids are base36 + a single hyphen (see lib/id.ts), so the templated keys are safe.
 */
export const SecureKeys = {
  /** ISO timestamp of the last successful app unlock (drives the inactivity timeout). */
  appLastUnlockedAt: 'renewly.lock.lastUnlockedAt',
  /** Security setting flags (JSON). */
  securitySettings: 'renewly.security.settings',
  /** Appearance preference: 'light' | 'dark' | 'system'. */
  themeMode: 'renewly.theme.mode',
  /** Onboarding completion flag ('1' once finished). */
  onboardingComplete: 'renewly.onboarding.complete',
  /** Profile + notification preferences (JSON). */
  preferences: 'renewly.preferences',
  /** The full government-ID number behind an item's masked display, keyed by item id. */
  idExtra: (itemId: string): string => `renewly.idExtra.${itemId}`,
} as const;

/** Read a secret. Returns null when absent or on any storage error. */
export async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

/** Write a secret. Best-effort; throws are swallowed so callers stay simple. */
export async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // best-effort; ignore storage failures
  }
}

/** Delete a secret. Safe to call when the key doesn't exist. */
export async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // best-effort; ignore storage failures
  }
}
