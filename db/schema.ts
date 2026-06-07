// Schema creation + versioned migrations. Runs idempotently on app startup.
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDb } from './index';

/** Bump this and add a migration step when the schema changes. */
export const SCHEMA_VERSION = 2;

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
