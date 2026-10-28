#!/usr/bin/env node
/**
 * Guards against a package script being shadowed by a pnpm built-in command.
 *
 * This is here because it already happened: `pnpm licenses` and `pnpm ci` ran pnpm's
 * own commands, not our scripts, so the licence check never ran in CI and `pnpm ci`
 * errored with "not implemented". A built-in always wins over a same-named script,
 * silently, and `pnpm run <name>` working is no help when the documented command is
 * `pnpm <name>`.
 *
 * Script names containing a colon (`check:licenses`) can never collide, which is why
 * ours use one.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * These ARE pnpm built-ins, but pnpm's implementation of them runs the package
 * script of the same name, so defining them is correct and safe.
 */
const SAFE_ALIASES = new Set(['test', 'start']);

const help = execFileSync('pnpm', ['help', '-a'], { encoding: 'utf8' });

// Each command line looks like "  ls, list   Print all the versions…" or
// "      audit    Checks for known security issues…".
const builtins = new Set();
for (const line of help.split('\n')) {
  const match = /^ {2,}((?:[a-z][a-z-]*, )?[a-z][a-z-]*) {2,}\S/.exec(line);
  if (!match) continue;
  for (const name of match[1].split(',')) builtins.add(name.trim());
}

if (builtins.size < 20) {
  console.error(
    `Only parsed ${builtins.size} pnpm commands from \`pnpm help -a\`; its output format probably changed.`,
  );
  process.exit(1);
}

const { scripts = {} } = JSON.parse(readFileSync('package.json', 'utf8'));
const shadowed = Object.keys(scripts).filter(
  (name) => builtins.has(name) && !SAFE_ALIASES.has(name),
);

if (shadowed.length > 0) {
  console.error('These package scripts are shadowed by a pnpm built-in command:\n');
  for (const name of shadowed) {
    console.error(`  "${name}" — \`pnpm ${name}\` runs pnpm's own command, not this script.`);
  }
  console.error(
    '\nRename them, ideally with a colon (e.g. "check:licenses"), which can never collide.',
  );
  process.exit(1);
}

console.log(
  `Script names check passed: ${Object.keys(scripts).length} scripts, none shadowed by any of pnpm's ${builtins.size} commands.`,
);
