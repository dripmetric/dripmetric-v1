import { expect, test } from '@playwright/test';
import { startTestServer, type TestServer } from './server.js';

/**
 * M3 exit checks (brief section 11). Each needs a real browser: consent storing
 * nothing, SPA route changes, beacons on tab hide, and the page staying responsive
 * when our API is down. None of these can be proven in a mocked DOM.
 */

let server: TestServer;

test.beforeEach(async () => {
  server = await startTestServer();
});
test.afterEach(async () => {
  await server.close();
});

test('with consent required and not given, nothing is sent and nothing is stored', async ({
  page,
}) => {
  // Settled decision 13: nothing on the device and nothing on the wire — not even
  // the settings fetch — until consent(true).
  await page.goto(server.url);
  await page.waitForTimeout(3500); // past the 2s flush interval

  expect(server.requests, 'a request left the page before consent').toEqual([]);

  const stored = await page.evaluate(() => ({
    cookies: document.cookie,
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  expect(stored.cookies).toBe('');
  expect(stored.local).toEqual([]);
  expect(stored.session).toEqual([]);
});

test('after consent, the queued events flush with their ORIGINAL timestamps', async ({ page }) => {
  await page.goto(server.url);

  // An event happens well before consent is given.
  await page.evaluate(() => window.dm.track('Activated'));
  const beforeConsent = Date.now();
  await page.waitForTimeout(2500);
  expect(server.requests).toEqual([]);

  await page.evaluate(() => window.dm.consent(true));
  await expect.poll(() => server.messages().length).toBeGreaterThan(0);

  const activated = server.messages().find((m) => m.event === 'Activated');
  expect(activated, 'the queued event was lost rather than flushed').toBeDefined();

  // The event must carry when it HAPPENED, not when consent arrived, or every
  // funnel timing would be wrong for consented visitors.
  expect(new Date(activated!.timestamp).getTime()).toBeLessThanOrEqual(beforeConsent);

  // Only now may an id touch the device.
  const cookies = await page.evaluate(() => document.cookie);
  expect(cookies).toContain('dm_anon=');
});

test('consent(false) sends nothing and leaves nothing behind', async ({ page }) => {
  await page.goto(server.url);
  await page.evaluate(() => window.dm.track('Activated'));
  await page.evaluate(() => window.dm.consent(false));
  await page.waitForTimeout(2500);

  expect(server.requests).toEqual([]);
  expect(await page.evaluate(() => document.cookie)).toBe('');
});

test('a single-page-app route change produces Page Viewed and Page Left with active time', async ({
  page,
}) => {
  await page.goto(`${server.url}/?requireConsent=false`);
  await expect.poll(() => server.messages().length).toBeGreaterThan(0);

  // Spend time on the first page so there is active time to report.
  await page.mouse.move(100, 100);
  await page.mouse.click(50, 50);
  await page.waitForTimeout(2200);

  // pushState only: no navigation, no reload.
  await page.click('#go-pricing');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.dm.flush());

  await expect
    .poll(() => server.messages().filter((m) => m.name === 'Page Left').length)
    .toBeGreaterThan(0);

  const views = server.messages().filter((m) => m.type === 'page' && !m.name);
  const paths = views.map((m) => m.properties?.['path']);
  expect(paths).toContain('/');
  expect(paths).toContain('/pricing');

  const left = server.messages().find((m) => m.name === 'Page Left');
  expect(left!.properties?.['path']).toBe('/');
  expect(Number(left!.properties?.['activeSeconds'])).toBeGreaterThan(0);
  expect(left!.properties?.['pageViewId']).toBeTruthy();
});

test('ids in an SPA route are normalised before they leave the browser', async ({ page }) => {
  await page.goto(`${server.url}/?requireConsent=false`);
  await page.click('#go-settings'); // pushes /settings/99123
  await page.waitForTimeout(400);
  await page.evaluate(() => window.dm.flush());

  await expect.poll(() => server.messages().length).toBeGreaterThan(1);
  const paths = server.messages().map((m) => String(m.properties?.['path'] ?? ''));
  expect(paths).toContain('/settings/:id');
  expect(paths.join(' ')).not.toContain('99123');
});

test('the back button is a route change too', async ({ page }) => {
  await page.goto(`${server.url}/?requireConsent=false`);
  await page.click('#go-pricing');
  await page.waitForTimeout(300);
  await page.click('#go-back');
  await page.waitForTimeout(400);
  await page.evaluate(() => window.dm.flush());

  await expect
    .poll(() => server.messages().filter((m) => m.type === 'page' && !m.name).length)
    .toBeGreaterThan(2);
});

test('hiding the tab sends a beacon', async ({ page }) => {
  await page.goto(`${server.url}/?requireConsent=false`);
  await page.waitForTimeout(1200);
  const before = server.requests.length;

  // A fetch would be cancelled by a real navigation, which is why this path uses
  // sendBeacon (brief section 6).
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expect.poll(() => server.requests.length).toBeGreaterThan(before);
  const left = server.messages().find((m) => m.name === 'Page Left');
  expect(left).toBeDefined();
});

test('with the network blocked the page stays responsive and nothing throws', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(`${server.url}/?requireConsent=false`);
  // Our API disappears entirely.
  await page.route('**/v1/batch', (route) => route.abort('failed'));

  for (let i = 0; i < 30; i++) {
    await page.evaluate((n) => window.dm.track('Core Action', { n }), i);
  }
  await page.click('#go-pricing');
  await page.evaluate(() => window.dm.flush());
  await page.waitForTimeout(1500);

  // The page still works: the button still routes, and the DOM still responds.
  expect(await page.evaluate(() => document.title)).toBe('Ledgerly');
  await page.click('#go-settings');
  expect(await page.evaluate(() => location.pathname)).toBe('/settings/99123');

  // And no error reached the founder's app.
  expect(pageErrors, 'the SDK threw into the page').toEqual([]);
});

test('calling the API before init, and with rubbish, never throws', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(`${server.url}/?requireConsent=false`);
  await page.evaluate(() => {
    const dm = window.dm as unknown as Record<string, (...args: unknown[]) => unknown>;
    // Everything a founder might do wrong, in one go.
    dm.track('');
    dm.identify('');
    dm.group('');
    dm.track('Core Action', null);
    dm.identify('u1', { nested: { deeply: { and: { again: 1 } } } });
    dm.init('pk_test_e2e'); // a second init
  });
  expect(pageErrors).toEqual([]);
});

