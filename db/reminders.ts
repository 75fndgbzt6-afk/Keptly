// Typed data-access for reminders. All reminder SQL is contained here.
import { Reminder, ReminderStatus, ReminderType } from '@/types';
import { generateId } from '@/lib/id';
import { getDb } from './index';

interface ReminderRow {
  id: string;
  itemId: string;
  triggerDate: string;
  leadTimeDays: number;
  type: string;
  status: string;
  notificationId: string | null;
}

function rowToReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    itemId: row.itemId,
    triggerDate: row.triggerDate,
    leadTimeDays: row.leadTimeDays,
    type: row.type as ReminderType,
    status: row.status as ReminderStatus,
    notificationId: row.notificationId,
  };
}

const COLUMNS = 'id, itemId, triggerDate, leadTimeDays, type, status, notificationId';

export type NewReminderInput = Omit<Reminder, 'id'>;

export async function createReminder(input: NewReminderInput): Promise<Reminder> {
  const reminder: Reminder = { ...input, id: generateId() };
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO reminders (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      reminder.id,
      reminder.itemId,
      reminder.triggerDate,
      reminder.leadTimeDays,
      reminder.type,
      reminder.status,
      reminder.notificationId,
    ],
  );
  return reminder;
}

export async function getReminder(id: string): Promise<Reminder | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ReminderRow>(
    `SELECT ${COLUMNS} FROM reminders WHERE id = ?`,
    [id],
  );
  return row ? rowToReminder(row) : null;
}

export async function listReminders(): Promise<Reminder[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReminderRow>(
    `SELECT ${COLUMNS} FROM reminders ORDER BY triggerDate ASC`,
  );
  return rows.map(rowToReminder);
}

export async function listRemindersByItem(itemId: string): Promise<Reminder[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReminderRow>(
    `SELECT ${COLUMNS} FROM reminders WHERE itemId = ? ORDER BY triggerDate ASC`,
    [itemId],
  );
  return rows.map(rowToReminder);
}

export async function updateReminderStatus(
  id: string,
  status: ReminderStatus,
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE reminders SET status = ? WHERE id = ?', [status, id]);
}

export async function updateReminderSchedule(
  id: string,
  triggerDate: string,
  notificationId: string | null,
  status: ReminderStatus = 'pending',
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE reminders SET triggerDate = ?, notificationId = ?, status = ? WHERE id = ?',
    [triggerDate, notificationId, status, id],
  );
}

export async function markItemRemindersDismissed(itemId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE reminders SET status = 'dismissed' WHERE itemId = ? AND status = 'pending'`,
    [itemId],
  );
}

export async function deleteRemindersByItem(itemId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM reminders WHERE itemId = ?', [itemId]);
}
