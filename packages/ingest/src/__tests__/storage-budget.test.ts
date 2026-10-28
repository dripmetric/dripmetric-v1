import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePools, withProject } from '@dripmetric/db';
import {
  adminClient,
  ensureMigrated,
  newFixture,
  postBatch,
  reply,
  resetData,
  type Fixture,
} from './helpers.js';

/**
 * M1 exit checks, the two measured ones:
 *
 *   "on 200,000 generated events the measured bytes per event, indexes included, is
 *    within 20% of 215 (record the number)"
 *   "a 1,000-event batch inserts quickly (record events per second on your machine)"
 *
 * Both print their number, because the brief asks for it recorded rather than only
 * asserted. The budget is settled decision 3: a naive text design is about 405 bytes,
 * and the compact design (dictionary-encoded names, integer user keys, context stored
 * once per session) is what buys the difference.
 */

const TARGET_BYTES_PER_EVENT = 215;
const TOLERANCE = 0.2;
const EVENT_COUNT = 200_000;

describe('storage budget (settled decision 3)', () => {
  let fx: Fixture;

  beforeAll(async () => {
    await ensureMigrated();
    await resetData();
    fx = await newFixture('Budget');
  }, 120_000);
  afterAll(closePools);

  it(`stays within 20% of ${TARGET_BYTES_PER_EVENT} bytes per event across ${EVENT_COUNT.toLocaleString()} events`, async () => {
    const USERS = 2_000;
    const EVENTS_PER_SESSION = 15;
    const SESSIONS = Math.ceil(EVENT_COUNT / EVENTS_PER_SESSION);

    await withProject(fx.project.live.id, async (db) => {
      await db.exec(
        `INSERT INTO event_names (project_id, raw_name, canonical, status)
           SELECT $1, name, name, 'confirmed'
             FROM unnest(ARRAY['Page Viewed','Page Left','Core Action','Signed Up','Activated']) AS name`,
        [fx.project.live.id],
      );
      await db.exec(
        `INSERT INTO paths (project_id, path)
           SELECT $1, '/page/' || g FROM generate_series(1, 200) g`,
        [fx.project.live.id],
      );
      await db.exec(
        `INSERT INTO end_users (project_id, external_id)
           SELECT $1, 'user_' || g FROM generate_series(1, $2) g`,
        [fx.project.live.id, USERS],
      );
    });

    // The table must be empty of dead tuples before it is measured, or the
    // measurement reports whatever earlier tests deleted. VACUUM FULL cannot run
    // inside a transaction, so it goes through a plain admin connection.
    await vacuumFull('events');

    await withProject(fx.project.live.id, async (db) => {
      const names = await db.query<{ id: number }>(
        'SELECT id FROM event_names WHERE project_id = $1 ORDER BY id',
        [fx.project.live.id],
      );
      const paths = await db.query<{ id: number }>(
        'SELECT id FROM paths WHERE project_id = $1 ORDER BY id',
        [fx.project.live.id],
      );
      const users = await db.query<{ user_key: number }>(
        'SELECT user_key FROM end_users WHERE project_id = $1 ORDER BY user_key',
        [fx.project.live.id],
      );

      /*
       * Seeded with SQL rather than through 200,000 HTTP calls: this measures
       * STORAGE, and the rows are byte-for-byte what the pipeline writes.
       *
       * The ARRIVAL ORDER is the part that has to be realistic, because it decides
       * how full the btree pages end up. Real traffic arrives as SESSIONS: one
       * person fires a burst of events, and sessions follow each other in time. So
       * that is what this generates. Interleaving all 2,000 users in strict
       * rotation instead measures 398 bytes/event, which is a pathological order no
       * real product produces — the figure is in docs/decisions.md so the
       * difference is on the record rather than hidden in a passing test.
       */
      await db.exec(
        `INSERT INTO events (
             project_id, message_hash, name_id, user_key, session_id,
             occurred_at, received_at, path_id, props, source, flags
           )
           SELECT $1,
                  md5('event-' || s.sess || '-' || e.n)::uuid,
                  ($2::int[])[1 + ((s.sess * 7 + e.n) % array_length($2::int[], 1))],
                  ($3::int[])[1 + (s.sess % array_length($3::int[], 1))],
                  s.sess,
                  $6::timestamptz + (s.sess * 20 || ' seconds')::interval + (e.n || ' seconds')::interval,
                  $6::timestamptz + (s.sess * 20 || ' seconds')::interval + (e.n || ' seconds')::interval,
                  ($4::int[])[1 + ((s.sess + e.n) % array_length($4::int[], 1))],
                  -- Roughly a third of events carry a few small properties, as real traffic does.
                  CASE WHEN (s.sess + e.n) % 3 = 0
                       THEN jsonb_build_object('plan', 'pro', 'amount', 2900, 'currency', 'usd') END,
                  0, 0
             FROM generate_series(1, $5::int) s(sess)
            CROSS JOIN generate_series(1, ${EVENTS_PER_SESSION}) e(n)
            LIMIT ${EVENT_COUNT}`,
        [
          fx.project.live.id,
          names.map((n) => n.id),
          users.map((u) => u.user_key),
          paths.map((p) => p.id),
          SESSIONS,
          new Date('2026-01-01T00:00:00Z'),
        ],
      );
    });

    const measured = await measureTable('events');
    const bytesPerEvent = (measured.heap + measured.indexes) / measured.rows;

    console.log(
      `\n  storage budget: ${bytesPerEvent.toFixed(1)} bytes/event over ${measured.rows.toLocaleString()} events` +
        `\n    heap    ${(measured.heap / measured.rows).toFixed(1)} B/event (${(measured.heap / 1e6).toFixed(1)} MB)` +
        `\n    indexes ${(measured.indexes / measured.rows).toFixed(1)} B/event (${(measured.indexes / 1e6).toFixed(1)} MB)` +
        measured.perIndex
          .map((i) => `\n      ${i.name}: ${(i.bytes / measured.rows).toFixed(1)} B/event`)
          .join('') +
        `\n    target  ${TARGET_BYTES_PER_EVENT} B/event \u00b120% (${(TARGET_BYTES_PER_EVENT * (1 - TOLERANCE)).toFixed(0)}\u2013${(TARGET_BYTES_PER_EVENT * (1 + TOLERANCE)).toFixed(0)})\n`,
    );

    expect(measured.rows).toBe(EVENT_COUNT);
    expect(bytesPerEvent).toBeLessThanOrEqual(TARGET_BYTES_PER_EVENT * (1 + TOLERANCE));
    expect(bytesPerEvent).toBeGreaterThanOrEqual(TARGET_BYTES_PER_EVENT * (1 - TOLERANCE));
  }, 300_000);

  it('inserts a 1,000-event batch quickly through the whole pipeline', async () => {
    await resetData();
    const live = await newFixture('Throughput');

    const at = new Date('2026-09-29T10:00:00Z');
    const batch = Array.from({ length: 1000 }, (_, i) => ({
      type: 'track' as const,
      messageId: `perf-${i}`,
      userId: `user_${i % 100}`,
      event: 'Core Action',
      timestamp: at.toISOString(),
      properties: { object: 'invoice', count: i },
    }));

    const started = process.hrtime.bigint();
    const response = await postBatch(batch, {
      key: live.secretKey,
      receivedAt: at,
      sentAt: at.toISOString(),
      // The default burst is 2,000, so a 1,000-event batch fits.
    });
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

    const body = reply(response);
    const perSecond = (body.accepted / elapsedMs) * 1000;

    console.log(
      `\n  throughput: ${body.accepted} events in ${elapsedMs.toFixed(0)} ms = ${perSecond.toFixed(0)} events/second` +
        `\n    (full pipeline: auth, rate limit, validation, dedupe, identity, sessions,\n` +
        `     name dictionary, daily cap, event write, step state)\n`,
    );

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(1000);
    // A guard against a catastrophic regression, not a performance target: a real
    // number is printed above and recorded in the milestone report.
    expect(perSecond).toBeGreaterThan(50);
  }, 120_000);
});

