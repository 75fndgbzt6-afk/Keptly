// Items store. Holds the current list; refresh() pulls from the DB.
// Components subscribe to slices, not the whole store.
import { create } from 'zustand';
import { Item } from '@/types';
import { listItems } from '@/db/items';

interface ItemsState {
  items: Item[];
  loading: boolean;
  loaded: boolean;
  refresh: () => Promise<void>;
}

export const useItemsStore = create<ItemsState>((set) => ({
  items: [],
  loading: false,
  loaded: false,
  refresh: async () => {
    set({ loading: true });
    const items = await listItems();
    set({ items, loading: false, loaded: true });
  },
}));
