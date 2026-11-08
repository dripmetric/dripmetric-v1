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
 *  - images have the dimensions their tags declare;
 *  - legacy redirects (content/redirects.json) never shadow a page and go to https;
 *  - the guide pages still say what the code does: every leak rule
 *    (packages/engine/src/leaks/types.ts), every intent rule and its points
 *    (packages/engine/src/intent/points.ts) and every catalog event
 *    (packages/catalog/src/events.ts) appears in content/pages.
 *
 * Rendered checks (on the prerendered HTML from `pnpm site:build`):
 *  - every page in content/inventory.json was built, with its language, title,
 *    description (70–160 characters), canonical and exactly one <h1>;
 *  - the canonical matches content/inventory.json;
 *  - JSON-LD parses, every offer price in it is visible on the page, and every FAQPage
 *    question is visible on the page;
 *  - every internal link and #anchor resolves; the 404 page is noindex.
 */
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const REPO = join(SITE, '../..');
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

const { redirects } = JSON.parse(await readFile(join(SITE, 'content/redirects.json'), 'utf8'));
for (const { source, destination } of redirects) {
  if (await resolves(source)) fail(`redirect ${source} shadows a real page or file`);
  if (!destination.startsWith('https://')) fail(`redirect ${source} must go to an https URL`);
}

// The guide pages restate rules that live in code. Compare them, so a changed threshold
// fails here instead of leaving a page that quotes the old number.
const normalise = (text) => text.replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
const contentPage = async (file) =>
  normalise(await readFile(join(SITE, 'content/pages', file), 'utf8'));
const codeFile = (file) => readFile(join(REPO, file), 'utf8');
const quotedValues = (source, key) =>
  [...source.matchAll(new RegExp(`\\b${key}: '([^']*)'`, 'g'))].map((m) => normalise(m[1]));

const leaksPage = await contentPage('leaks.md');
for (const rule of quotedValues(await codeFile('packages/engine/src/leaks/types.ts'), 'rule')) {
  if (!leaksPage.includes(rule)) fail(`content/pages/leaks.md no longer states the rule "${rule}"`);
}
const intentPage = await contentPage('buying-intent.md');
const points = await codeFile('packages/engine/src/intent/points.ts');
for (const m of points.matchAll(/\bpoints: (-?\d+),\s*rule: '([^']*)'/g)) {
  const value = Number(m[1]);
  const label = value < 0 ? `−${Math.abs(value)}` : `+${value}`;
  const rule = normalise(m[2]);
  if (!intentPage.includes(rule)) fail(`content/pages/buying-intent.md no longer states "${rule}"`);
  if (!intentPage.includes(label)) fail(`content/pages/buying-intent.md has no ${label} signal`);
}
const docsPage = await contentPage('docs.md');
const events = quotedValues(await codeFile('packages/catalog/src/events.ts'), 'name');
for (const name of events) {
  if (!docsPage.includes(`| ${name} |`))
    fail(`content/pages/docs.md is missing the event "${name}"`);
}
if (!docsPage.includes(`Dripmetric reads ${events.length} canonical events`)) {
  fail(`content/pages/docs.md must say the catalog has ${events.length} events`);
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

const fileFor = (url) => {
  const path = new URL(url).pathname.replace(/^\/|\/$/g, '');
  return path === '' ? 'index.html' : `${path}.html`;
};
const builtPages = [
  ...published.map((p) => ({ file: fileFor(p.url), id: p.id, path: new URL(p.url).pathname })),
  { file: '_not-found.html', id: null, path: null },
];
const fileByPath = new Map(builtPages.filter((p) => p.path).map((p) => [p.path, p.file]));
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
      if (description.length > 160) fail(`${where}: meta description over 160 characters`);
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
      const straight = normalise(visible);
      for (const node of data['@graph'] || [data]) {
        for (const offer of node.offers || []) {
          const price = `$${Number(offer.price).toLocaleString('en-US')}`;
          if (!visible.includes(price)) fail(`${where}: JSON-LD offer ${price} is not on the page`);
        }
        if (node['@type'] === 'FAQPage') {
          for (const question of node.mainEntity || []) {
            if (!straight.includes(normalise(question.name))) {
              fail(`${where}: FAQPage question "${question.name}" is not visible on the page`);
            }
          }
        }
      }
    }

    for (const m of doc.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      const ref = m[1].replace(/&amp;/g, '&');
      if (/^(https?:|mailto:|tel:|data:|\/_next\/)/.test(ref)) continue;
      const [path, hash] = ref.split('#');
      if (path && !(await resolves(path))) fail(`${where}: ${ref} resolves to nothing`);
      if (hash) {
        const target = !path ? doc : html[fileByPath.get(path.replace(/(.)\/$/, '$1')) ?? ''];
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
