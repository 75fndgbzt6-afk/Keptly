import * as Haptics from 'expo-haptics';
import { usePreferencesStore } from '@/stores/preferencesStore';

function enabled(): boolean {
  return usePreferencesStore.getState().hapticsEnabled;
}

export function hapticSelection(): void {
  if (enabled()) void Haptics.selectionAsync();
}

export function hapticImpactLight(): void {
  if (enabled()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function hapticImpactMedium(): void {
  if (enabled()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
