#!/usr/bin/env node
/**
 * Checks for the landing page — no dependencies, no network.
 *
 *   pnpm site:check                    # source checks; rendered checks too if built
 *   pnpm site:check --require-build    # CI: fail if there is no build to check
 *
 * Source checks (always):
 *  - the Markdown copies are in sync with content/ (see build-markdown.mjs);
 *  - sitemap.xml lists exactly the published pages in content/inventory.json;
 *  - robots.txt points at the sitemap and does not block the site;
 *  - every link in llms.txt resolves to a page or a public file;
 *  - images have the dimensions their tags declare.
 *
 * Rendered checks (on the prerendered HTML from `pnpm site:build`):
 *  - each page has its language, title, description, canonical and exactly one <h1>;
 *  - the canonical matches content/inventory.json;
 *  - JSON-LD parses and every offer price in it is visible on the page;
 *  - every internal link and #anchor resolves; the 404 page is noindex.
 */
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const PUBLIC = join(SITE, 'public');
const BUILT = join(SITE, '.next/server/app');
const requireBuild = process.argv.includes('--require-build');
const failures = [];
const notes = [];
const fail = (message) => failures.push(message);

const exists = async (path) => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

const inventory = JSON.parse(await readFile(join(SITE, 'content/inventory.json'), 'utf8'));
const ORIGIN = inventory.origin.replace(/\/$/, '');
const published = inventory.pages.filter((p) => p.disposition === 'publish');
const routes = new Set(published.map((p) => new URL(p.url).pathname));

