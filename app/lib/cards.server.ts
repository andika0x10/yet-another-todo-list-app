import { BODY_MAX, TITLE_MAX } from "./limits";
import type { Card, CardStatus } from "./types";

export type CardResult = { ok: true } | { ok: false; error: string; status: number };

const OK: CardResult = { ok: true };
const COLUMNS = `id, title, body, status, position,
  created_at AS createdAt, updated_at AS updatedAt, archived_at AS archivedAt`;
const NEXT_TOP_POSITION = `(SELECT COALESCE(MIN(position), 0) - 1 FROM cards WHERE status = 'active')`;

function validate(rawTitle: string, rawBody: string): { title: string; body: string } | CardResult {
  const title = rawTitle.trim();
  const body = rawBody.trim();
  if (!title) return { ok: false, error: "Judul wajib diisi.", status: 400 };
  if (title.length > TITLE_MAX) {
    return { ok: false, error: `Judul maksimal ${TITLE_MAX} karakter.`, status: 400 };
  }
  if (body.length > BODY_MAX) {
    return { ok: false, error: "Isi maksimal 1.000 karakter.", status: 400 };
  }
  return { title, body };
}

const gone = (): CardResult => ({
  ok: false,
  error: "Kartu ini sudah berubah atau dihapus di perangkat lain.",
  status: 404,
});

export async function listCards(db: D1Database, status: CardStatus): Promise<Card[]> {
  const order = status === "active" ? "position ASC, created_at DESC" : "archived_at DESC";
  const { results } = await db
    .prepare(`SELECT ${COLUMNS} FROM cards WHERE status = ? ORDER BY ${order}`)
    .bind(status)
    .all<Card>();
  return results;
}

export async function countCards(db: D1Database): Promise<{ active: number; archived: number }> {
  const { results } = await db
    .prepare("SELECT status, COUNT(*) AS total FROM cards GROUP BY status")
    .all<{ status: CardStatus; total: number }>();
  const counts = { active: 0, archived: 0 };
  for (const row of results) counts[row.status] = row.total;
  return counts;
}

/** New cards go to the front, next to the blank ticket. */
export async function createCard(db: D1Database, title: string, body: string): Promise<CardResult> {
  const checked = validate(title, body);
  if ("ok" in checked) return checked;
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO cards (id, title, body, status, position, created_at, updated_at)
       VALUES (?1, ?2, ?3, 'active', ${NEXT_TOP_POSITION}, ?4, ?4)`,
    )
    .bind(crypto.randomUUID(), checked.title, checked.body, now)
    .run();
  return OK;
}

export async function updateCard(db: D1Database, id: string, title: string, body: string): Promise<CardResult> {
  const checked = validate(title, body);
  if ("ok" in checked) return checked;
  const result = await db
    .prepare("UPDATE cards SET title = ?2, body = ?3, updated_at = ?4 WHERE id = ?1 AND status = 'active'")
    .bind(id, checked.title, checked.body, Date.now())
    .run();
  return result.meta.changes > 0 ? OK : gone();
}

export async function archiveCard(db: D1Database, id: string): Promise<CardResult> {
  const now = Date.now();
  const result = await db
    .prepare("UPDATE cards SET status = 'archived', archived_at = ?2, updated_at = ?2 WHERE id = ?1 AND status = 'active'")
    .bind(id, now)
    .run();
  return result.meta.changes > 0 ? OK : gone();
}

export async function restoreCard(db: D1Database, id: string): Promise<CardResult> {
  const result = await db
    .prepare(
      `UPDATE cards SET status = 'active', archived_at = NULL, position = ${NEXT_TOP_POSITION}, updated_at = ?2
       WHERE id = ?1 AND status = 'archived'`,
    )
    .bind(id, Date.now())
    .run();
  return result.meta.changes > 0 ? OK : gone();
}

/** Deleting a card that no longer exists counts as success. */
export async function deleteCard(db: D1Database, id: string): Promise<CardResult> {
  await db.prepare("DELETE FROM cards WHERE id = ?").bind(id).run();
  return OK;
}

/**
 * Reorders active cards. The new order only permutes cards among the positions they already hold,
 * so a card added from another device in the meantime is not disturbed.
 */
export async function reorderCards(db: D1Database, ids: string[]): Promise<CardResult> {
  const wanted = [...new Set(ids)];
  const { results } = await db
    .prepare("SELECT id, position FROM cards WHERE status = 'active'")
    .all<{ id: string; position: number }>();

  const current = new Map(results.map((row) => [row.id, row.position]));
  const ordered = wanted.filter((id) => current.has(id));
  const slots = ordered.map((id) => current.get(id)!).sort((a, b) => a - b);

  const now = Date.now();
  const update = db.prepare("UPDATE cards SET position = ?2, updated_at = ?3 WHERE id = ?1 AND status = 'active'");
  const statements = ordered.flatMap((id, index) =>
    current.get(id) === slots[index] ? [] : [update.bind(id, slots[index], now)],
  );

  if (statements.length > 0) await db.batch(statements);
  return OK;
}
