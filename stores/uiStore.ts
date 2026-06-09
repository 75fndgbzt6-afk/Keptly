// Tiny global UI-interaction lock. Charts and swipeable rows call begin()/end()
// (via their existing onInteractionStart/onInteractionEnd hooks) while the user
// is actively dragging inside them. The tab-swipe gesture in app/(tabs)/_layout
// reads `interacting` and disables itself for the duration, so a horizontal
// chart scrub or row-swipe can never be hijacked into a tab change.
//
// A counter (not a boolean) so overlapping interactions don't unlock early.
import { create } from 'zustand';

interface UiState {
  interacting: number;
  beginInteraction: () => void;
  endInteraction: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  interacting: 0,
  beginInteraction: () => set((s) => ({ interacting: s.interacting + 1 })),
  endInteraction: () => set((s) => ({ interacting: Math.max(0, s.interacting - 1) })),
}));
