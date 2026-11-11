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
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
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

const inventory = JSON.parse(readFileSync(join(SITE, 'content/inventory.json'), 'utf8'));
const pages = inventory.pages.filter((p) => p.disposition === 'publish');
const htmlFor = (url) => {
  const path = new URL(url).pathname.replace(/^\/|\/$/g, '');
  return path === '' ? 'index.html' : `${path}.html`;
};

const required = [
  ...pages.map((p) => htmlFor(p.url)),
  ...pages.map((p) => p.md_path),
  '404.html',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'sitemap.md',
  'og.png',
  'favicon.ico',
  'site.webmanifest',
];
const missing = required.filter((file) => !existsSync(join(OUT, file)));
if (missing.length > 0) {
  console.error(`The static export is missing: ${missing.join(', ')}`);
  process.exit(1);
}

// Next writes `<page>.html` and, beside it, a `<page>/` folder of prefetch files. Hosts
// differ on which wins for `/page` — the `.html` file, or the folder (with a redirect to
// `/page/`) — so give the folder an index.html too and both answers serve the page.
for (const page of pages) {
  const html = htmlFor(page.url);
  if (html === 'index.html') continue;
  const folder = join(OUT, html.replace(/\.html$/, ''));
  if (
    existsSync(folder) &&
    statSync(folder).isDirectory() &&
    !existsSync(join(folder, 'index.html'))
  ) {
    writeFileSync(join(folder, 'index.html'), readFileSync(join(OUT, html)));
  }
}

// Static hosts cannot redirect, so each legacy v1 path (content/redirects.json) gets a
// stub page: an instant meta refresh, which search engines treat as a permanent redirect,
// plus a canonical link and a plain link for anyone whose browser ignores the refresh.
const { redirects } = JSON.parse(readFileSync(join(SITE, 'content/redirects.json'), 'utf8'));
const escape = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
for (const { source, destination } of redirects) {
  const file = join(OUT, `${source.replace(/^\//, '')}.html`);
  if (existsSync(file)) {
    console.error(`Redirect ${source} would overwrite a real page (${file}).`);
    process.exit(1);
  }
  const to = escape(destination);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>This page has moved</title>\n` +
      `<meta name="robots" content="noindex">\n<link rel="canonical" href="${to}">\n` +
      `<meta http-equiv="refresh" content="0; url=${to}">\n</head>\n<body>\n` +
      `<p>This page has moved to <a href="${to}">${to}</a>.</p>\n</body>\n</html>\n`,
  );
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
