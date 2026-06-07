// Document Vault domain logic: which items belong in the vault, secure storage of
// the full ID behind a masked display, and complete teardown of an item's secrets
// when it's deleted. All masking is display-only; the full value never leaves
// secure store except through the Reveal flow (requireUnlock).
import { Item } from '@/types';
import { SecureKeys, secureGet, secureSet, secureDelete } from './secure-store';
import { deleteScan } from './scan';

/**
 * Items that live in the secured vault: every government document, plus insurance
 * items that have an attached scan (policy docs worth protecting).
 */
export function isVaultItem(item: Item): boolean {
  if (item.category === 'Government document') return true;
  if (item.category === 'Insurance' && !!item.attachmentUri) return true;
  return false;
}

/** Filter a list down to vault items, government documents first. */
export function vaultItems(items: Item[]): Item[] {
  return items
    .filter(isVaultItem)
    .sort((a, b) => {
      const ga = a.category === 'Government document' ? 0 : 1;
      const gb = b.category === 'Government document' ? 0 : 1;
      if (ga !== gb) return ga - gb;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
}

/** Store the full ID number for an item (encrypted at rest by secure store). */
export async function setFullId(itemId: string, fullId: string): Promise<void> {
  await secureSet(SecureKeys.idExtra(itemId), fullId);
}

/** Read the full ID number for an item, or null when none is stored. */
export async function getFullId(itemId: string): Promise<string | null> {
  return secureGet(SecureKeys.idExtra(itemId));
}

/** Remove the stored full ID for an item. */
export async function clearFullId(itemId: string): Promise<void> {
  await secureDelete(SecureKeys.idExtra(itemId));
}

/**
 * Erase every on-device secret tied to an item — its full ID (secure store) and
 * its scan file. Call this right before deleting the item row so nothing is
 * orphaned outside SQLite's cascade.
 */
export async function purgeItemSecrets(itemId: string): Promise<void> {
  await clearFullId(itemId);
  await deleteScan(itemId);
}
