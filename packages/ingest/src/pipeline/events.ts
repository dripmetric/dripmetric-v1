import type { ScopedDb } from '@dripmetric/db';
import { SOURCES, type Source } from '@dripmetric/catalog';

/**
 * Writing events (brief section 5, step 8).
 *
 * The hot path uses plain parameterised SQL with BATCHED inserts, not an ORM
 * (brief section 3). One multi-row insert per batch replaced one insert per event,
 * and the same for step state, tracked-user rows and the daily counters. Doing it
 * per event cost about a dozen serial round trips each, which was most of the
 * ingest time.
 *
 * Three guarantees live here:
 *
 *  1. **Idempotent.** The primary key is (project_id, message_hash), so replaying a
 *     batch changes nothing. The insert's RETURNING clause says which rows actually
 *     landed, so a duplicate is reported as one rather than guessed at.
 *  2. **Page Left is special.** The browser sends running totals per page view under
 *     a deterministic id, so a later message for the SAME page view must not be
 *     dropped as a duplicate: it updates the row when its active time is larger.
 *     Switching tabs therefore never double-counts and a retry is harmless.
 *  3. **The daily cap.** Past N rows per user per event type per day we count instead
 *     of storing, so a `track()` call stuck in a loop cannot fill the database.
 */

/** Sources are stored as a small integer. The order is the catalog's and is fixed. */
export function sourceToSmallInt(source: Source): number {
  const index = SOURCES.indexOf(source);
  if (index < 0) throw new Error(`Unknown source "${source}".`);
  return index;
}

export function smallIntToSource(value: number): Source {
  const source = SOURCES[value];
  if (!source) throw new Error(`Unknown source id ${value}.`);
  return source;
}

/** Bit 0: the event reached us more than an hour after it happened. */
export const FLAG_LATE = 1;

export interface EventWrite {
  messageHash: string;
  nameId: number;
  userKey: number | null;
  anonKey: number | null;
  sessionId: number | null;
  occurredAt: Date;
  receivedAt: Date;
  pathId: number | null;
  props: Record<string, unknown> | null;
  source: Source;
  late: boolean;
}

/**
 * Inserts a batch of events in one statement and returns the hashes that landed.
 * Anything missing from the result was already there: a duplicate.
 */
export async function writeEvents(
  db: ScopedDb,
  events: readonly EventWrite[],
): Promise<Set<string>> {
  if (events.length === 0) return new Set();

  const rows = await db.query<{ message_hash: string }>(
    `INSERT INTO events (
       project_id, message_hash, name_id, user_key, anon_key, session_id,
       occurred_at, received_at, path_id, props, source, flags
     )
     SELECT $1, e.message_hash, e.name_id, e.user_key, e.anon_key, e.session_id,
            e.occurred_at, e.received_at, e.path_id, e.props, e.source, e.flags
       FROM unnest(
              $2::uuid[], $3::int[], $4::int[], $5::int[], $6::bigint[],
              $7::timestamptz[], $8::timestamptz[], $9::int[], $10::jsonb[],
              $11::smallint[], $12::smallint[]
            ) AS e(message_hash, name_id, user_key, anon_key, session_id,
                   occurred_at, received_at, path_id, props, source, flags)
     ON CONFLICT (project_id, message_hash) DO NOTHING
     RETURNING message_hash`,
    [
      db.projectId,
      events.map((e) => e.messageHash),
      events.map((e) => e.nameId),
      events.map((e) => e.userKey),
      events.map((e) => e.anonKey),
      events.map((e) => e.sessionId),
      events.map((e) => e.occurredAt),
      events.map((e) => e.receivedAt),
      events.map((e) => e.pathId),
      events.map((e) => (e.props ? JSON.stringify(e.props) : null)),
      events.map((e) => sourceToSmallInt(e.source)),
      events.map((e) => (e.late ? FLAG_LATE : 0)),
    ],
  );

  return new Set(rows.map((r) => r.message_hash));
}

/**
 * Page Left: the same page view may report several times (tab hidden, hidden again,
 * then a retry). The row is updated only when the new totals are LARGER, so the
 * stored value is always the furthest the visitor actually got.
 *
 * Returns the hashes whose stored totals this call raised.
 */
