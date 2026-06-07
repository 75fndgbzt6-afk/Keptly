// Export and delete-all (SPEC §8). Export produces a masked-only JSON snapshot —
// it reads exclusively from SQLite (which holds no full secrets) and additionally
// redacts any sensitive-looking fields, so full IDs/cards can never leak. Delete-all
// tears down every table, every secret in secure store, and all on-device scans.
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { listItems } from '@/db/items';
import { listPaymentMethods } from '@/db/paymentMethods';
import { getDb } from '@/db/index';
import { redact } from '@/lib/safe-log';
import { maskCardLast4 } from '@/lib/masking';
import { SecureKeys, secureDelete } from '@/services/secure-store';
import { purgeItemSecrets } from '@/services/vault';
import { cancelAllNotifications } from '@/services/notifications';

const EXPORT_PATH = `${FileSystem.cacheDirectory}renewly-export.json`;
const VAULT_DIR = `${FileSystem.documentDirectory}vault/`;

interface ExportPayload {
  app: 'Renewly';
  exportedAt: string;
  note: string;
  items: unknown[];
  paymentMethods: { label: string; type: string; card: string; holderName: string | null }[];
}

/** Build a masked, secret-free snapshot of all user data. */
async function buildExport(): Promise<ExportPayload> {
  const items = await listItems();
  const methods = await listPaymentMethods();
  return {
    app: 'Renewly',
    exportedAt: new Date().toISOString(),
    note: 'Numbers are masked. Full IDs and card numbers are never exported.',
    // redact() strips any sensitive field values defensively; masked IDs remain.
    items: items.map((item) => redact(item)),
    paymentMethods: methods.map((m) => ({
      label: m.label,
      type: m.type,
      card: maskCardLast4(m.last4),
      holderName: m.holderName,
    })),
  };
}

/** Write the masked snapshot to a temp file and open the system share sheet. */
export async function exportData(): Promise<boolean> {
  const json = JSON.stringify(await buildExport(), null, 2);
  await FileSystem.writeAsStringAsync(EXPORT_PATH, json);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(EXPORT_PATH, {
    mimeType: 'application/json',
    dialogTitle: 'Export Renewly data',
    UTI: 'public.json',
  });
  return true;
}

/**
 * Permanently erase everything: secure-store secrets (per-item full IDs, lock
 * timestamp, security settings), scan files, scheduled notifications, and all rows.
 */
export async function deleteAllData(): Promise<void> {
  const items = await listItems();

  // 1. Per-item secrets (full IDs + scans).
  for (const item of items) {
    await purgeItemSecrets(item.id);
  }
  // 2. Lock state + security preferences.
  await secureDelete(SecureKeys.appLastUnlockedAt);
  await secureDelete(SecureKeys.securitySettings);
  // 3. The whole vault directory (belt-and-suspenders over per-item deletes).
  await FileSystem.deleteAsync(VAULT_DIR, { idempotent: true });
  // 4. Scheduled OS notifications.
  await cancelAllNotifications();
  // 5. Every row. Children cascade, but we clear all tables explicitly.
  const db = await getDb();
  await db.execAsync(
    `DELETE FROM recommendations;
     DELETE FROM reminders;
     DELETE FROM usage_logs;
     DELETE FROM items;
     DELETE FROM payment_methods;`,
  );
}
