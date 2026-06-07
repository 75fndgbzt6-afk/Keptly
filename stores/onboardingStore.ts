// First-launch onboarding completion flag. This is a non-sensitive UX flag, kept
// in secure store alongside the other launch flags so it's available before the DB.
import { create } from 'zustand';
import { SecureKeys, secureGet, secureSet } from '@/services/secure-store';

interface OnboardingState {
  complete: boolean;
  loaded: boolean;
  refresh: () => Promise<void>;
  finish: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  complete: false,
  loaded: false,
  refresh: async () => {
    const v = await secureGet(SecureKeys.onboardingComplete);
    set({ complete: v === '1', loaded: true });
  },
  finish: async () => {
    set({ complete: true });
    await secureSet(SecureKeys.onboardingComplete, '1');
  },
}));
