// Typed data-access for recommendations. All recommendations SQL is contained here.
import {
  Recommendation,
  RecommendationStatus,
  RecommendationType,
  NewRecommendationInput,
} from '@/types';
import { generateId } from '@/lib/id';
import { getDb } from './index';

interface RecommendationRow {
  id: string;
  itemId: string;
  type: string;
  reason: string;
  estimatedSavings: number | null;
  status: string;
}

function rowToRecommendation(row: RecommendationRow): Recommendation {
  return {
    id: row.id,
    itemId: row.itemId,
    type: row.type as RecommendationType,
    reason: row.reason,
    estimatedSavings: row.estimatedSavings,
    status: row.status as RecommendationStatus,
  };
}

const COLUMNS = 'id, itemId, type, reason, estimatedSavings, status';

export async function createRecommendation(
  input: NewRecommendationInput,
): Promise<Recommendation> {
  const rec: Recommendation = { ...input, id: generateId() };
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO recommendations (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`,
    [rec.id, rec.itemId, rec.type, rec.reason, rec.estimatedSavings, rec.status],
  );
  return rec;
}

export async function listRecommendations(): Promise<Recommendation[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecommendationRow>(
    `SELECT ${COLUMNS} FROM recommendations`,
  );
  return rows.map(rowToRecommendation);
}

export async function listActiveRecommendations(): Promise<Recommendation[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecommendationRow>(
    `SELECT ${COLUMNS} FROM recommendations WHERE status = 'active'`,
  );
  return rows.map(rowToRecommendation);
}

export async function getRecommendation(id: string): Promise<Recommendation | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RecommendationRow>(
    `SELECT ${COLUMNS} FROM recommendations WHERE id = ?`,
    [id],
  );
  return row ? rowToRecommendation(row) : null;
}

export async function updateRecommendationStatus(
  id: string,
  status: RecommendationStatus,
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE recommendations SET status = ? WHERE id = ?', [status, id]);
}

/** Refresh the human-readable reason + savings of an existing (still-active) row. */
export async function updateRecommendationContent(
  id: string,
  reason: string,
  estimatedSavings: number | null,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE recommendations SET reason = ?, estimatedSavings = ? WHERE id = ?',
    [reason, estimatedSavings, id],
  );
}

export async function deleteRecommendation(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM recommendations WHERE id = ?', [id]);
}
