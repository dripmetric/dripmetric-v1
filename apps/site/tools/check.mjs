#!/usr/bin/env node
/**
 * Checks for the landing page — no dependencies, no network.
 *
 *   pnpm site:check                    # source checks; rendered checks too if built
 *   pnpm site:check --require-build    # CI: fail if there is no build to check
 *
 * Source checks (always):
 *  - the Markdown copies and sitemap.xml are in sync with content/ (see build-markdown.mjs),
 *    so every lastmod is its page's updated_at;
 *  - sitemap.xml lists exactly the published pages in content/inventory.json;
 *  - robots.txt points at the sitemap and does not block the site;
 *  - every link in llms.txt resolves to a page or a public file;
 *  - images have the dimensions their tags declare;
 *  - legacy redirects (content/redirects.json) never shadow a page and go to https;
 *  - /leaks still names every leak the engine has (packages/engine/src/leaks/types.ts),
 *    each with its own #anchor;
 *  - the exact rules stay off the public site (founder's call, docs/decisions.md
 *    2026-11-21): no leak rule or intent rule sentence from the engine appears in
 *    content/, src/content or src/components;
 *  - every event name the setup guide and the home page use is a real catalog event
 *    (packages/catalog/src/events.ts);
 *  - no install command or package path: the SDK is not on a public registry before launch
 *    (founder's call, docs/decisions.md 2026-11-25);
 *  - each hub (/guides, /compare) links every page under its path.
 *
 * Rendered checks (on the prerendered HTML from `pnpm site:build`):
 *  - every page in content/inventory.json was built, with its language, title,
 *    description (70–160 characters), canonical and exactly one <h1>;
 *  - the canonical matches content/inventory.json;
 *  - JSON-LD parses, every offer price in it is visible on the page, every FAQPage
 *    question is visible on the page, every hub's ItemList entry is linked on the page,
 *    and no node is a Person (the site names the product, never its maker);
 *  - every internal link and #anchor resolves; the 404 page is noindex;
 *  - the home page stays inside its length budget (HOME_BUDGET below).
 */
import { readFile, readdir, stat } from 'node:fs/promises';
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

// The public pages are general on purpose; the exact rules are for invited founders.
// These checks keep the pages complete (every leak named), private (no rule text) and
// correct (every event name the install guide uses exists).
const normalise = (text) => text.replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
const contentPage = async (file) =>
  normalise(await readFile(join(SITE, 'content/pages', file), 'utf8'));
const codeFile = (file) => readFile(join(REPO, file), 'utf8');
const quotedValues = (source, key) =>
  [...source.matchAll(new RegExp(`\\b${key}: '([^']*)'`, 'g'))].map((m) => normalise(m[1]));

const leakSource = await codeFile('packages/engine/src/leaks/types.ts');
const leaksPage = await contentPage('leaks.md');
// Anchors that predate the engine's ids. Other pages and outside links use them, so the
// page keeps the old anchor and this maps the engine id to it.
const LEAK_ANCHORS = { 'limit-reached-no-upgrade': 'limit-reached' };
for (const type of quotedValues(leakSource, 'type')) {
  const anchor = LEAK_ANCHORS[type] ?? type;
  if (!leaksPage.includes(`{#${anchor}}`)) {
    fail(`content/pages/leaks.md does not name the leak "${type}" (#${anchor})`);
  }
}

/** Every file a visitor can read, as text: the content and the components that render it. */
async function publicFiles() {
  const roots = [join(SITE, 'content'), join(SITE, 'src/content'), join(SITE, 'src/components')];
  const files = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(md|ts|tsx|json)$/.test(entry.name)) files.push(path);
    }
  };
  for (const root of roots) await walk(root);
  return files;
}
const privateRules = [
  ...quotedValues(leakSource, 'rule'),
  ...[
    ...(await codeFile('packages/engine/src/intent/points.ts')).matchAll(/\brule: '([^']*)'/g),
  ].map((m) => normalise(m[1])),
].filter((rule) => rule.split(' ').length >= 6);
for (const file of await publicFiles()) {
  const text = normalise(await readFile(file, 'utf8'));
  for (const rule of privateRules) {
    if (text.includes(rule)) {
      fail(
        `${file.slice(SITE.length)} states an exact rule, which is for invited founders: "${rule}"`,
      );
    }
  }
}