export async function updatePageLeftTotals(
  db: ScopedDb,
  events: readonly EventWrite[],
): Promise<Set<string>> {
  if (events.length === 0) return new Set();

  const rows = await db.query<{ message_hash: string }>(
    `UPDATE events SET
       props = events.props
               || jsonb_build_object('activeSeconds', GREATEST(COALESCE((events.props->>'activeSeconds')::numeric, 0), u.active_seconds))
               || jsonb_build_object('deepestScroll', GREATEST(COALESCE((events.props->>'deepestScroll')::numeric, 0), u.deepest_scroll))
       FROM unnest($2::uuid[], $3::numeric[], $4::numeric[])
            AS u(message_hash, active_seconds, deepest_scroll)
      WHERE events.project_id = $1
        AND events.message_hash = u.message_hash
        AND COALESCE((events.props->>'activeSeconds')::numeric, 0) < u.active_seconds
      RETURNING events.message_hash`,
    [
      db.projectId,
      events.map((e) => e.messageHash),
      events.map((e) => numberOf(e.props?.['activeSeconds'])),
      events.map((e) => numberOf(e.props?.['deepestScroll'])),
    ],
  );

  return new Set(rows.map((r) => r.message_hash));
}

function numberOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export interface DailyCountKey {
  day: string;
  userKey: number;
  nameId: number;
}

/**
 * Reads how many rows each (day, user, event name) already has, so the cap can then
 * be applied in memory for every message in the batch.
 *
 * Two concurrent batches for the same person could each believe they are under the
 * cap. That is fine: this is a volume guard against a runaway loop, not an exact
 * quota, and a handful of extra rows costs nothing.
 */
export async function readDailyCounts(
  db: ScopedDb,
  keys: readonly DailyCountKey[],
): Promise<Map<string, number>> {
  if (keys.length === 0) return new Map();

  const rows = await db.query<{
    day: string;
    user_key: number;
    name_id: number;
    total_count: number;
  }>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, user_key, name_id, total_count
       FROM daily_event_counts
      WHERE project_id = $1
        AND (day, user_key, name_id) IN (
              SELECT k.day::date, k.user_key, k.name_id
                FROM unnest($2::text[], $3::int[], $4::int[]) AS k(day, user_key, name_id)
            )`,
    [db.projectId, keys.map((k) => k.day), keys.map((k) => k.userKey), keys.map((k) => k.nameId)],
  );

  return new Map(rows.map((r) => [`${r.day}:${r.user_key}:${r.name_id}`, Number(r.total_count)]));
}

export interface DailyCountDelta extends DailyCountKey {
  arrived: number;
}

/** Writes the batch's counters back in one statement. */
export async function writeDailyCounts(
  db: ScopedDb,
  deltas: readonly DailyCountDelta[],
  cap: number,
): Promise<void> {
  if (deltas.length === 0) return;

  await db.exec(
    `INSERT INTO daily_event_counts
            (project_id, day, user_key, name_id, total_count, stored_count, overflow_count)
     SELECT $1, d.day::date, d.user_key, d.name_id, d.arrived,
            LEAST(d.arrived, $6::int), GREATEST(0, d.arrived - $6::int)
       FROM unnest($2::text[], $3::int[], $4::int[], $5::int[])
            AS d(day, user_key, name_id, arrived)
     ON CONFLICT (project_id, day, user_key, name_id) DO UPDATE
            SET total_count    = daily_event_counts.total_count + EXCLUDED.total_count,
                stored_count   = LEAST(daily_event_counts.total_count + EXCLUDED.total_count, $6::int),
                overflow_count = GREATEST(0, daily_event_counts.total_count + EXCLUDED.total_count - $6::int)`,
    [
      db.projectId,
      deltas.map((d) => d.day),
      deltas.map((d) => d.userKey),
      deltas.map((d) => d.nameId),
      deltas.map((d) => d.arrived),
      cap,
    ],
  );
}

/** One conflict-ignored row per user per month gives an exact tracked-user count. */
export async function recordMonthlyActive(
  db: ScopedDb,
  entries: readonly { userKey: number; month: string }[],
): Promise<void> {
  if (entries.length === 0) return;

  await db.exec(
    `INSERT INTO monthly_active_users (project_id, month, user_key)
     SELECT $1, m.month::date, m.user_key
       FROM unnest($2::text[], $3::int[]) AS m(month, user_key)
     ON CONFLICT DO NOTHING`,
    [db.projectId, entries.map((e) => e.month), entries.map((e) => e.userKey)],
  );
}
