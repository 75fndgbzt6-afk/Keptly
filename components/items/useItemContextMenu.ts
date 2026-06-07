// Long-press context menu for item rows (Items tab, Vault, Calendar). Fires a
// haptic, then offers Edit / Delete with a confirm before deleting. Complements
// the detail-screen delete — it doesn't replace it.
import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Item } from '@/types';
import { deleteItemCompletely } from '@/services/item-delete';
import { useItemsStore } from '@/stores/itemsStore';
import { useRecommendationsStore } from '@/stores/recommendationsStore';

export function useItemContextMenu(): (item: Item) => void {
  const router = useRouter();
  const refreshItems = useItemsStore((s) => s.refresh);
  const refreshRecs = useRecommendationsStore((s) => s.refresh);

  return useCallback(
    (item: Item) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const confirmDelete = () => {
        Alert.alert('Delete item', `Delete "${item.name}"? This can't be undone.`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await deleteItemCompletely(item.id);
              await refreshItems();
              await refreshRecs();
            },
          },
        ]);
      };

      Alert.alert(item.name, undefined, [
        {
          text: 'Edit',
          onPress: () => router.push({ pathname: '/(modal)/add-item', params: { id: item.id } }),
        },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [router, refreshItems, refreshRecs],
  );
}
