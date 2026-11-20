#!/usr/bin/env tsx
/**
 * `pnpm waitlist:export` and `pnpm waitlist:forward`.
 *
 *   pnpm waitlist:export                  # every address → waitlist-export-<date>.csv
 *   pnpm waitlist:export --out list.csv   # …or a path of your choosing
 *   pnpm waitlist:forward                 # dry run: how many are waiting, and where to
 *   pnpm waitlist:forward --send          # send them to the automation, oldest first
 *
 * Runs as the database OWNER (ADMIN_DATABASE_URL), the only role that can read the
 * list. The export is also the backup while the database is on Supabase Free, which
 * has none (docs/runbook.md). The CSV holds personal data: it is written readable by
 * you alone and `waitlist-export-*.csv` is gitignored.
 */
import { writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import pg from 'pg';
import { loadRootEnv } from '../load-env.js';
import { connectionOptions } from '../tls.js';
import { waitlistSettings } from '../waitlist.js';
import {
  countPendingWaitlist,
  exportWaitlistCsv,
  forwardPendingWaitlist,
} from '../waitlist-admin.js';

loadRootEnv();

const [command, ...args] = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

if (command !== 'export' && command !== 'forward') {
  console.error('Usage: pnpm waitlist:export [--out <file>]  |  pnpm waitlist:forward [--send]');
  process.exit(2);
}

const url = process.env['ADMIN_DATABASE_URL'];
if (!url) {
  console.error(
    'ADMIN_DATABASE_URL is not set: the owner connection is the only one that can read the list.',
  );
  process.exit(1);
}

const client = new pg.Client(
  connectionOptions(url, { caCert: process.env['DATABASE_CA_CERT'], requireTls: true }),
);
await client.connect();

try {
  if (command === 'export') {
    const now = new Date();
    const { csv, rows } = await exportWaitlistCsv(client);
    // pnpm runs package scripts from the package folder; INIT_CWD is where you typed.
    const base = process.env['INIT_CWD'] ?? process.cwd();
    const chosen = option('--out') ?? `waitlist-export-${now.toISOString().slice(0, 10)}.csv`;
    const path = isAbsolute(chosen) ? chosen : join(base, chosen);
    writeFileSync(path, csv, { mode: 0o600 });
    console.log(`Wrote ${rows} address${rows === 1 ? '' : 'es'} to ${path}`);
  } else {
    const settings = waitlistSettings(process.env);
    const pending = await countPendingWaitlist(client);
    if (!settings.automation) {
      console.log(
        settings.automationProblem
          ? `Automation is switched on but incomplete: ${settings.automationProblem}.`
          : 'Automation is off (WAITLIST_AUTOMATION is not "on"). Nothing is sent.',
      );
      console.log(`${pending} address${pending === 1 ? ' is' : 'es are'} waiting.`);
    } else if (!flag('--send')) {
      const host = new URL(settings.automation.url).host;
      console.log(`${pending} address${pending === 1 ? '' : 'es'} would go to ${host}.`);
      console.log('Dry run: nothing was sent. Add --send to send them.');
    } else {
      const { sent, failed } = await forwardPendingWaitlist(client, settings.automation, {
        now: new Date(),
      });
      console.log(
        `Sent ${sent}. Failed ${failed}${failed > 0 ? ' (still waiting; run again)' : ''}.`,
      );
      if (failed > 0) process.exitCode = 1;
    }
  }
} finally {
  await client.end();
}
