#!/usr/bin/env tsx
/**
 * `pnpm db:migrate` and `pnpm db:reset`.
 *
 * Runs as the database OWNER (ADMIN_DATABASE_URL, falling back to DATABASE_URL). It
 * then makes sure the non-owner
 * application role exists, because row-level security does not apply to the owner and
 * the whole point of the role is that it does. In development the role is given a
 * login password so `pnpm dev` can use it; in production the password is set out of
 * band (docs/runbook.md) and this step is skipped.
 */
import pg from 'pg';
import { loadRootEnv } from '../load-env.js';
import { runMigrations, resetDatabase } from '../migrate.js';

loadRootEnv();

const reset = process.argv.includes('--reset');
const url = process.env['ADMIN_DATABASE_URL'] || process.env['DATABASE_URL'];
if (!url) {
  console.error('ADMIN_DATABASE_URL is not set. Copy .env.example to .env.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  if (reset) {
    console.log('Dropping and recreating the public schema…');
    await resetDatabase(client);
  }

  const { applied, skipped } = await runMigrations(client);
  for (const name of applied) console.log(`applied  ${name}`);
  if (skipped.length > 0) console.log(`${skipped.length} already applied`);
  if (applied.length === 0 && !reset) console.log('Nothing to do: the database is up to date.');

  if (process.env['NODE_ENV'] !== 'production') {
    // Dev-only password, so a fresh clone works with the committed .env.example.
    await client.query(`ALTER ROLE dripmetric_app LOGIN PASSWORD 'dripmetric_app'`);
    console.log('Application role dripmetric_app is ready (development password).');
  }
} finally {
  await client.end();
}
