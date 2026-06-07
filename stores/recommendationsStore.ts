// Recommendations store. Holds the current active recommendations and regenerates
// them (persisting the diff) on demand. The engine is re-run on startup and
// whenever the items list changes; screens also refresh on focus to catch
// usage-log / intent edits that don't replace the items array.
import { create } from 'zustand';
import { Recommendation } from '@/types';
import { persistRecommendations, sumPotentialSavings } from '@/services/recommendation-engine';
import { useItemsStore } from './itemsStore';

interface RecommendationsState {
  recommendations: Recommendation[];
  potentialSavings: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const useRecommendationsStore = create<RecommendationsState>((set) => ({
  recommendations: [],
  potentialSavings: 0,
  loading: false,
  refresh: async () => {
    set({ loading: true });
    const recommendations = await persistRecommendations();
    set({
      recommendations,
      potentialSavings: sumPotentialSavings(recommendations),
      loading: false,
    });
  },
}));

// Re-run the engine whenever the items array is replaced (add/edit/delete/intent).
let lastItemsRef = useItemsStore.getState().items;
useItemsStore.subscribe((state) => {
  if (state.items !== lastItemsRef) {
    lastItemsRef = state.items;
    void useRecommendationsStore.getState().refresh();
  }
});
