import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { closePools, createProject, withProject, type CreatedProject } from '@dripmetric/db';
import { loadRootEnv, runMigrations } from '@dripmetric/db/admin';
import { handleBatch } from '@dripmetric/ingest';
import { runSimulation } from '../run.js';
import { configureProject } from '../setup.js';
import { scoreIngest, share } from '../score.js';
import { product } from '../products/index.js';
import { deliveredAt } from '../faults.js';
import type { SimMessage } from '../types.js';

/**
 * M2 exit checks that need real ingest:
 *
 *   "injected duplicates do not change counts"
 *   "late events are accepted and flagged `late`"
 *
 * The CLI loads over HTTP; these tests call the same pipeline directly, so they run
 * in CI without a server. The code path is identical — a route handler is a thin
 * adapter over `handleBatch`.
 */

let migrated = false;

async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  loadRootEnv();
  const client = new pg.Client({ connectionString: process.env['ADMIN_DATABASE_URL'] });
  await client.connect();
  try {
    await runMigrations(client);
    await client.query(`ALTER ROLE dripmetric_app LOGIN PASSWORD 'dripmetric_app'`);
  } finally {
    await client.end();
  }
  migrated = true;
}

async function resetData(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env['ADMIN_DATABASE_URL'] });
  await client.connect();
  try {
    await client.query("SET lock_timeout = '10s'");
    for (const table of [
      'events',
      'user_step_state',
      'daily_event_counts',
      'monthly_active_users',
      'rate_buckets',
      'anonymous_links',
      'anonymous_visitors',
      'account_members',
      'sessions',
      'funnel_steps',
      'funnels',
      'url_rules',
      'paths',
      'event_names',
      'audit_log',
      'api_keys',
      'project_members',
      'magic_link_tokens',
      'founder_sessions',
      'founder_users',
    ]) {
      await client.query(`DELETE FROM ${table}`);
    }
    await client.query('UPDATE end_users SET account_id = NULL');
    await client.query('DELETE FROM accounts');
    await client.query('DELETE FROM end_users');
    await client.query("DELETE FROM projects WHERE mode = 'test'");
    await client.query('DELETE FROM projects');
  } finally {
    await client.end();
  }
}

/** Sends a run through the pipeline the way the HTTP loader does. */
async function send(
  messages: readonly SimMessage[],
  keys: { publishable: string; secret: string },
): Promise<{ ok: number; duplicate: number; filtered: number; errors: Record<string, number> }> {
  const tally = { ok: 0, duplicate: 0, filtered: 0, errors: {} as Record<string, number> };

  // Consecutive runs sharing a key, exactly as load.ts groups them: an identify()
  // has to arrive before the events that depend on its traits.
  let group: SimMessage[] = [];
  let serverSide = messages[0]?.serverSide ?? false;

  const flush = async () => {
    if (group.length === 0) return;
    const receivedAt = group.reduce(
      (latest, m) => (deliveredAt(m) > latest ? deliveredAt(m) : latest),
      new Date(0),
    );
    const response = await handleBatch({
      body: JSON.stringify({
        batch: group.map((m) => m.message),
        sentAt: receivedAt.toISOString(),
      }),
      headers: {
        authorization: `Bearer ${serverSide ? keys.secret : keys.publishable}`,
        'content-type': 'application/json',
      },
      receivedAt,
    });
    const body = response.body as { results?: { status: string; code: string }[] };
    for (const item of body.results ?? []) {
      if (item.status === 'ok') tally.ok += 1;
      else if (item.status === 'duplicate') tally.duplicate += 1;
      else if (item.status === 'filtered') tally.filtered += 1;
      else tally.errors[item.code] = (tally.errors[item.code] ?? 0) + 1;
    }
    group = [];
  };

  for (const message of messages) {
    if (message.serverSide !== serverSide || group.length >= 200) {
      await flush();
      serverSide = message.serverSide;
    }
    group.push(message);
  }
  await flush();
  return tally;
}

