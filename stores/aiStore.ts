// AI Assist state: opt-in toggle (default OFF), anonymous device id, live quota,
// and a one-shot prefill the assistant/quick-add uses to pre-populate the Add form.
// The enabled flag is a non-secret UX setting (app_settings); the device id is a
// secret-store UUID. No network here — services/ai.ts performs calls and pushes
// quota back via setQuota.
import { create } from 'zustand';
import { QuotaStatus, ParsedEntry } from '@/lib/ai-types';
import { getSetting, setSetting } from '@/db/settings';
import { SecureKeys, secureGet, secureSet } from '@/services/secure-store';
import { generateId } from '@/lib/id';

const ENABLED_KEY = 'ai.enabled';

interface AiState {
  enabled: boolean;
  deviceId: string | null;
  quota: QuotaStatus | null;
  loaded: boolean;
  /** A parsed entry awaiting confirmation in the Add form (set by assistant/quick-add). */
  pendingPrefill: ParsedEntry | null;
  refresh: () => Promise<void>;
  setEnabled: (value: boolean) => Promise<void>;
  setQuota: (quota: QuotaStatus | null) => void;
  setPrefill: (entry: ParsedEntry | null) => void;
  consumePrefill: () => ParsedEntry | null;
}

export const useAiStore = create<AiState>((set, get) => ({
  enabled: false,
  deviceId: null,
  quota: null,
  loaded: false,
  pendingPrefill: null,
  refresh: async () => {
    const enabled = (await getSetting(ENABLED_KEY)) === '1';
    // Ensure an anonymous device id exists (generated after onboarding / first run).
    let deviceId = await secureGet(SecureKeys.aiDeviceId);
    if (!deviceId) {
      deviceId = `dev-${generateId()}-${generateId()}`.replace(/[^A-Za-z0-9-]/g, '');
      await secureSet(SecureKeys.aiDeviceId, deviceId);
    }
    set({ enabled, deviceId, loaded: true });
  },
  setEnabled: async (value) => {
    set({ enabled: value });
    await setSetting(ENABLED_KEY, value ? '1' : '0');
  },
  setQuota: (quota) => set({ quota }),
  setPrefill: (entry) => set({ pendingPrefill: entry }),
  consumePrefill: () => {
    const entry = get().pendingPrefill;
    if (entry) set({ pendingPrefill: null });
    return entry;
  },
}));
