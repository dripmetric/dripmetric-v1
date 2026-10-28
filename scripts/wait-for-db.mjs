#!/usr/bin/env node
/** Waits for the Docker Postgres to accept connections, so `pnpm db:up` is reliable. */
import { execFileSync } from 'node:child_process';

const deadline = Date.now() + 60_000;
process.stdout.write('waiting for postgres');
for (;;) {
  try {
    execFileSync(
      'docker',
      ['exec', 'dripmetric-postgres', 'pg_isready', '-U', 'dripmetric', '-d', 'dripmetric'],
      {
        stdio: 'ignore',
      },
    );
    console.log('\npostgres is ready');
    process.exit(0);
  } catch {
    if (Date.now() > deadline) {
      console.error('\npostgres did not become ready in 60s. Is Docker running?');
      process.exit(1);
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 1000));
  }
}
