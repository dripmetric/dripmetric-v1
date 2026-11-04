#!/usr/bin/env node
/**
 * Regenerates the site's raster images from their sources:
 *
 *   public/og.png               1200×630   from tools/og.html (uses the site's own CSS and fonts)
 *   public/icon-512.png         512×512    full-bleed mark (also the manifest's maskable icon)
 *   public/icon-192.png         192×192
 *   public/apple-touch-icon.png 180×180    full-bleed, because iOS paints transparency black
 *   public/favicon.ico          16 + 32    PNG-in-ICO, built here with no extra dependency
 *
 *   pnpm site:images
 *
 * Needs Playwright (a root devDependency) and the Chromium it manages.
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const PUBLIC = here('../public/');

/** The mark on a full square: ink field, paper bars, the leak in red. */
function squareMark(size) {
  return `<!doctype html><html><body style="margin:0;background:#1a1714">
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
    <rect width="32" height="32" fill="#1a1714"/>
    <g transform="translate(4.8 4.8) scale(0.7)">
      <rect x="5.5" y="6.5" width="21" height="4.2" rx="2.1" fill="#f6f3ec"/>
      <rect x="5.5" y="13.9" width="13.2" height="4.2" rx="2.1" fill="#f6f3ec"/>
      <rect x="5.5" y="21.3" width="7.2" height="4.2" rx="2.1" fill="#f6f3ec"/>
      <path d="M23.2 13.6c0 0-4.2 5-4.2 8.4a4.2 4.2 0 0 0 8.4 0c0-3.4-4.2-8.4-4.2-8.4z" fill="#e5483f"/>
    </g>
  </svg></body></html>`;
}

/** The rounded browser-tab mark, from public/favicon.svg, on a transparent page. */
async function tabMark(size) {
  const svg = (await readFile(PUBLIC + 'favicon.svg', 'utf8')).replace(
    '<svg ',
    `<svg width="${size}" height="${size}" `,
  );
  return `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`;
}

/** ICO container holding PNG images (supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto('file://' + here('./og.html'));
  // Runs in the page, so it is passed as a string rather than a Node-side function.
  await page.evaluate('document.fonts.ready');
  await page.screenshot({ path: PUBLIC + 'og.png' });

  for (const [name, size] of [
    ['icon-512.png', 512],
    ['icon-192.png', 192],
    ['apple-touch-icon.png', 180],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(squareMark(size));
    await page.screenshot({ path: PUBLIC + name });
  }

  const small = [];
  for (const size of [16, 32]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(await tabMark(size));
    small.push({ size, data: await page.screenshot({ omitBackground: true }) });
  }
  await writeFile(PUBLIC + 'favicon.ico', ico(small));

  console.log('Wrote og.png, icon-512.png, icon-192.png, apple-touch-icon.png, favicon.ico');
} finally {
  await browser.close();
}