function keysOf(project: CreatedProject): { publishable: string; secret: string } {
  const publishable = project.keys.find((k) => k.kind === 'publishable' && k.mode === 'live');
  const secret = project.keys.find((k) => k.kind === 'secret' && k.mode === 'live');
  if (!publishable || !secret) throw new Error('createProject did not return both live keys.');
  return { publishable: publishable.token, secret: secret.token };
}

describe('a simulator run through real ingest', () => {
  beforeAll(ensureMigrated, 60_000);
  beforeEach(resetData);
  afterAll(closePools);

  it('lands a clean run and filters the bots and the founder’s own team', async () => {
    const project = await createProject({
      name: 'Sim clean',
      settings: { internalDomains: ['ledgerly-internal.com'] },
    });
    const run = runSimulation({ product: 'selfserve', users: 60, seed: 1 });

    const tally = await send(run.messages, keysOf(project));

    expect(tally.errors).toEqual({});
    expect(tally.ok).toBeGreaterThan(0);
    // Bots and internal users are supposed to be dropped, and the truth file says
    // how many there are, so this is a real comparison.
    expect(tally.filtered).toBeGreaterThan(0);

    const stored = await withProject(project.live.id, (db) =>
      db.query<{ count: string }>('SELECT count(*) FROM events'),
    );
    // Only track and page messages become event rows. identify() and group() return
    // `ok` and write no row: they describe a person, not something that happened.
    const rowProducing = run.messages.filter(
      (m) => m.message.type === 'track' || m.message.type === 'page',
    ).length;
    expect(Number(stored[0]!.count)).toBeGreaterThan(0);
    expect(Number(stored[0]!.count)).toBeLessThanOrEqual(rowProducing);

    // Not one crawler event survived.
    const bots = run.truthFile.truth.filter((t) => t.persona === 'bot');
    expect(bots.length).toBeGreaterThan(0);
    const botRows = await withProject(project.live.id, (db) =>
      db.query(
        `SELECT 1 FROM events e JOIN end_users u ON u.project_id = e.project_id AND u.user_key = e.user_key
          WHERE u.external_id = ANY($1)`,
        [bots.map((b) => b.userId)],
      ),
    );
    expect(botRows).toHaveLength(0);
  }, 120_000);

  it('injected duplicates do not change counts', async () => {
    const cleanProject = await createProject({ name: 'Sim clean' });
    const clean = runSimulation({ product: 'selfserve', users: 50, seed: 1 });
    const cleanTally = await send(clean.messages, keysOf(cleanProject));
    const cleanRows = await withProject(cleanProject.live.id, (db) =>
      db.query<{ count: string }>('SELECT count(*) FROM events'),
    );

    const faultyProject = await createProject({ name: 'Sim duplicated' });
    const faulty = runSimulation({
      product: 'selfserve',
      users: 50,
      seed: 1,
      faults: ['duplicates'],
    });
    const faultyTally = await send(faulty.messages, keysOf(faultyProject));
    const faultyRows = await withProject(faultyProject.live.id, (db) =>
      db.query<{ count: string }>('SELECT count(*) FROM events'),
    );

    // More messages arrived, and every extra one was recognised as a retry.
    expect(faulty.messages.length).toBeGreaterThan(clean.messages.length);
    expect(faultyTally.duplicate).toBeGreaterThan(cleanTally.duplicate);

    // And the stored count is identical. This is the idempotency promise.
    expect(faultyRows[0]!.count).toBe(cleanRows[0]!.count);
  }, 180_000);

  it('accepts late events and flags them `late`', async () => {
    const project = await createProject({ name: 'Sim late' });
    const run = runSimulation({
      product: 'selfserve',
      users: 50,
      seed: 1,
      faults: ['late-events'],
    });

    const tally = await send(run.messages, keysOf(project));
    expect(tally.errors).toEqual({});

    const rows = await withProject(project.live.id, (db) =>
      db.query<{ late: string; total: string }>(
        // Bit 0 of flags is FLAG_LATE.
        `SELECT count(*) FILTER (WHERE flags & 1 = 1) AS late, count(*) AS total FROM events`,
      ),
    );
    expect(Number(rows[0]!.late)).toBeGreaterThan(0);
    expect(Number(rows[0]!.total)).toBeGreaterThan(Number(rows[0]!.late));
  }, 120_000);

  it('keeps step state correct despite late and out-of-order events', async () => {
    // The real risk with late events: a stale event overwriting a newer state.
    // `user_step_state` keeps the EARLIEST entered and completed times, so it cannot.
    const orderedProject = await createProject({ name: 'Sim ordered' });
    const lateProject = await createProject({ name: 'Sim late' });

    const ordered = runSimulation({ product: 'selfserve', users: 40, seed: 1 });
    const late = runSimulation({
      product: 'selfserve',
      users: 40,
      seed: 1,
      faults: ['late-events'],
    });

    // A funnel in both projects, so there is step state to compare.
    for (const project of [orderedProject, lateProject]) {
      await withProject(project.live.id, async (db) => {
        const funnel = await db.one<{ id: number }>(
          `INSERT INTO funnels (project_id, name) VALUES ($1, 'Onboarding') RETURNING id`,
          [project.live.id],
        );
        for (const [position, step] of ordered.truthFile.steps.entries()) {
          await db.exec(
            `INSERT INTO funnel_steps (project_id, funnel_id, position, label, event_name, importance)
             VALUES ($1, $2, $3, $4, $5, 'key')`,
            [project.live.id, funnel.id, position, step.label, step.eventName],
          );
        }
      });
    }

    await send(ordered.messages, keysOf(orderedProject));
    await send(late.messages, keysOf(lateProject));

    const stateOf = (id: number) =>
      withProject(id, (db) =>
        db.query<{ label: string; first_entered_at: Date | null; first_completed_at: Date | null }>(
          `SELECT s.label, st.first_entered_at, st.first_completed_at
             FROM user_step_state st
             JOIN funnel_steps s ON s.project_id = st.project_id AND s.id = st.step_id
             JOIN end_users u ON u.project_id = st.project_id AND u.user_key = st.user_key
            ORDER BY u.external_id, s.position`,
        ),
      );

    const a = await stateOf(orderedProject.live.id);
    const b = await stateOf(lateProject.live.id);

    expect(a.length).toBeGreaterThan(0);
    // Identical step state from identical events delivered in a different order.
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  }, 180_000);

  it('corrects a skewed device clock instead of scattering the events', async () => {
    const project = await createProject({ name: 'Sim skewed' });
    const run = runSimulation({ product: 'selfserve', users: 40, seed: 1, faults: ['clock-skew'] });

    await send(run.messages, keysOf(project));

    const rows = await withProject(project.live.id, (db) =>
      db.query<{ count: string }>(
        // Nothing should sit in the future, and nothing wildly before the run began.
        `SELECT count(*) FROM events
          WHERE occurred_at > received_at + interval '1 minute'
             OR occurred_at < $1::timestamptz - interval '1 day'`,
        [run.truthFile.startedAt],
      ),
    );
    expect(Number(rows[0]!.count)).toBe(0);
  }, 120_000);

  it('absorbs a burst without error, capping it rather than storing it all', async () => {
    const project = await createProject({
      name: 'Sim burst',
      // A low cap so the guard is visible in a small run.
      settings: { dailyRowsPerUserPerEvent: 20 },
    });
    const run = runSimulation({ product: 'selfserve', users: 30, seed: 1, faults: ['burst'] });

    const tally = await send(run.messages, keysOf(project));

    // The burst is absorbed: no errors, and the overflow is counted, not stored.
    expect(tally.errors).toEqual({});
    const capped = await withProject(project.live.id, (db) =>
      db.query<{ overflow: string }>(
        `SELECT coalesce(sum(overflow_count), 0) AS overflow FROM daily_event_counts`,
      ),
    );
    expect(Number(capped[0]!.overflow)).toBeGreaterThan(0);
  }, 180_000);
});

