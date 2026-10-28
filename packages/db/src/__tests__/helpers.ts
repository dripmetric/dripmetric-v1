import pg from 'pg';
import { runMigrations } from '../admin.js';

/**
 * Integration-test helpers. Everything runs against the local Docker Postgres from
 * docker-compose.yml. Tests never touch a remote database and never call a paid API
 * (CLAUDE.md rule 3).
 */

let migrated = false;

/** Applies migrations once per test run, as the owner. */
export async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  const url = process.env['ADMIN_DATABASE_URL'];
  if (!url) throw new Error('ADMIN_DATABASE_URL is not set; see vitest.setup.ts.');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await runMigrations(client);
    await client.query(`ALTER ROLE dripmetric_app LOGIN PASSWORD 'dripmetric_app'`);
  } finally {
    await client.end();
  }
  migrated = true;
}

/** A raw owner connection, for the few assertions that must see past RLS. */
export async function adminClient(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: process.env['ADMIN_DATABASE_URL'] });
  await client.connect();
  return client;
}

/**
 * Empties tenant data between tests, leaving the reference `plans` rows alone.
 *
 * DELETE rather than TRUNCATE on purpose: TRUNCATE takes an ACCESS EXCLUSIVE lock on
 * every table at once and deadlocked against the connection pools other test files
 * still hold. These tables hold a handful of rows in a test, so DELETE costs nothing.
 */
export async function truncateAll(): Promise<void> {
  const client = await adminClient();
  try {
    await client.query("SET lock_timeout = '10s'");
    // Child rows first, so no FK check ever has to cascade.
    for (const table of [
      'audit_log',
      'api_keys',
      'project_members',
      'magic_link_tokens',
      'founder_sessions',
      'founder_users',
    ]) {
      await client.query(`DELETE FROM ${table}`);
    }
    // projects references itself (a test project points at its live sibling), so the
    // children go before the parents.
    await client.query('DELETE FROM projects WHERE mode = $1', ['test']);
    await client.query('DELETE FROM projects');
  } finally {
    await client.end();
  }
}
