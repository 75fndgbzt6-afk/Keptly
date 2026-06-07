// Typed data-access for payment methods. All SQL contained here.
// Never stores full card numbers or CVV (SPEC §8) — only a label, type, last4.
import {
  PaymentMethod,
  PaymentMethodPatch,
  PaymentMethodType,
  NewPaymentMethodInput,
} from '@/types';
import { generateId } from '@/lib/id';
import { getDb } from './index';

interface PaymentMethodRow {
  id: string;
  label: string;
  type: string;
  last4: string | null;
  holderName: string | null;
}

function rowToMethod(row: PaymentMethodRow): PaymentMethod {
  return {
    id: row.id,
    label: row.label,
    type: row.type as PaymentMethodType,
    last4: row.last4,
    holderName: row.holderName,
  };
}

export async function createPaymentMethod(
  input: NewPaymentMethodInput,
): Promise<PaymentMethod> {
  const method: PaymentMethod = { ...input, id: generateId() };
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO payment_methods (id, label, type, last4, holderName)
     VALUES (?, ?, ?, ?, ?)`,
    [method.id, method.label, method.type, method.last4, method.holderName],
  );
  return method;
}

export async function updatePaymentMethod(
  id: string,
  patch: PaymentMethodPatch,
): Promise<PaymentMethod | null> {
  const existing = await getPaymentMethod(id);
  if (!existing) return null;
  const merged: PaymentMethod = { ...existing, ...patch, id: existing.id };
  const db = await getDb();
  await db.runAsync(
    `UPDATE payment_methods SET label = ?, type = ?, last4 = ?, holderName = ? WHERE id = ?`,
    [merged.label, merged.type, merged.last4, merged.holderName, merged.id],
  );
  return merged;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM payment_methods WHERE id = ?', [id]);
}

export async function getPaymentMethod(id: string): Promise<PaymentMethod | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PaymentMethodRow>(
    'SELECT id, label, type, last4, holderName FROM payment_methods WHERE id = ?',
    [id],
  );
  return row ? rowToMethod(row) : null;
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PaymentMethodRow>(
    'SELECT id, label, type, last4, holderName FROM payment_methods ORDER BY label COLLATE NOCASE',
  );
  return rows.map(rowToMethod);
}
