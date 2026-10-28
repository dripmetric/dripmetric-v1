#!/usr/bin/env node
/**
 * The published bundle.
 *
 * Builds `dripmetric/browser` and `dripmetric/server` as ESM and CJS, plus a
 * script-tag build that exposes a global, then measures the gzipped core and FAILS
 * if it is over budget (brief section 6: "CI enforces the size budgets").
 *
 * The budget is the point. A 5 KB ceiling is what forces forms, clicks and speed
 * capture into a lazy chunk instead of the core, and the number is only true if
 * something checks it on every build.
 */
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

/** brief section 6: "the core … is at most 5 KB gzipped". */
const CORE_BUDGET_BYTES = 5 * 1024;
/** The lazy chunk has no hard budget; the brief asks for its size to be reported. */
const LAZY_REPORT_ONLY = true;

const sizeOnly = process.argv.includes('--size-only');

const shared = {
  bundle: true,
  minify: true,
  target: ['es2020'],
  legalComments: 'none',
  logLevel: 'warning',
};

async function run() {
  // A clean dist every time. The lazy chunk's name carries a content hash, so a
  // stale one from a previous build would otherwise be reported as a second chunk
  // and shipped in the package.
  await rm('dist', { recursive: true, force: true });
  await mkdir('dist', { recursive: true });

  /*
   * browser: the core, as ONE self-contained ESM file.
   *
   * Not esbuild `splitting`. Splitting hoisted the shared constants into a chunk
   * that index.js imports STATICALLY, so the core actually cost index.js plus that
   * chunk while the size report measured only index.js — 5,422 B against a 5,120 B
   * budget, under-reported as 5,009. Marking the lazy module external and building
   * it separately costs a few hundred duplicated bytes and makes the core exactly
   * what a browser downloads for `import 'dripmetric/browser'`.
   */
  await build({
    ...shared,
    entryPoints: ['src/browser/index.ts'],
    outfile: 'dist/browser/index.js',
    format: 'esm',
    platform: 'browser',
    // Resolved at runtime, from the file built just below.
    external: ['./interactions.js'],
  });

  // browser: the lazy chunk, loaded after idle on key pages only.
  await build({
    ...shared,
    entryPoints: ['src/browser/interactions.ts'],
    outfile: 'dist/browser/interactions.js',
    format: 'esm',
    platform: 'browser',
  });

  // --- browser: CJS for older bundlers (no code splitting in CJS) -----------
  await build({
    ...shared,
    entryPoints: ['src/browser/index.ts'],
    outfile: 'dist/browser/index.cjs',
    format: 'cjs',
    platform: 'browser',
  });

  // --- browser: the script-tag build, exposing a global ---------------------
  await build({
    ...shared,
    entryPoints: ['src/browser/script-tag.ts'],
    outfile: 'dist/dripmetric.js',
    format: 'iife',
    platform: 'browser',
  });

  // --- server ---------------------------------------------------------------
  for (const [format, outfile] of [
    ['esm', 'dist/server/index.js'],
    ['cjs', 'dist/server/index.cjs'],
  ]) {
    await build({
      ...shared,
      entryPoints: ['src/server/index.ts'],
      outfile,
      format,
      platform: 'node',
      // Node built-ins stay external; the package has no other dependencies.
      external: ['node:crypto'],
    });
  }

  // --- types ----------------------------------------------------------------
  // tsc emits the declarations; esbuild does not produce them.
  execFileSync('npx', ['tsc', '-p', 'tsconfig.build.json'], { stdio: 'inherit' });
}

async function measure() {
  const files = await listDist();
  const core = files.find((f) => f.path === 'dist/browser/index.js');
  if (!core) throw new Error('dist/browser/index.js was not built.');

  const lazy = files.filter((f) => f.path === 'dist/browser/interactions.js');

  // The core is one file by construction now, but a static import creeping back in
  // would silently under-report it again, so the build refuses to measure a core
  // that imports anything at all.
  const coreSource = await readFile(core.path, 'utf8');
  const staticImport = /(?:^|\n)\s*import\s*[^(]/.exec(coreSource);
  if (staticImport) {
    console.error(
      'dist/browser/index.js has a static import, so its real download size is larger\n' +
        'than this report measures. Keep the core self-contained.',
    );
    process.exit(1);
  }

  const report = [
    '',
    'SIZE BUDGETS (brief section 6)',
    `  core (dripmetric/browser, ESM)   ${pad(core.raw)} raw   ${pad(core.gzip)} gzipped   budget ${pad(CORE_BUDGET_BYTES)}`,
  ];
  for (const chunk of lazy) {
    report.push(
      `  lazy chunk (forms, clicks, speed) ${pad(chunk.raw)} raw   ${pad(chunk.gzip)} gzipped   ${LAZY_REPORT_ONLY ? 'reported, not capped' : ''}`,
    );
  }
  const scriptTag = files.find((f) => f.path === 'dist/dripmetric.js');
  if (scriptTag) {
    report.push(
      `  script tag (global, everything)   ${pad(scriptTag.raw)} raw   ${pad(scriptTag.gzip)} gzipped`,
    );
  }
  const server = files.find((f) => f.path === 'dist/server/index.js');
  if (server) {
    report.push(
      `  server (dripmetric/server, ESM)  ${pad(server.raw)} raw   ${pad(server.gzip)} gzipped`,
    );
  }
  report.push('');
  console.log(report.join('\n'));

  if (core.gzip > CORE_BUDGET_BYTES) {
    console.error(
      `The core is ${core.gzip} bytes gzipped, over the ${CORE_BUDGET_BYTES}-byte budget by ${core.gzip - CORE_BUDGET_BYTES}.\n` +
        'Move what you added into src/browser/interactions.ts, which loads lazily on key pages.',
    );
    process.exit(1);
  }

  // Written OUTSIDE dist so it does not ship to consumers; M13's size-and-cost
  // report reads it from here.
  await writeFile(
    'size-report.json',
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        budgetBytes: CORE_BUDGET_BYTES,
        files: files.map((f) => ({ path: f.path, raw: f.raw, gzip: f.gzip })),
      },
      null,
      2,
    ),
  );
}

async function listDist() {
  const { readdir, stat } = await import('node:fs/promises');
  const out = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (/\.(js|cjs)$/.test(entry.name)) {
        const body = await readFile(path);
        out.push({ path, raw: (await stat(path)).size, gzip: gzipSync(body, { level: 9 }).length });
      }
    }
  };
  await walk('dist');
  return out;
}

const pad = (n) => `${String(n).padStart(6)} B`;

if (!sizeOnly) await run();
await measure();
