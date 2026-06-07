// Appearance preference (Light / Dark / System), persisted in secure store so it
// survives restarts. The ThemeProvider turns this + the OS scheme into a Theme.
import { create } from 'zustand';
import { ThemeMode } from '@/constants/theme';
import { SecureKeys, secureGet, secureSet } from '@/services/secure-store';

const MODES: ThemeMode[] = ['light', 'dark', 'system'];

interface ThemeState {
  mode: ThemeMode;
  loaded: boolean;
  refresh: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  loaded: false,
  refresh: async () => {
    const raw = await secureGet(SecureKeys.themeMode);
    const mode = MODES.includes(raw as ThemeMode) ? (raw as ThemeMode) : 'system';
    set({ mode, loaded: true });
  },
  setMode: async (mode) => {
    set({ mode });
    await secureSet(SecureKeys.themeMode, mode);
  },
}));
