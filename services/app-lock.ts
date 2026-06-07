// App-lock primitives — the ONLY module that touches expo-local-authentication.
// Biometric (Face ID / Touch ID / fingerprint) with device-passcode fallback.
// requireUnlock() is the single gate the rest of the app uses to confirm identity
// before unlocking the app or revealing a masked value (SPEC §8).
import * as LocalAuthentication from 'expo-local-authentication';
import { SecureKeys, secureGet, secureSet, secureDelete } from './secure-store';

/**
 * Whether this device can actually authenticate the user (biometric enrolled OR a
 * device passcode set). When false there is no lock mechanism to enforce, so locks
 * cannot be applied — callers treat that as "open" rather than bricking the user.
 */
export async function canAuthenticate(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/**
 * Prompt the user to authenticate. Returns true only on a successful unlock.
 * If the device has no enrolled auth at all, returns true (nothing to verify
 * against) — this is an honest fallback, never a bypass of an *available* method.
 */
export async function requireUnlock(reason: string): Promise<boolean> {
  if (!(await canAuthenticate())) return true;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      // Allow the OS device-passcode fallback when biometrics fail/aren't available.
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

// --- Inactivity timeout bookkeeping (stored in secure store, not plain storage) ---

/** Record the moment of a successful unlock, to measure inactivity against. */
export async function markUnlocked(): Promise<void> {
  await secureSet(SecureKeys.appLastUnlockedAt, new Date().toISOString());
}

/** Forget the last-unlocked time (forces a fresh lock on next check). */
export async function clearUnlocked(): Promise<void> {
  await secureDelete(SecureKeys.appLastUnlockedAt);
}

/**
 * Whether the app should be considered locked given how long it's been since the
 * last successful unlock. Missing/parse-failed timestamp → locked.
 */
export async function isExpired(timeoutMs: number): Promise<boolean> {
  const iso = await secureGet(SecureKeys.appLastUnlockedAt);
  if (!iso) return true;
  const last = Date.parse(iso);
  if (Number.isNaN(last)) return true;
  return Date.now() - last >= timeoutMs;
}
