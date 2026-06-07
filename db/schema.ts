// Schema creation + versioned migrations. Runs idempotently on app startup.
import type { SQLiteDatabase } from 'expo-sqlite';
import { documentMask } from '@/lib/masking';
import { SecureKeys, secureSet } from '@/services/secure-store';
import { getDb } from './index';

/** Bump this and add a migration step when the schema changes. */
export const SCHEMA_VERSION = 5;

const CREATE_PAYMENT_METHODS = `
  CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL,
    last4 TEXT,
    holderName TEXT
  );
`;

const CREATE_ITEMS = `
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    holderName TEXT,
    paymentMethodId TEXT,
    amount REAL,
    currency TEXT NOT NULL DEFAULT 'INR',
    billingCycle TEXT NOT NULL,
    startDate TEXT NOT NULL,
    nextDate TEXT,
    autoRenew INTEGER NOT NULL DEFAULT 0,
    isFreeTrial INTEGER NOT NULL DEFAULT 0,
    trialEndDate TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    intentFlag TEXT NOT NULL DEFAULT 'neutral',
    notes TEXT,
    attachmentUri TEXT,
    details TEXT NOT NULL DEFAULT '{"kind":"none"}',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (paymentMethodId) REFERENCES payment_methods (id) ON DELETE SET NULL
  );
`;

const CREATE_USAGE_LOGS = `
  CREATE TABLE IF NOT EXISTS usage_logs (
    id TEXT PRIMARY KEY NOT NULL,
    itemId TEXT NOT NULL,
    date TEXT NOT NULL,
    value REAL NOT NULL,
    source TEXT NOT NULL,
    FOREIGN KEY (itemId) REFERENCES items (id) ON DELETE CASCADE
  );
`;

const CREATE_REMINDERS = `
  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY NOT NULL,
    itemId TEXT NOT NULL,
    triggerDate TEXT NOT NULL,
    leadTimeDays INTEGER NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    notificationId TEXT,
    FOREIGN KEY (itemId) REFERENCES items (id) ON DELETE CASCADE
  );
`;

const CREATE_RECOMMENDATIONS = `
  CREATE TABLE IF NOT EXISTS recommendations (
    id TEXT PRIMARY KEY NOT NULL,
    itemId TEXT NOT NULL,
    type TEXT NOT NULL,
    reason TEXT NOT NULL,
    estimatedSavings REAL,
    status TEXT NOT NULL DEFAULT 'active',
    FOREIGN KEY (itemId) REFERENCES items (id) ON DELETE CASCADE
  );
`;

async function getUserVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  return row?.user_version ?? 0;
}

/**
 * A stored ID looks UNMASKED if it has no mask characters and more than 4
 * alphanumerics — i.e. it could be a full government ID from a legacy entry that
 * predates Phase 5's secure split.
 */
function looksUnmasked(value: string): boolean {
  if (value.includes('•') || value.includes('X')) return false;
  return value.replace(/[^A-Za-z0-9]/g, '').length > 4;
}

interface DocSweepRow {
  id: string;
  details: string;
}

/**
 * One-shot security migration: find any government-document item whose stored ID
 * number is still a full/unmasked value, move the full value into secure store
 * (keyed by item id) and replace the table value with its masked display form.
 * Idempotent — already-masked items are skipped.
 */
async function sweepLegacyIds(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<DocSweepRow>('SELECT id, details FROM items');
  for (const row of rows) {
    let details: { kind?: string; docType?: string; maskedIdNumber?: string };
    try {
      details = JSON.parse(row.details);
    } catch {
      continue;
    }
    if (details.kind !== 'document') continue;
    const raw = details.maskedIdNumber?.trim();
    if (!raw || !looksUnmasked(raw)) continue;

    // Preserve the full value securely, then strip it from the table.
    await secureSet(SecureKeys.idExtra(row.id), raw);
    const masked = documentMask(details.docType, raw);
    const nextDetails = JSON.stringify({ ...details, maskedIdNumber: masked });
    await db.runAsync('UPDATE items SET details = ? WHERE id = ?', [nextDetails, row.id]);
  }
}

/** Migration steps, applied in order for versions greater than the stored one. */
const MIGRATIONS: { version: number; up: (db: SQLiteDatabase) => Promise<void> }[] = [
  {
    version: 1,
    up: async (db) => {
      await db.execAsync(CREATE_PAYMENT_METHODS);
      await db.execAsync(CREATE_ITEMS);
      await db.execAsync(CREATE_USAGE_LOGS);
      await db.execAsync(CREATE_REMINDERS);
      await db.execAsync(CREATE_RECOMMENDATIONS);
    },
  },
  {
    version: 2,
    up: async (db) => {
      // Per-item reminder lead-time overrides (JSON array of days). NULL = category defaults.
      await db.execAsync('ALTER TABLE items ADD COLUMN reminderLeadDays TEXT;');
    },
  },
  {
    version: 3,
    up: async (db) => {
      // Display unit for consumption usage logs (e.g. "kWh", "GB"). NULL for digital/check-in.
      await db.execAsync('ALTER TABLE usage_logs ADD COLUMN unit TEXT;');
    },
  },
  {
    version: 4,
    up: async (db) => {
      // Security: move any legacy full government-ID numbers out of the items table
      // into secure store, leaving only the masked display behind (SPEC §8).
      // payment_methods already holds only last4 — no card-number column to drop.
      await sweepLegacyIds(db);
    },
  },
  {
    version: 5,
    up: async (db) => {
      // Non-secret app preferences (profile name, default currency, quiet hours,
      // default lead times). Names/amounts must NOT live in secure store (SPEC §8).
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS app_settings (
           key TEXT PRIMARY KEY NOT NULL,
           value TEXT NOT NULL
         );`,
      );
    },
  },
];

/** Create/upgrade the schema. Safe to call on every startup. */
export async function initDatabase(): Promise<void> {
  const db = await getDb();
  let current = await getUserVersion(db);

  for (const migration of MIGRATIONS) {
    if (migration.version > current) {
      await migration.up(db);
      await db.execAsync(`PRAGMA user_version = ${migration.version};`);
      current = migration.version;
    }
  }
}
