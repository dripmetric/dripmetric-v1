import type pg from 'pg';
import { pool, workerDbPool, type QueryResultRow } from './pool.js';

/**
 * Tenant scoping (brief section 4, CLAUDE.md invariant 1).
 *
 * "A query without a project must be impossible to write."
 *
 * This module is the only way the rest of the codebase reaches tenant data, and it
 * never exports a bare `query`. A caller gets a `ScopedDb` only inside the callback of
 * `withProject()`, which has already opened a transaction and set `app.project_id`.
 * Row-level security reads that setting, so even a hand-written query inside the
 * callback cannot see another project's rows. Cross-project work has to say so out
 * loud, through `withoutProject(reason, ...)`, which is logged.
 */

export interface ScopedDb {
  /** The project every query inside this scope is confined to. */
  readonly projectId: number;
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  /** Exactly one row, or an error naming the query. For `RETURNING` and by-id reads. */
  one<T extends QueryResultRow = QueryResultRow>(sql: string, params?: readonly unknown[]): Promise<T>;
  maybeOne<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T | null>;
  /** Row count only, for INSERT/UPDATE/DELETE. */
  exec(sql: string, params?: readonly unknown[]): Promise<number>;
}

/** The same surface, with no project confinement. Only `withoutProject` hands one out. */
export type UnscopedDb = Omit<ScopedDb, 'projectId'>;

function wrap(client: pg.PoolClient): UnscopedDb {
  return {
    async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: readonly unknown[] = []) {
      // No `name` is ever passed, so `pg` never prepares the statement and the code
      // works through Supabase's transaction pooler (brief section 12).
      const result = await client.query<T>(sql, params as unknown[]);
      return result.rows;
    },
    async one<T extends QueryResultRow = QueryResultRow>(sql: string, params: readonly unknown[] = []) {
      const result = await client.query<T>(sql, params as unknown[]);
      const row = result.rows[0];
      if (result.rows.length !== 1 || row === undefined) {
        throw new Error(`Expected exactly one row, got ${result.rows.length}: ${firstLine(sql)}`);
      }
      return row;
    },
    async maybeOne<T extends QueryResultRow = QueryResultRow>(sql: string, params: readonly unknown[] = []) {
      const result = await client.query<T>(sql, params as unknown[]);
      if (result.rows.length > 1) {
        throw new Error(`Expected at most one row, got ${result.rows.length}: ${firstLine(sql)}`);
      }
      return result.rows[0] ?? null;
    },
    async exec(sql: string, params: readonly unknown[] = []) {
      const result = await client.query(sql, params as unknown[]);
      return result.rowCount ?? 0;
    },
  };
}

function firstLine(sql: string): string {
  return sql.trim().split('\n')[0]?.slice(0, 120) ?? '';
}

export interface ScopeOptions {
  /** Use the worker's direct connection rather than the request pool. */
  worker?: boolean;
}

/**
 * Run `fn` confined to one project, inside one transaction.
 *
 * The transaction is not incidental: `SET LOCAL` only lasts for one, and the ingest
 * pipeline needs the event, the session and the step state written together anyway
 * (brief section 5, step 8).
 */
export async function withProject<T>(
  projectId: number,
  fn: (db: ScopedDb) => Promise<T>,
  options: ScopeOptions = {},
): Promise<T> {
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error(`withProject needs a positive integer project id, got ${String(projectId)}`);
  }
  const client = await (options.worker ? workerDbPool() : pool()).connect();
  try {
    await client.query('BEGIN');
    // set_config with a parameter, so a project id can never be concatenated into SQL.
    await client.query('SELECT set_config($1, $2, true)', ['app.project_id', String(projectId)]);
    const db: ScopedDb = { projectId, ...wrap(client) };
    const result = await fn(db);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Reasons that may legitimately cross projects. Anything else has to be added here
 *  on purpose, which is the point: the list is short and reviewable. */
export const CROSS_PROJECT_REASONS = [
  'create-project',
  'founder-auth',
  'resolve-api-key',
  'worker-sweep',
  'migrations',
  'admin-script',
  'test-fixture',
] as const;
export type CrossProjectReason = (typeof CROSS_PROJECT_REASONS)[number];

/**
 * The named escape hatch. Creating a project, logging a founder in, resolving an API
 * key to its project, and the worker's per-project sweeps all genuinely start outside
 * any one project. Each call says which, and the reason is logged.
 */
export async function withoutProject<T>(
  reason: CrossProjectReason,
  fn: (db: UnscopedDb) => Promise<T>,
  options: ScopeOptions = {},
): Promise<T> {
  const client = await (options.worker ? workerDbPool() : pool()).connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.bypass_rls', 'on']);
    const result = await fn(wrap(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
