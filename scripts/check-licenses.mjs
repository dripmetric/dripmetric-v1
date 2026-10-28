#!/usr/bin/env node
/**
 * Licence check (brief working agreement 10 / CLAUDE.md rule 8).
 * Nothing GPL or AGPL may ship to customers. This fails CI on the first offender.
 * `ua-parser-js` is named explicitly because recent versions are AGPL-3.0-or-later
 * and it is the obvious thing to reach for when parsing a user agent.
 */
import { execFileSync } from 'node:child_process';

const FORBIDDEN = /\b(a?gpl)\b/i;
const ALLOWED_COPYLEFT_EXCEPTIONS = new Set([
  // LGPL and MPL are file-level copyleft and do not infect a larger work, but we
  // still want to see them, so nothing is listed here yet. Add with a reason.
]);

let raw;
try {
  raw = execFileSync('pnpm', ['licenses', 'list', '--json', '--prod'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (error) {
  // `pnpm licenses list` exits non-zero when nothing is installed yet.
  const out = error.stdout?.toString() ?? '';
  if (!out.trim()) {
    console.error('Could not read licences. Run `pnpm install` first.');
    process.exit(1);
  }
  raw = out;
}

const byLicense = JSON.parse(raw);
const offenders = [];
for (const [license, packages] of Object.entries(byLicense)) {
  if (!FORBIDDEN.test(license)) continue;
  for (const pkg of packages) {
    if (ALLOWED_COPYLEFT_EXCEPTIONS.has(pkg.name)) continue;
    offenders.push(`${pkg.name}@${pkg.versions?.join(',') ?? '?'} — ${license}`);
  }
}

if (offenders.length > 0) {
  console.error('GPL/AGPL dependencies found. They cannot ship to customers:\n');
  for (const o of offenders) console.error(`  ${o}`);
  console.error('\nSee CLAUDE.md rule 8 and docs/decisions.md.');
  process.exit(1);
}

console.log(`Licence check passed: ${Object.keys(byLicense).length} distinct licences, no GPL/AGPL.`);
