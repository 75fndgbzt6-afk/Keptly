// Full item teardown: erase on-device secrets (full ID + scan) then delete the
// row. Shared by the detail screen and the long-press delete on item lists.
import { deleteItem } from '@/db/items';
import { purgeItemSecrets } from '@/services/vault';

export async function deleteItemCompletely(id: string): Promise<void> {
  await purgeItemSecrets(id);
  await deleteItem(id);
}
