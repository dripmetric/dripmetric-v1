#!/usr/bin/env tsx
/**
 * `pnpm db:migrate` and `pnpm db:reset`.
 *
 * Runs as the database OWNER (ADMIN_DATABASE_URL, falling back to DATABASE_URL). It
 * then makes sure the non-owner
 * application role exists, because row-level security does not apply to the owner and
 * the whole point of the role is that it does. In development the role is given a
 * login password so `pnpm dev` can use it; in production the password is set out of
 * band (docs/runbook.md) and this step is skipped. The same goes for `dripmetric_site`,
 * the landing page's insert-only role (migration 0013).
 *
 * The owner password is the most valuable credential there is, so a remote database is
 * only reached over verified TLS: DATABASE_CA_CERT, or an explicit sslmode (tls.ts).
 */
import pg from 'pg';
import { loadRootEnv } from '../load-env.js';
import { runMigrations, resetDatabase } from '../migrate.js';
import { connectionOptions, isLocalDatabase } from '../tls.js';

loadRootEnv();

const reset = process.argv.includes('--reset');

/*
 * `--shadow` migrates the shadow copy instead (settled decision 1, M13).
 *
 * The SAME migrations, because the shadow's whole purpose is being restorable: a
 * schema that had drifted from the primary would be a copy you could not switch to,
 * which is the one thing it must be. So there is no separate migration set and no
 * way to apply one.
 */
const shadow = process.argv.includes('--shadow');
const url = shadow
  ? process.env['SHADOW_DATABASE_URL']
  : process.env['ADMIN_DATABASE_URL'] || process.env['DATABASE_URL'];

if (!url) {
  console.error(
    shadow
      ? 'SHADOW_DATABASE_URL is not set. `pnpm shadow:up` starts one locally; see docs/runbook.md.'
      : 'ADMIN_DATABASE_URL is not set. Copy .env.example to .env.',
  );
  process.exit(1);
}
if (shadow) console.log('Migrating the SHADOW copy.');

// The shadow is self-managed and may be a box on a private network, so only the
// primary insists on TLS; both use the CA when one is given.
const client = new pg.Client(
  connectionOptions(url, { caCert: process.env['DATABASE_CA_CERT'], requireTls: !shadow }),
);
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

  /*
   * Dev-only passwords, so a fresh clone works with the committed .env.example — and
   * ONLY on a database on this machine. NODE_ENV alone was not enough: running
   * `pnpm db:migrate` from a laptop against Supabase, with the dev .env loaded, gave the
   * production roles these published passwords (docs/decisions.md, 2026-11-20).
   */
  if (process.env['NODE_ENV'] !== 'production' && isLocalDatabase(url)) {
    await client.query(`ALTER ROLE dripmetric_app LOGIN PASSWORD 'dripmetric_app'`);
    await client.query(`ALTER ROLE dripmetric_site LOGIN PASSWORD 'dripmetric_site'`);
    console.log('Roles dripmetric_app and dripmetric_site are ready (development passwords).');
  } else if (!shadow) {
    console.log(
      'Roles dripmetric_app and dripmetric_site exist without a password. Set each one yourself ' +
        'before anything connects as it (docs/publishing.md).',
    );
  }
} finally {
  await client.end();
}
