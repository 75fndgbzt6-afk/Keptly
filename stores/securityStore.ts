// Security settings: app-lock on/off, vault-lock on/off, and the app-lock
// inactivity timeout. Persisted in expo-secure-store (not plain storage) so the
// security posture itself can't be trivially flipped by tampering with app files.
import { create } from 'zustand';
import { SecureKeys, secureGet, secureSet } from '@/services/secure-store';

/** Allowed inactivity windows for the app lock, in minutes. */
export const TIMEOUT_OPTIONS = [1, 5, 15] as const;
export type TimeoutMinutes = (typeof TIMEOUT_OPTIONS)[number];

export interface SecuritySettings {
  appLockEnabled: boolean;
  vaultLockEnabled: boolean;
  inactivityTimeoutMin: TimeoutMinutes;
}

/** Secure-by-default: both locks on, 5-minute app-lock grace. */
const DEFAULTS: SecuritySettings = {
  appLockEnabled: true,
  vaultLockEnabled: true,
  inactivityTimeoutMin: 5,
};

function parse(raw: string | null): SecuritySettings {
  if (!raw) return DEFAULTS;
  try {
    const v = JSON.parse(raw) as Partial<SecuritySettings>;
    const timeout = TIMEOUT_OPTIONS.includes(v.inactivityTimeoutMin as TimeoutMinutes)
      ? (v.inactivityTimeoutMin as TimeoutMinutes)
      : DEFAULTS.inactivityTimeoutMin;
    return {
      appLockEnabled: typeof v.appLockEnabled === 'boolean' ? v.appLockEnabled : DEFAULTS.appLockEnabled,
      vaultLockEnabled:
        typeof v.vaultLockEnabled === 'boolean' ? v.vaultLockEnabled : DEFAULTS.vaultLockEnabled,
      inactivityTimeoutMin: timeout,
    };
  } catch {
    return DEFAULTS;
  }
}

interface SecurityState extends SecuritySettings {
  loaded: boolean;
  refresh: () => Promise<void>;
  update: (patch: Partial<SecuritySettings>) => Promise<void>;
}

export const useSecurityStore = create<SecurityState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  refresh: async () => {
    const settings = parse(await secureGet(SecureKeys.securitySettings));
    set({ ...settings, loaded: true });
  },
  update: async (patch) => {
    const current: SecuritySettings = {
      appLockEnabled: get().appLockEnabled,
      vaultLockEnabled: get().vaultLockEnabled,
      inactivityTimeoutMin: get().inactivityTimeoutMin,
    };
    const next = { ...current, ...patch };
    set(next);
    await secureSet(SecureKeys.securitySettings, JSON.stringify(next));
  },
}));