/** A site path is real if it is a page route or a file in public/. */
async function resolves(path) {
  const clean = decodeURIComponent(path.split('#')[0].split('?')[0]) || '/';
  if (routes.has(clean) || routes.has(clean.replace(/\/$/, ''))) return true;
  return exists(join(PUBLIC, clean.replace(/^\//, '')));
}

// ---------- Source checks ----------
try {
  execFileSync(process.execPath, [join(SITE, 'tools/build-markdown.mjs'), '--check'], {
    stdio: 'pipe',
  });
} catch (error) {
  fail('Markdown copies are out of date — run: pnpm site:markdown\n' + String(error.stderr || ''));
}

const sitemap = await readFile(join(PUBLIC, 'sitemap.xml'), 'utf8');
if (!sitemap.startsWith('<?xml')) fail('sitemap.xml: the XML declaration must come first');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const urls = published.map((p) => p.url);
for (const url of urls) if (!locs.includes(url)) fail(`sitemap.xml is missing ${url}`);
for (const loc of locs)
  if (!urls.includes(loc)) fail(`sitemap.xml lists ${loc}, not a published page`);

const robots = await readFile(join(PUBLIC, 'robots.txt'), 'utf8');
if (!robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`))
  fail('robots.txt must point at the sitemap');
if (/^\s*Disallow:\s*\/\s*$/m.test(robots)) fail('robots.txt disallows the whole site');

const llms = await readFile(join(PUBLIC, 'llms.txt'), 'utf8');
for (const m of llms.matchAll(/\]\((https:\/\/[^)\s]+)\)/g)) {
  const url = new URL(m[1]);
  if (url.origin === ORIGIN && !(await resolves(url.pathname))) {
    fail(`llms.txt links to ${m[1]}, which resolves to nothing`);
  }
}

const png = async (file) => {
  const buffer = await readFile(join(PUBLIC, file));
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
};
for (const [file, w, h] of [
  ['og.png', 1200, 630],
  ['icon-512.png', 512, 512],
  ['icon-192.png', 192, 192],
  ['apple-touch-icon.png', 180, 180],
]) {
  if (!(await exists(join(PUBLIC, file)))) {
    fail(`public/${file} is missing — run: pnpm site:images`);
    continue;
  }
  const [width, height] = await png(file);
  if (width !== w || height !== h) fail(`public/${file} is ${width}×${height}, expected ${w}×${h}`);
}
const manifest = JSON.parse(await readFile(join(PUBLIC, 'site.webmanifest'), 'utf8'));
for (const icon of manifest.icons) {
  if (!(await exists(join(PUBLIC, icon.src)))) fail(`site.webmanifest icon ${icon.src} is missing`);
}

// ---------- Rendered checks (prerendered HTML) ----------
const textOf = (html) =>
  html
    // React separates adjacent text with <!-- --> in server HTML; browsers render nothing.
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ');
const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

const builtPages = [
  { file: 'index.html', id: 'home' },
  { file: 'privacy.html', id: 'privacy' },
  { file: '_not-found.html', id: null },
];
const html = {};
for (const page of builtPages) {
  const path = join(BUILT, page.file);
  if (await exists(path)) html[page.file] = await readFile(path, 'utf8');
}

if (Object.keys(html).length === 0) {
  if (requireBuild) fail('no prerendered pages in .next — run: pnpm site:build');
  else notes.push('rendered checks skipped — run `pnpm site:build` first to include them');
} else {
  for (const page of builtPages) {
    const doc = html[page.file];
    const where = `rendered ${page.file}`;
    if (!doc) {
      fail(`${where}: missing from the build`);
      continue;
    }
    if (!/<html lang="en"/.test(doc)) fail(`${where}: <html> needs lang="en"`);
    if (!/<meta name="viewport"/.test(doc)) fail(`${where}: missing viewport meta`);
    if (!/<title>[^<]{10,}<\/title>/.test(doc)) fail(`${where}: missing or short <title>`);
    const h1 = (doc.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) fail(`${where}: expected one <h1>, found ${h1}`);

    if (page.id) {
      const expected = published.find((p) => p.id === page.id)?.url;
      const canonical = doc.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      const same = canonical && expected && new URL(canonical).href === new URL(expected).href;
      if (!same) fail(`${where}: canonical ${canonical} ≠ inventory ${expected}`);
      const description = doc.match(/<meta name="description" content="([^"]+)"/)?.[1] ?? '';
      if (description.length < 70) fail(`${where}: meta description missing or thin`);
      if (!/<meta property="og:image" content="https:\/\/dripmetric\.com\/og\.png"/.test(doc)) {
        fail(`${where}: og:image must be the absolute og.png URL`);
      }
    } else if (!/<meta name="robots" content="noindex"/.test(doc)) {
      fail(`${where}: the not-found page must be noindex`);
    }

    for (const block of doc.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    )) {
      let data;
      try {
        data = JSON.parse(block[1]);
      } catch (error) {
        fail(`${where}: JSON-LD does not parse (${error.message})`);
        continue;
      }
      const visible = textOf(doc);
      for (const node of data['@graph'] || [data]) {
        for (const offer of node.offers || []) {
          const price = `$${Number(offer.price).toLocaleString('en-US')}`;
          if (!visible.includes(price)) fail(`${where}: JSON-LD offer ${price} is not on the page`);
        }
      }
    }

    for (const m of doc.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      const ref = m[1].replace(/&amp;/g, '&');
      if (/^(https?:|mailto:|tel:|data:|\/_next\/)/.test(ref)) continue;
      const [path, hash] = ref.split('#');
      if (path && !(await resolves(path))) fail(`${where}: ${ref} resolves to nothing`);
      if (hash) {
        const target = !path ? doc : path === '/' ? html['index.html'] : html['privacy.html'];
        if (target && !ids(target).has(hash)) fail(`${where}: ${ref} has no #${hash} target`);
      }
    }
  }
}

// ---------- Report ----------
if (!/^https:\/\//.test(process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT ?? '')) {
  notes.push('NEXT_PUBLIC_WAITLIST_ENDPOINT is not set here: sign-ups fall back to email');
}
for (const note of notes) console.log('note  ' + note);
if (failures.length) {
  for (const message of failures) console.error('FAIL  ' + message);
  console.error(`\n${failures.length} problem(s).`);
  process.exit(1);
}
console.log(
  `PASS  site checks (${Object.keys(html).length ? 'source + rendered' : 'source only'})`,
);
