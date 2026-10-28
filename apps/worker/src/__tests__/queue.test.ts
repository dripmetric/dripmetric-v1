import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { closePools } from '@dripmetric/db';
import { loadRootEnv, runMigrations } from '@dripmetric/db/admin';
import { QUEUE_POLICIES, QUEUES, startQueue, type Queue } from '../queue.js';

/**
 * The queue adapter (settled decision D3: keep pg-boss behind a thin adapter so it
 * can be swapped).
 *
 * This proves the thing M1 actually needs proven: a job sent on one side is received
 * on the other, through the real pg-boss against the real Postgres. If this passes,
 * the sweeps, summaries and reports of M6 onwards are handlers rather than plumbing.
 */
describe('queue adapter', () => {
  let queue: Queue;

  beforeAll(async () => {
    loadRootEnv();
    const client = new pg.Client({ connectionString: process.env['ADMIN_DATABASE_URL'] });
    await client.connect();
    try {
      await runMigrations(client);
      await client.query(`ALTER ROLE dripmetric_app LOGIN PASSWORD 'dripmetric_app'`);
    } finally {
      await client.end();
    }
    queue = await startQueue();
  }, 60_000);

  afterAll(async () => {
    await queue?.stop();
    await closePools();
  });

  it('declares every queue the worker runs', async () => {
    // Since pg-boss 10 a queue must exist before anything is sent to it, so a typo in
    // a queue name is a startup error rather than a job that vanishes.
    for (const name of Object.values(QUEUES)) {
      await expect(queue.ensure(name, QUEUE_POLICIES[name] ?? 'standard')).resolves.toBeUndefined();
    }
  });

  it('round-trips a job from send to handler', async () => {
    const name = `test-roundtrip-${Date.now()}`;
    await queue.ensure(name);

    const received: { projectId: number; userKey: number }[] = [];
    await queue.work<{ projectId: number; userKey: number }>(
      name,
      async (jobs) => {
        for (const job of jobs) received.push(job.data);
      },
      { pollingIntervalSeconds: 1 },
    );

    await queue.send(name, { projectId: 1, userKey: 42 });

    const deadline = Date.now() + 20_000;
    while (received.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    expect(received).toEqual([{ projectId: 1, userKey: 42 }]);
  }, 40_000);

  it('collapses duplicate work under one singleton key on a `short` queue', async () => {
    const name = `test-singleton-${Date.now()}`;
    // The policy has to be set when the queue is DECLARED. pg-boss's default
    // `standard` policy ignores singletonKey for deduplication, which is the easy
    // thing to assume and wrong — this test is what caught it.
    await queue.ensure(name, 'short');

    // Ingest queues one follow-up per person per batch; two batches for the same
    // person must not mean two recomputes.
    await queue.send(name, { userKey: 7 }, { singletonKey: 'user-7' });
    await queue.send(name, { userKey: 7 }, { singletonKey: 'user-7' });

    const received: unknown[] = [];
    await queue.work(
      name,
      async (jobs) => {
        received.push(...jobs.map((j) => j.data));
      },
      { pollingIntervalSeconds: 1, batchSize: 10 },
    );

    const deadline = Date.now() + 15_000;
    while (received.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    expect(received).toHaveLength(1);
  }, 40_000);

  it('reports queue health, which is what M13 monitors', async () => {
    const health = await queue.health();
    expect(Array.isArray(health.queues)).toBe(true);
    expect(health.queues.map((q) => q.name)).toContain(QUEUES.sweepLeaks);
  });
});
