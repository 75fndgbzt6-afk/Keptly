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

/** Whether a biometric (Face ID / Touch ID / fingerprint / face) is enrolled. */
async function hasBiometricEnrolled(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return (
      level === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG ||
      level === LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK
    );
  } catch {
    return false;
  }
}

/**
 * Prompt the user to authenticate. Returns true only on a successful unlock.
 * If the device has no enrolled auth at all, returns true (nothing to verify
 * against) — this is an honest fallback, never a bypass of an *available* method.
 *
 * When a biometric is enrolled we PREFER it: `disableDeviceFallback: true` plus
 * an empty `fallbackLabel` makes iOS present Face ID / Touch ID (and Android the
 * fingerprint/face sheet) instead of jumping straight to the passcode pad. Only
 * if the biometric attempt genuinely fails (not a user cancel) do we then offer
 * the device passcode as a safety net, so nobody gets locked out.
 */
export async function requireUnlock(reason: string): Promise<boolean> {
  if (!(await canAuthenticate())) return true;

  const biometric = await hasBiometricEnrolled();

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      // Force biometrics first when enrolled; hide the "Enter Password" shortcut.
      disableDeviceFallback: biometric,
      fallbackLabel: biometric ? '' : undefined,
    });
    if (result.success) return true;

    // No biometric enrolled → that prompt was already the passcode; done.
    if (!biometric) return false;

    // Biometric attempt ended without success. Respect an explicit cancel;
    // otherwise fall back to the device passcode so the user can still get in.
    const cancelled =
      result.error === 'user_cancel' ||
      result.error === 'app_cancel' ||
      result.error === 'system_cancel';
    if (cancelled) return false;

    const fallback = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return fallback.success;
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
