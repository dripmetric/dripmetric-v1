import { closePools, withoutProject } from '@dripmetric/db';
import { loadRootEnv } from '@dripmetric/db/admin';
import { QUEUE_POLICIES, QUEUES, startQueue, type Queue } from './queue.js';
import { log } from './log.js';

/**
 * The always-on worker (settled decision D3). One process, pg-boss on the same
 * Postgres, behind the queue adapter.
 *
 * At M1 it declares its queues, proves it can round-trip a job and reports queue
 * health. The sweeps, summaries, alerts and reports arrive with the milestones that
 * need them (M6 onwards); their queue names already exist, so turning each on is a
 * handler, not a change to this file.
 */

loadRootEnv();

const SWEEP_INTERVAL_SECONDS = 5 * 60; // brief section 8.3: sweeps every 5 minutes
const HEALTH_INTERVAL_SECONDS = 60;

async function main(): Promise<void> {
  log.info('worker starting');
  const queue = await startQueue();

  for (const name of Object.values(QUEUES)) {
    await queue.ensure(name, QUEUE_POLICIES[name] ?? 'standard');
  }
  log.info('queues ready', { queues: Object.values(QUEUES) });

  // A round-trip handler, so M1 can prove the queue actually works end to end.
  await queue.work<{ projectId: number; userKey: number }>(QUEUES.recomputeIntent, async (jobs) => {
    log.debug('recompute-intent', { count: jobs.length });
    // The engine lands at M7. Until then this only proves delivery.
  });

  await queue.work(QUEUES.sweepLeaks, async () => {
    // M8. Every 5 minutes, over every project.
    log.debug('sweep-leaks tick');
  });

  // Every 5 minutes. Real cron with time zones arrives with the jobs that need them.
  await queue.schedule(QUEUES.sweepLeaks, '*/5 * * * *');

  const health = setInterval(() => {
    void reportHealth(queue);
  }, HEALTH_INTERVAL_SECONDS * 1000);
  health.unref();

  log.info('worker ready', { sweepIntervalSeconds: SWEEP_INTERVAL_SECONDS });

  const shutdown = async (signal: string) => {
    log.info('worker stopping', { signal });
    clearInterval(health);
    await queue
      .stop()
      .catch((error: unknown) => log.error('queue stop failed', { err: String(error) }));
    await closePools();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

/** Queue depth, oldest job age and failure rate: the M13 metrics, wired from the start. */
async function reportHealth(queue: Queue): Promise<void> {
  try {
    const health = await queue.health();
    const busy = health.queues.filter((q) => q.pending > 0);
    if (busy.length > 0) log.info('queue health', { queues: busy });
  } catch (error) {
    log.error('queue health failed', { err: String(error) });
  }
}

/** A liveness check the dev script and M13's monitoring both use. */
export async function databaseReachable(): Promise<boolean> {
  try {
    await withoutProject('worker-sweep', (db) => db.query('SELECT 1'), { worker: true });
    return true;
  } catch {
    return false;
  }
}

main().catch((error: unknown) => {
  log.error('worker failed to start', { err: String(error) });
  process.exit(1);
});
