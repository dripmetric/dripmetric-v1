import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';

/**
 * Plain-SQL migrations (settled decision D2), run in filename order, each inside one
 * transaction, each recorded in `schema_migrations`.
 *
 * Forward-only: a mistake is corrected by a new migration, never by editing an old
 * one, because an edited migration has already run somewhere else.
 *
 * A migration library would add a dependency and its own table format for something
 * that is `ls`, `sort`, `BEGIN`, run, record — see docs/decisions.md.
 */

const here = dirname(fileURLToPath(import.meta.url));
// src/ when running from TypeScript, dist/ when built; migrations sit beside both.
export const MIGRATIONS_DIR = join(here, '..', 'migrations');

export interface Migration {
  name: string;
  sql: string;
}

export async function loadMigrations(dir: string = MIGRATIONS_DIR): Promise<Migration[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  return Promise.all(
    files.map(async (name) => ({ name, sql: await readFile(join(dir, name), 'utf8') })),
  );
}

export async function appliedMigrations(client: pg.PoolClient | pg.Client): Promise<Set<string>> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
  return new Set(rows.map((r) => r.name));
}

export interface MigrateResult {
  applied: string[];
  skipped: string[];
}

export async function runMigrations(
  client: pg.PoolClient | pg.Client,
  dir: string = MIGRATIONS_DIR,
): Promise<MigrateResult> {
  const migrations = await loadMigrations(dir);
  const already = await appliedMigrations(client);
  const result: MigrateResult = { applied: [], skipped: [] };

  for (const migration of migrations) {
    if (already.has(migration.name)) {
      result.skipped.push(migration.name);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
      await client.query('COMMIT');
      result.applied.push(migration.name);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${migration.name} failed: ${(error as Error).message}`, { cause: error });
    }
  }
  return result;
}

/** Drops everything and rebuilds. Dev and tests only; it refuses in production. */
export async function resetDatabase(client: pg.PoolClient | pg.Client): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('resetDatabase refuses to run in production.');
  }
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  // The owner must keep its own access after the schema is recreated.
  await client.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
  await client.query('GRANT ALL ON SCHEMA public TO public');
}
