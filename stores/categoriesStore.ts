// User-created custom categories. Persisted in the app_settings table so they
// reappear in the picker for reuse. Additive — built-in categories are unchanged.
import { create } from 'zustand';
import { CATEGORIES, isBuiltInCategory } from '@/lib/category';
import { getSetting, setSetting } from '@/db/settings';

const KEY = 'customCategories';

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  } catch {
    // ignore
  }
  return [];
}

interface CategoriesState {
  custom: string[];
  loaded: boolean;
  refresh: () => Promise<void>;
  /** Persist a new custom category if it isn't a built-in or already saved. */
  add: (name: string) => Promise<void>;
  /** Built-ins followed by custom categories (for pickers/filters). */
  all: () => string[];
}

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  custom: [],
  loaded: false,
  refresh: async () => {
    set({ custom: parse(await getSetting(KEY)), loaded: true });
  },
  add: async (name) => {
    const trimmed = name.trim();
    if (!trimmed || isBuiltInCategory(trimmed)) return;
    if (get().custom.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return;
    const next = [...get().custom, trimmed];
    set({ custom: next });
    await setSetting(KEY, JSON.stringify(next));
  },
  all: () => [...CATEGORIES, ...get().custom],
}));
