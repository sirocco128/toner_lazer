import { getDb } from "@/lib/database";
import {
  normalizeOpsTags,
  parseOpsTags,
  SUGGESTED_OPS_TAGS,
  type OpsTagEntityType,
} from "@/lib/ops-tags";

export function replaceEntityTags(
  entityType: OpsTagEntityType,
  entityId: string,
  tags: string[],
): string[] {
  const unique = normalizeOpsTags(tags);
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `DELETE FROM ops_tag_links WHERE entity_type = ? AND entity_id = ?`,
  ).run(entityType, entityId);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO ops_tag_links (tag, entity_type, entity_id, created_at)
     VALUES (?, ?, ?, ?)`,
  );
  for (const tag of unique) {
    insert.run(tag, entityType, entityId, now);
  }
  return unique;
}

export function listEntityTags(
  entityType: OpsTagEntityType,
  entityId: string,
): string[] {
  const rows = getDb()
    .prepare(
      `SELECT tag FROM ops_tag_links
       WHERE entity_type = ? AND entity_id = ?
       ORDER BY tag COLLATE NOCASE`,
    )
    .all(entityType, entityId) as { tag: string }[];
  return rows.map((row) => row.tag);
}

function collectJsonTags(sql: string): string[] {
  try {
    const rows = getDb().prepare(sql).all() as { tags: string | null }[];
    return rows.flatMap((row) => parseOpsTags(row.tags));
  } catch {
    return [];
  }
}

export function listDistinctOpsTags(): string[] {
  const set = new Set<string>();
  for (const tag of SUGGESTED_OPS_TAGS) set.add(tag);
  for (const tag of collectJsonTags(
    `SELECT tags FROM customers WHERE tags IS NOT NULL AND trim(tags) != ''`,
  )) {
    set.add(tag);
  }
  for (const tag of collectJsonTags(
    `SELECT tags FROM orders WHERE tags IS NOT NULL AND trim(tags) != ''`,
  )) {
    set.add(tag);
  }
  for (const tag of collectJsonTags(
    `SELECT tags FROM cash_receipts WHERE tags IS NOT NULL AND trim(tags) != ''`,
  )) {
    set.add(tag);
  }
  try {
    const rows = getDb()
      .prepare(`SELECT DISTINCT tag FROM ops_tag_links ORDER BY tag COLLATE NOCASE`)
      .all() as { tag: string }[];
    for (const row of rows) {
      if (row.tag) set.add(row.tag);
    }
  } catch {
    /* migration not applied */
  }
  return [...set].sort((a, b) => a.localeCompare(b, "th"));
}
