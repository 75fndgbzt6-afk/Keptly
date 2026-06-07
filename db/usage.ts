// Typed data-access for usage logs. All usage_logs SQL is contained here.
import { UsageLog, UsageSource, NewUsageLogInput } from '@/types';
import { generateId } from '@/lib/id';
import { getDb } from './index';

interface UsageLogRow {
  id: string;
  itemId: string;
  date: string;
  value: number;
  unit: string | null;
  source: string;
}

function rowToLog(row: UsageLogRow): UsageLog {
  return {
    id: row.id,
    itemId: row.itemId,
    date: row.date,
    value: row.value,
    unit: row.unit,
    source: row.source as UsageSource,
  };
}

const COLUMNS = 'id, itemId, date, value, unit, source';

export async function createUsageLog(input: NewUsageLogInput): Promise<UsageLog> {
  const log: UsageLog = { ...input, id: generateId() };
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO usage_logs (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`,
    [log.id, log.itemId, log.date, log.value, log.unit, log.source],
  );
  return log;
}

export async function deleteUsageLog(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM usage_logs WHERE id = ?', [id]);
}

export async function deleteUsageLogsByItem(itemId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM usage_logs WHERE itemId = ?', [itemId]);
}

/** All logs for one item, newest first. Caller filters by window. */
export async function listUsageLogsByItem(itemId: string): Promise<UsageLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<UsageLogRow>(
    `SELECT ${COLUMNS} FROM usage_logs WHERE itemId = ? ORDER BY date DESC, id DESC`,
    [itemId],
  );
  return rows.map(rowToLog);
}

/** Logs for one item dated on or after `sinceISO`, newest first. */
export async function listUsageLogsSince(itemId: string, sinceISO: string): Promise<UsageLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<UsageLogRow>(
    `SELECT ${COLUMNS} FROM usage_logs WHERE itemId = ? AND date >= ? ORDER BY date DESC, id DESC`,
    [itemId, sinceISO],
  );
  return rows.map(rowToLog);
}

/** Every log across all items dated on or after `sinceISO` (for batch value math). */
export async function listAllUsageLogsSince(sinceISO: string): Promise<UsageLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<UsageLogRow>(
    `SELECT ${COLUMNS} FROM usage_logs WHERE date >= ? ORDER BY date DESC, id DESC`,
    [sinceISO],
  );
  return rows.map(rowToLog);
}

/** Count of logs for an item on a specific date (for same-day check-in idempotency). */
export async function countUsageLogsOnDate(itemId: string, date: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM usage_logs WHERE itemId = ? AND date = ?',
    [itemId, date],
  );
  return row?.n ?? 0;
}
