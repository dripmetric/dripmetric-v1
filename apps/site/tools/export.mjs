#!/usr/bin/env node
/**
 * Static export of the landing page, for GitHub Pages or any static host.
 *
 *   pnpm site:export                                  # → apps/site/out, for dripmetric.com
 *   SITE_BASE_PATH=/dripmetric-v1 pnpm site:export    # for https://<user>.github.io/dripmetric-v1/
 *
 * Runs `next build` with SITE_STATIC_EXPORT=1 (see next.config.ts), then checks that every
 * file the site depends on is in the output. Works the same on macOS, Linux and Windows.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(SITE, 'out');
const nextBin = createRequire(join(SITE, 'package.json')).resolve('next/dist/bin/next');
const base = (process.env.SITE_BASE_PATH ?? '').replace(/\/+$/, '');

const build = spawnSync(process.execPath, [nextBin, 'build'], {
  cwd: SITE,
  env: { ...process.env, SITE_STATIC_EXPORT: '1', NEXT_TELEMETRY_DISABLED: '1' },
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);

const required = [
  'index.html',
  'privacy.html',
  '404.html',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'sitemap.md',
  'index.md',
  'privacy.md',
  'og.png',
  'favicon.ico',
  'site.webmanifest',
];
const missing = required.filter((file) => !existsSync(join(OUT, file)));
if (missing.length > 0) {
  console.error(`The static export is missing: ${missing.join(', ')}`);
  process.exit(1);
}

// Branch-based GitHub Pages publishing runs Jekyll, which would drop the `_next` folder.
// The Actions-based deploy in .github/workflows/site-pages.yml does not, but the marker
// costs nothing and keeps the folder deployable either way.
writeFileSync(join(OUT, '.nojekyll'), '');

let files = 0;
let bytes = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) walk(path);
    else {
      files += 1;
      bytes += info.size;
    }
  }
};
walk(OUT);
console.log(
  `\nStatic site ready in apps/site/out — ${files} files, ${(bytes / 1024).toFixed(0)} KB` +
    (base ? `, base path ${base}` : ', served from the domain root') +
    '.',
);
