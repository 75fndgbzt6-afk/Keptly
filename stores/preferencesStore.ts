// Non-secret app preferences: profile name, default currency, and notification
// defaults (quiet hours + lead times). Persisted in the app_settings SQLite table
// (NOT secure store — names/preferences aren't secrets, SPEC §8).
import { create } from 'zustand';
import { DEFAULT_CURRENCY } from '@/constants/config';
import { getSetting, setSetting } from '@/db/settings';

const PREFS_KEY = 'preferences';

export interface Preferences {
  name: string | null;
  defaultCurrency: string;
  quietHoursEnabled: boolean;
  quietStartHour: number; // 0–23; default 22 (10pm)
  quietEndHour: number; // 0–23; default 7 (7am)
  defaultLeadDays: number[]; // e.g. [30, 14, 7, 1]
  /** Soft monthly budget for the Items-tab spend ring. 0 = auto-derive. */
  monthlyBudget: number;
  /** Target % of tracked items used per month (the "used" ring fills to 100% at goal). */
  usageGoalPct: number;
}

const DEFAULTS: Preferences = {
  name: null,
  defaultCurrency: DEFAULT_CURRENCY,
  quietHoursEnabled: false,
  quietStartHour: 22,
  quietEndHour: 7,
  defaultLeadDays: [30, 14, 7, 1],
  monthlyBudget: 0,
  usageGoalPct: 100,
};

function parse(raw: string | null): Preferences {
  if (!raw) return DEFAULTS;
  try {
    const v = JSON.parse(raw) as Partial<Preferences>;
    return {
      name: typeof v.name === 'string' ? v.name : DEFAULTS.name,
      defaultCurrency:
        typeof v.defaultCurrency === 'string' ? v.defaultCurrency : DEFAULTS.defaultCurrency,
      quietHoursEnabled:
        typeof v.quietHoursEnabled === 'boolean' ? v.quietHoursEnabled : DEFAULTS.quietHoursEnabled,
      quietStartHour:
        typeof v.quietStartHour === 'number' ? v.quietStartHour : DEFAULTS.quietStartHour,
      quietEndHour: typeof v.quietEndHour === 'number' ? v.quietEndHour : DEFAULTS.quietEndHour,
      defaultLeadDays: Array.isArray(v.defaultLeadDays)
        ? v.defaultLeadDays.filter((n): n is number => typeof n === 'number')
        : DEFAULTS.defaultLeadDays,
      monthlyBudget: typeof v.monthlyBudget === 'number' ? v.monthlyBudget : DEFAULTS.monthlyBudget,
      usageGoalPct: typeof v.usageGoalPct === 'number' ? v.usageGoalPct : DEFAULTS.usageGoalPct,
    };
  } catch {
    return DEFAULTS;
  }
}

interface PreferencesState extends Preferences {
  loaded: boolean;
  refresh: () => Promise<void>;
  update: (patch: Partial<Preferences>) => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  refresh: async () => {
    set({ ...parse(await getSetting(PREFS_KEY)), loaded: true });
  },
  update: async (patch) => {
    const next: Preferences = {
      name: get().name,
      defaultCurrency: get().defaultCurrency,
      quietHoursEnabled: get().quietHoursEnabled,
      quietStartHour: get().quietStartHour,
      quietEndHour: get().quietEndHour,
      defaultLeadDays: get().defaultLeadDays,
      monthlyBudget: get().monthlyBudget,
      usageGoalPct: get().usageGoalPct,
      ...patch,
    };
    set(next);
    await setSetting(PREFS_KEY, JSON.stringify(next));
  },
}));
