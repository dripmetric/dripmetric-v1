import type { ScopedDb } from '@dripmetric/db';
import { isCanonicalEventName } from '@dripmetric/catalog';

/**
 * The event dictionary (settled decision 10).
 *
 * Every raw name a project sends gets a row and a 4-byte id. A name that is already
 * canonical is mapped and confirmed on sight; anything else starts unmapped and waits
 * in the Inbox, counting toward nothing until the founder maps it (brief section 7).
 */

export interface NameRecord {
  id: number;
  canonical: string | null;
}

/** Per-project, per-request cache. Ingest resolves the same few names constantly. */
export type NameCache = Map<string, NameRecord>;

export function newNameCache(): NameCache {
  return new Map();
}

export async function resolveNameId(
  db: ScopedDb,
  cache: NameCache,
  rawName: string,
  source: string,
  at: Date,
): Promise<NameRecord> {
  const cached = cache.get(rawName);
  if (cached) return cached;

  /*
   * A name from the catalog, sent verbatim, IS already canonical — "named right at
   * the source", the first of the four ways an event gets its meaning (brief
   * section 7). The SDK docs and the AI-coder prompt use these names, so a new
   * integration is mapped from its first event.
   *
   * This deliberately checks the WHOLE catalog, not the dozen mappable meanings.
   * The dozen are what a founder may map their OWN names onto; they are not the
   * limit of what we recognise. Checking only those meant `Onboarding Step Viewed`,
   * `Email Verified` and `Trial Started` all landed in the Inbox as unmapped, which
   * cost the engines step ENTRY for every step without a URL rule — the simulator
   * saw 67 of 126 known stalls, because only the URL-rule steps registered.
   */
  const canonical = isCanonicalEventName(rawName) ? rawName : null;

  const row = await db.one<{ id: number; canonical: string | null }>(
    `INSERT INTO event_names (project_id, raw_name, canonical, status, confidence, first_seen_at, last_seen_at, event_count, owning_source)
     VALUES ($1, $2, $3, $4, $5, $6, $6, 1, $7)
     ON CONFLICT (project_id, raw_name) DO UPDATE SET
       last_seen_at = GREATEST(event_names.last_seen_at, EXCLUDED.last_seen_at),
       event_count  = event_names.event_count + 1
     RETURNING id, canonical`,
    [
      db.projectId,
      rawName.slice(0, 256),
      canonical,
      canonical ? 'confirmed' : 'unmapped',
      canonical ? 'high' : null,
      at,
      // Each canonical event belongs to one source path, auto-assigned on first sight
      // (brief section 5). A second path sending it raises a tracking-health warning.
      source,
    ],
  );

  const record: NameRecord = { id: row.id, canonical: row.canonical };
  cache.set(rawName, record);
  return record;
}

export async function resolvePathId(
  db: ScopedDb,
  cache: Map<string, number>,
  path: string,
  title: string | null,
  at: Date,
): Promise<number> {
  const cached = cache.get(path);
  if (cached !== undefined) return cached;

  const row = await db.one<{ id: number }>(
    `INSERT INTO paths (project_id, path, title, first_seen_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_id, path) DO UPDATE SET
       title = COALESCE(EXCLUDED.title, paths.title)
     RETURNING id`,
    [db.projectId, path.slice(0, 1024), title, at],
  );
  cache.set(path, row.id);
  return row.id;
}
