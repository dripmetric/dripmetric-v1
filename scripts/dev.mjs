#!/usr/bin/env node
/**
 * `pnpm dev` — Postgres, migrations, then the web app and the worker together.
 * One command, so a fresh clone is running in under a minute.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.log('Created .env from .env.example.');
}

// The children inherit process.env, so loading it once here is what gets the web app
// its configuration; the migrate CLI and the worker load it themselves as well, so
// each also works when run on its own.
process.loadEnvFile('.env');

function run(command, args, label) {
  const child = spawn(command, args, { stdio: 'inherit', env: process.env });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${label} exited with code ${code}`);
      process.exit(code);
    }
  });
  return child;
}

console.log('Starting Postgres…');
execFileSync('docker', ['compose', 'up', '-d', 'postgres'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/wait-for-db.mjs'], { stdio: 'inherit' });

console.log('Applying migrations…');
execFileSync('pnpm', ['--filter', '@dripmetric/db', 'migrate'], { stdio: 'inherit' });

const web = run('pnpm', ['--filter', '@dripmetric/web', 'dev'], 'web');
const worker = run('pnpm', ['--filter', '@dripmetric/worker', 'dev'], 'worker');

const stop = () => {
  web.kill('SIGTERM');
  worker.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
