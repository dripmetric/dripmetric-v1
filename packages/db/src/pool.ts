import pg from 'pg';
import { dbEnv } from './env.js';

/**
 * One pool per process.
 *
 * `pg` only prepares a statement when a query is given a `name`, and nothing in this
 * codebase names one. That is deliberate: Supabase's transaction pooler (port 6543)
 * does not support prepared statements, so the same code runs on a Vercel function
 * through the pooler and on the worker through a direct connection
 * (brief section 12, "Supabase connections").
 */
const { Pool } = pg;
export type PoolClient = pg.PoolClient;
export type QueryResultRow = pg.QueryResultRow;

let appPool: pg.Pool | undefined;
let workerPool: pg.Pool | undefined;

function make(connectionString: string, max: number): pg.Pool {
  const pool = new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Postgres returns timestamptz as a Date in UTC; keep that, never a local string.
    application_name: 'dripmetric',
  });
  pool.on('error', (error) => {
    // An idle client erroring must not take the process down.
    console.error(JSON.stringify({ level: 'error', msg: 'idle pg client error', err: String(error) }));
  });
  return pool;
}

/** The request-path pool. Small, because serverless functions multiply it. */
export function pool(): pg.Pool {
  appPool ??= make(dbEnv().DATABASE_URL, 10);
  return appPool;
}

/** The worker pool: a direct or session connection, so pg-boss works. */
export function workerDbPool(): pg.Pool {
  const env = dbEnv();
  workerPool ??= make(env.WORKER_DATABASE_URL || env.DATABASE_URL, 20);
  return workerPool;
}

export async function closePools(): Promise<void> {
  await Promise.all([appPool?.end(), workerPool?.end()]);
  appPool = undefined;
  workerPool = undefined;
}