/**
 * Scoring against truth, in CI (brief section 10).
 *
 * This is the simulator's reason to exist. Every line below is a share of a KNOWN
 * population: the truth file recorded who would stall or leave before ingest saw
 * anything, so a shortfall is a real gap rather than a disagreement between two
 * guesses. Four bugs in the ingest pipeline were found by exactly this check:
 *
 *   - within-batch duplicates reported `ok` twice for one stored row
 *   - the request user-agent beat the per-message one, so no crawler was dropped
 *   - internal users kept events that arrived before their identify
 *   - only the dozen mappable meanings were recognised as canonical, so step ENTRY
 *     was lost for every step without a URL rule
 */
describe('scoring a run against the truth file', () => {
  beforeAll(ensureMigrated, 60_000);
  beforeEach(resetData);
  afterAll(closePools);

  for (const key of ['selfserve', 'b2b', 'devtool'] as const) {
    it(`puts every known person and event in the database for ${key}`, async () => {
      const definition = product(key);
      const project = await createProject({
        name: `Score ${key}`,
        settings: {
          internalDomains: ['ledgerly-internal.com'],
          listPriceAmount: definition.listPriceAmount,
          trialDays: definition.trialDays,
        },
      });

      // The funnel, URL rules and core-action mapping a founder confirms at setup.
      // Without them there is no step state, so no stall is visible to any rule.
      await withProject(project.live.id, (db) => configureProject(db, definition));

      const run = runSimulation({ product: key, users: 150, seed: 11 });
      await send(run.messages, keysOf(project));

      const score = await withProject(project.live.id, (db) => scoreIngest(db, run.truthFile));

      // The truth file has to describe a funnel that actually leaks, or these
      // shares would be vacuously true.
      expect(score.shouldBeTracked).toBeGreaterThan(40);
      expect(score.shouldHaveStalled).toBeGreaterThan(10);
      expect(score.shouldBeFiltered).toBeGreaterThan(0);

      // Brief section 10: "Aim for at least 90% on the simulator and explain any
      // shortfall." These are all at 100%, so there is nothing to explain.
      expect(share(score.actuallyFiltered, score.shouldBeFiltered)).toBe(100);
      expect(share(score.actuallyTracked, score.shouldBeTracked)).toBe(100);
      expect(share(score.actuallyPaid, score.shouldHavePaid)).toBe(100);
      expect(share(score.stallDetectable, score.shouldHaveStalled)).toBeGreaterThanOrEqual(90);
      expect(share(score.highIntentDetectable, score.shouldBeHighIntent)).toBeGreaterThanOrEqual(
        90,
      );
    }, 240_000);
  }

  it('still scores 100% with every fault injected at once', async () => {
    // A fault is a tracking problem, not a user problem: the person still stalled.
    // So duplicates, late events, skewed clocks and a burst must not cost us a
    // single known person or stall.
    const definition = product('selfserve');
    const project = await createProject({
      name: 'Score faulty',
      settings: { internalDomains: ['ledgerly-internal.com'], dailyRowsPerUserPerEvent: 500 },
    });
    await withProject(project.live.id, (db) => configureProject(db, definition));

    const run = runSimulation({
      product: 'selfserve',
      users: 120,
      seed: 13,
      faults: ['duplicates', 'late-events', 'clock-skew'],
    });
    await send(run.messages, keysOf(project));

    const score = await withProject(project.live.id, (db) => scoreIngest(db, run.truthFile));

    expect(share(score.actuallyFiltered, score.shouldBeFiltered)).toBe(100);
    expect(share(score.actuallyTracked, score.shouldBeTracked)).toBe(100);
    expect(share(score.stallDetectable, score.shouldHaveStalled)).toBeGreaterThanOrEqual(90);
  }, 240_000);
});