/** VACUUM FULL cannot run in a transaction, so it needs a plain connection. */
async function vacuumFull(table: string): Promise<void> {
  const client = await adminClient();
  try {
    await client.query(`VACUUM FULL ${table}`);
  } finally {
    await client.end();
  }
}

interface Measured {
  heap: number;
  indexes: number;
  rows: number;
  perIndex: { name: string; bytes: number }[];
}

async function measureTable(table: string): Promise<Measured> {
  const client = await adminClient();
  try {
    await client.query(`ANALYZE ${table}`);
    const { rows: totals } = await client.query<{ heap: string; indexes: string; count: string }>(
      `SELECT pg_table_size($1)   AS heap,
              pg_indexes_size($1) AS indexes,
              (SELECT count(*) FROM events) AS count`,
      [table],
    );
    const { rows: perIndex } = await client.query<{ name: string; bytes: string }>(
      `SELECT indexrelname AS name, pg_relation_size(indexrelid) AS bytes
         FROM pg_stat_user_indexes WHERE relname = $1 ORDER BY 2 DESC`,
      [table],
    );
    return {
      heap: Number(totals[0]?.heap ?? 0),
      indexes: Number(totals[0]?.indexes ?? 0),
      rows: Number(totals[0]?.count ?? 0),
      perIndex: perIndex.map((i) => ({ name: i.name, bytes: Number(i.bytes) })),
    };
  } finally {
    await client.end();
  }
}
