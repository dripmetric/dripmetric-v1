#!/usr/bin/env node
/**
 * Tell IndexNow-enabled search engines (Bing — which also grounds Microsoft Copilot —
 * Yandex, Naver, Seznam, Yep and others) that pages changed. One submission is shared
 * with every participating engine. Google does not take part; use Search Console there.
 *
 *   pnpm site:indexnow                     # dry run: shows what would be sent, sends nothing
 *   pnpm site:indexnow --submit            # submit every published page (after a deploy)
 *   pnpm site:indexnow --submit /leaks /docs   # submit only these paths
 *
 * This is a provider operation: run it yourself after the site is live, not from CI on
 * every build. Before submitting it checks that the key file is served by the live site,
 * because a key the engines cannot fetch makes every submission fail (403).
 *
 * The key is public by design — the protocol requires it at https://<host>/<key>.txt —
 * and proves only that whoever submits URLs controls the site. Docs:
 * https://www.indexnow.org/documentation
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const args = process.argv.slice(2);
const submit = args.includes('--submit');
const onlyPaths = args.filter((arg) => arg.startsWith('/'));

const inventory = JSON.parse(await readFile(join(SITE, 'content/inventory.json'), 'utf8'));
const origin = inventory.origin.replace(/\/$/, '');
const host = new URL(origin).host;

const keyFiles = (await readdir(join(SITE, 'public'))).filter((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (keyFiles.length !== 1) {
  console.error(`Expected exactly one IndexNow key file in public/, found ${keyFiles.length}.`);
  process.exit(1);
}
const key = (await readFile(join(SITE, 'public', keyFiles[0]), 'utf8')).trim();
const keyLocation = `${origin}/${keyFiles[0]}`;

const published = inventory.pages.filter((p) => p.disposition === 'publish').map((p) => p.url);
const urlList = onlyPaths.length
  ? onlyPaths.map((path) => new URL(path, `${origin}/`).href)
  : published;
const unknown = urlList.filter((url) => !published.includes(url));
if (unknown.length) {
  console.error(`Not published pages (check content/inventory.json): ${unknown.join(', ')}`);
  process.exit(1);
}

const payload = { host, key, keyLocation, urlList };
console.log(`IndexNow ${submit ? 'submission' : 'dry run'} for ${host}: ${urlList.length} URL(s)`);
for (const url of urlList) console.log(`  ${url}`);

if (!submit) {
  console.log(`\nWould POST to ${ENDPOINT}:\n${JSON.stringify(payload, null, 2)}`);
  console.log('\nNothing was sent. After deploying, run again with --submit.');
  process.exit(0);
}

// The engines fetch the key file to verify ownership; make sure it is live first.
try {
  const response = await fetch(keyLocation, { redirect: 'manual' });
  const body = response.ok ? (await response.text()).trim() : '';
  if (!response.ok || body !== key) {
    console.error(
      `${keyLocation} returned ${response.status}${response.ok ? ' with different content' : ''}. ` +
        'Deploy the site (and make the apex host the primary domain) before submitting.',
    );
    process.exit(1);
  }
} catch (error) {
  console.error(`Could not fetch ${keyLocation}: ${error.message}`);
  process.exit(1);
}

const MEANING = {
  200: 'OK — URLs submitted.',
  202: 'Accepted — URLs received; key validation pending.',
  400: 'Bad request — invalid format.',
  403: 'Forbidden — key not valid (not found, or not in the file).',
  422: 'Unprocessable — a URL does not belong to the host, or the key does not match the protocol.',
  429: 'Too many requests — slow down; do not resubmit unchanged URLs.',
};
const response = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});
console.log(`\n${response.status}: ${MEANING[response.status] ?? 'Unexpected response.'}`);
console.log(
  'A successful submission means the engines received the URLs — not that they crawled, indexed or will show them.',
);
process.exit(response.status === 200 || response.status === 202 ? 0 : 1);