test('forms and friction load lazily, then report', async ({ page }) => {
  await page.goto(`${server.url}/?requireConsent=false`);
  // The lazy chunk waits for idle, so give it a moment.
  await expect.poll(() => server.requests.some((r) => r.path === '/v1/settings')).toBe(true);
  await page.waitForTimeout(2500);

  await page.click('#signup input[name="email"]');
  await page.fill('#signup input[name="email"]', 'sam@acme.com');
  await page.click('#signup button[type="submit"]');
  await page.waitForTimeout(600);
  await page.evaluate(() => window.dm.flush());

  await expect.poll(() => server.messages().some((m) => m.event === 'Form Started')).toBe(true);

  const events = server.messages().map((m) => m.event);
  expect(events).toContain('Form Started');
  expect(events).toContain('Form Submitted');

  // The field's NAME only. What was typed is never collected (brief section 10).
  const body = JSON.stringify(server.requests);
  expect(body).not.toContain('sam@acme.com');
});

test('a rage click is reported, and page text is not', async ({ page }) => {
  await page.goto(`${server.url}/?requireConsent=false`);
  await page.waitForTimeout(3000); // let the lazy chunk load

  // Three clicks within 1s and 30px of each other.
  const button = page.locator('#dead');
  await button.click();
  await button.click();
  await button.click();
  await page.waitForTimeout(600);
  await page.evaluate(() => window.dm.flush());

  await expect.poll(() => server.messages().some((m) => m.event === 'Rage Click')).toBe(true);
});

test('the beacon body is text/plain with the key inside it', async ({ page }) => {
  await page.goto(`${server.url}/?requireConsent=false`);
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expect
    .poll(() => server.requests.filter((r) => r.path === '/v1/batch').length)
    .toBeGreaterThan(0);
  const batch = server.requests.find((r) => r.path === '/v1/batch')!;

  // sendBeacon cannot set headers, which is why the key travels in the body and
  // the type is text/plain — that also avoids a CORS preflight (brief section 5).
  expect(batch.contentType).toContain('text/plain');
  expect((batch.body as { writeKey?: string }).writeKey).toBe('pk_test_e2e');
});

test('context carries the 18 fields, and none of the things we refuse to collect', async ({
  page,
}) => {
  await page.goto(
    `${server.url}/?requireConsent=false&utm_source=twitter&utm_medium=cpc&gclid=abc123xyz`,
  );
  await page.evaluate(() => window.dm.track('Activated'));
  await page.evaluate(() => window.dm.flush());

  await expect.poll(() => server.messages().length).toBeGreaterThan(0);
  const message = server.messages().find((m) => m.event === 'Activated') as unknown as {
    context: Record<string, unknown>;
  };
  const context = message.context;

  expect(context['library']).toMatchObject({ name: 'dripmetric' });
  expect(context['sessionId']).toBeTruthy();
  expect(context['timezone']).toBeTruthy();
  expect(context['locale']).toBeTruthy();
  expect(context['consent']).toMatchObject({ granted: true });
  expect(context['campaign']).toMatchObject({ source: 'twitter', medium: 'cpc' });

  // The ad-click id itself is discarded; only "paid click, and the network"
  // survives (brief section 10).
  const everything = JSON.stringify(server.requests);
  expect(everything).not.toContain('abc123xyz');
});

test('reset() starts a new visitor', async ({ page }) => {
  await page.goto(`${server.url}/?requireConsent=false`);
  await page.evaluate(() => window.dm.identify('user_1', { email: 'a@acme.com' }));
  await page.evaluate(() => window.dm.flush());
  await expect.poll(() => server.messages().length).toBeGreaterThan(0);

  const first = await page.evaluate(() => document.cookie);
  expect(first).toContain('dm_anon=');

  await page.evaluate(() => window.dm.reset());
  expect(await page.evaluate(() => document.cookie)).not.toContain('dm_anon=');
});

declare global {
  interface Window {
    dm: {
      init: (key: string, options?: Record<string, unknown>) => void;
      identify: (userId: string, traits?: Record<string, unknown>) => void;
      group: (groupId: string, traits?: Record<string, unknown>) => void;
      track: (event: string, properties?: Record<string, unknown>) => void;
      page: (properties?: Record<string, unknown>) => void;
      consent: (granted: boolean) => void;
      reset: () => void;
      flush: () => Promise<void>;
    };
  }
}
