// Typed data-access for items. All item SQL is contained here.
import {
  Item,
  ItemDetails,
  ItemPatch,
  NewItemInput,
  BillingCycle,
  Category,
  IntentFlag,
  ItemStatus,
} from '@/types';
import { generateId } from '@/lib/id';
import { calcNextDate } from '@/lib/date';
import { scheduleForItem, cancelForItem } from '@/services/notifications';
import { getDb } from './index';

interface ItemRow {
  id: string;
  name: string;
  category: string;
  holderName: string | null;
  paymentMethodId: string | null;
  amount: number | null;
  currency: string;
  billingCycle: string;
  startDate: string;
  nextDate: string | null;
  autoRenew: number;
  isFreeTrial: number;
  trialEndDate: string | null;
  status: string;
  intentFlag: string;
  notes: string | null;
  attachmentUri: string | null;
  details: string;
  reminderLeadDays: string | null;
  createdAt: string;
  updatedAt: string;
}

function parseDetails(raw: string): ItemDetails {
  try {
    const parsed = JSON.parse(raw) as ItemDetails;
    if (parsed && typeof parsed === 'object' && 'kind' in parsed) return parsed;
  } catch {
    // fall through
  }
  return { kind: 'none' };
}

function parseLeadDays(raw: string | null): number[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === 'number')) {
      return parsed as number[];
    }
  } catch {
    // fall through
  }
  return null;
}

function rowToItem(row: ItemRow): Item {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Category,
    holderName: row.holderName,
    paymentMethodId: row.paymentMethodId,
    amount: row.amount,
    currency: row.currency,
    billingCycle: row.billingCycle as BillingCycle,
    startDate: row.startDate,
    nextDate: row.nextDate,
    autoRenew: row.autoRenew === 1,
    isFreeTrial: row.isFreeTrial === 1,
    trialEndDate: row.trialEndDate,
    status: row.status as ItemStatus,
    intentFlag: row.intentFlag as IntentFlag,
    notes: row.notes,
    attachmentUri: row.attachmentUri,
    details: parseDetails(row.details),
    reminderLeadDays: parseLeadDays(row.reminderLeadDays),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const SELECT_COLUMNS = `
  id, name, category, holderName, paymentMethodId, amount, currency,
  billingCycle, startDate, nextDate, autoRenew, isFreeTrial, trialEndDate,
  status, intentFlag, notes, attachmentUri, details, reminderLeadDays,
  createdAt, updatedAt
`;

async function upsert(item: Item): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO items (${SELECT_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.name,
      item.category,
      item.holderName,
      item.paymentMethodId,
      item.amount,
      item.currency,
      item.billingCycle,
      item.startDate,
      item.nextDate,
      item.autoRenew ? 1 : 0,
      item.isFreeTrial ? 1 : 0,
      item.trialEndDate,
      item.status,
      item.intentFlag,
      item.notes,
      item.attachmentUri,
      JSON.stringify(item.details),
      item.reminderLeadDays ? JSON.stringify(item.reminderLeadDays) : null,
      item.createdAt,
      item.updatedAt,
    ],
  );
}

export async function createItem(input: NewItemInput): Promise<Item> {
  const now = new Date().toISOString();
  const item: Item = {
    ...input,
    id: generateId(),
    nextDate: calcNextDate(input.startDate, input.billingCycle),
    reminderLeadDays: null,
    createdAt: now,
    updatedAt: now,
  };
  await upsert(item);
  await scheduleForItem(item);
  return item;
}

export async function updateItem(id: string, patch: ItemPatch): Promise<Item | null> {
  const existing = await getItem(id);
  if (!existing) return null;

  const merged: Item = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  // Recompute the schedule from the (possibly) updated start date + cycle.
  merged.nextDate = calcNextDate(merged.startDate, merged.billingCycle);

  await upsert(merged);
  // Reschedule reminders; a cancelled/expired item gets its reminders cleared.
  if (merged.status === 'active' || merged.status === 'paused') {
    await scheduleForItem(merged);
  } else {
    await cancelForItem(merged.id);
  }
  return merged;
}

/** Set nextDate explicitly (e.g. after "Mark done") without recomputing, then reschedule. */
export async function updateItemNextDate(id: string, nextDate: string): Promise<Item | null> {
  const existing = await getItem(id);
  if (!existing) return null;
  const merged: Item = { ...existing, nextDate, updatedAt: new Date().toISOString() };
  await upsert(merged);
  await scheduleForItem(merged);
  return merged;
}

export async function deleteItem(id: string): Promise<void> {
  await cancelForItem(id);
  const db = await getDb();
  await db.runAsync('DELETE FROM items WHERE id = ?', [id]);
}

export async function getItem(id: string): Promise<Item | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ItemRow>(
    `SELECT ${SELECT_COLUMNS} FROM items WHERE id = ?`,
    [id],
  );
  return row ? rowToItem(row) : null;
}

export async function listItems(): Promise<Item[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT ${SELECT_COLUMNS} FROM items ORDER BY createdAt DESC`,
  );
  return rows.map(rowToItem);
}
