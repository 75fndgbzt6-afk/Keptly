// Typed data-access for the app_settings key/value table — non-secret app
// preferences (profile name, default currency, notification prefs). All SQL here.
import { getDb } from './index';

interface SettingRow {
  key: string;
  value: string;
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SettingRow>(
    'SELECT key, value FROM app_settings WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    [key, value],
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<SettingRow>('SELECT key, value FROM app_settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function clearSettings(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM app_settings');
}