const events = new Set(quotedValues(await codeFile('packages/catalog/src/events.ts'), 'name'));
const docsPage = await contentPage('docs.md');
const homeSetup = await readFile(join(SITE, 'src/components/home/how-it-works.tsx'), 'utf8');
const usedEvents = new Set([
  // `Signed Up` in prose, and 'Signed Up' or "Signed Up" in code samples.
  ...[...docsPage.matchAll(/[`'"]((?:[A-Z][a-z]+ )+[A-Z][a-z]+)[`'"]/g)].map((m) => m[1]),
  ...[...homeSetup.matchAll(/'((?:[A-Z][a-z]+ )+[A-Z][a-z]+)'/g)].map((m) => m[1]),
]);
// The install guide's example of a founder's OWN event name, which is mapped, not matched.
const OWN_NAME_EXAMPLES = new Set(['Invoice Sent']);
for (const name of usedEvents) {
  if (!events.has(name) && !OWN_NAME_EXAMPLES.has(name)) {
    fail(`"${name}" is used as an event name but is not in the catalog`);
  }
}
if (usedEvents.size === 0) fail('found no event names in the setup guide to check');

// Before launch the SDK is not on a public registry, so no page may tell anyone to install
// it from one (docs/decisions.md, 2026-11-25). Lift this when the package is published.
const REGISTRY_REFERENCES = [
  /\bnpm\b/i,
  /\b(?:pnpm|yarn) add\b/,
  /['"`]dripmetric\/(?:browser|server)['"`]/,
];
for (const file of await publicFiles()) {
  const text = await readFile(file, 'utf8');
  for (const pattern of REGISTRY_REFERENCES) {
    if (pattern.test(text))
      fail(`${file.slice(SITE.length)} refers to a package registry (${pattern})`);
  }
}

// A hub lists every page under its path; it may list others too.
for (const hub of published.filter((p) => ['guides', 'compare'].includes(p.id))) {
  const body = await readFile(join(SITE, 'content', hub.body_ref), 'utf8');
  for (const page of published) {
    if (page.url.startsWith(`${hub.url}/`) && !body.includes(`](${page.url})`)) {
      fail(`content/${hub.body_ref} does not link ${page.url}`);
    }
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
/**
 * The home page has one job: the waitlist. In November 2026 it had grown to 14 sections
 * and about 2,600 visible words (16 screens on a laptop, 26 on a phone), against a median
 * of 10 screens and 960 words across 25 comparable products' pages (docs/decisions.md).
 * This budget is what stops it growing back one reasonable addition at a time: depth
 * belongs on the guide pages, each of which owns its topic. Words are counted in the
 * HTML, so collapsed FAQ answers and code count too.
 */
const HOME_BUDGET = { sections: 8, words: 1400 };
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

    if (page.id === 'home') {
      const main = doc.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';
      const sections = (main.match(/<section[\s>]/g) || []).length;
      const words = textOf(main).trim().split(' ').length;
      if (sections > HOME_BUDGET.sections) {
        fail(`${where}: ${sections} sections, over the budget of ${HOME_BUDGET.sections}`);
      }
      if (words > HOME_BUDGET.words) {
        fail(`${where}: ${words} words, over the budget of ${HOME_BUDGET.words}`);
      }
      notes.push(
        `home page: ${sections} sections, ${words} words (budget ${HOME_BUDGET.sections} and ${HOME_BUDGET.words})`,
      );
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
        if (node['@type'] === 'Person') fail(`${where}: JSON-LD names a Person`);
        for (const item of node.mainEntity?.itemListElement || []) {
          const path = new URL(item.url).pathname;
          if (!doc.includes(`href="${path}"`))
            fail(`${where}: ItemList entry ${path} is not linked`);
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
// The server build posts to the site's own /api/waitlist; only the static export needs an
// outside endpoint (src/content/site.ts), and that is checked where it is built.
for (const note of notes) console.log('note  ' + note);
if (failures.length) {
  for (const message of failures) console.error('FAIL  ' + message);
  console.error(`\n${failures.length} problem(s).`);
  process.exit(1);
}
console.log(
  `PASS  site checks (${Object.keys(html).length ? 'source + rendered' : 'source only'})`,
);
