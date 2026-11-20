import { describe, expect, it, vi } from 'vitest';
import {
  MAX_BODY_BYTES,
  RATE_LIMIT,
  createRateLimiter,
  handleWaitlistPost,
  type WaitlistDeps,
} from '../waitlist-handler';

const OPEN = { WAITLIST_INTAKE: 'open', SITE_DATABASE_URL: 'postgres://test' };
const AUTOMATION = {
  WAITLIST_AUTOMATION: 'on',
  WAITLIST_AUTOMATION_URL: 'https://hooks.example.com/w',
  WAITLIST_AUTOMATION_SECRET: 'x'.repeat(40),
};
const NOW = new Date('2026-11-20T10:00:00Z');

function deps(overrides: Partial<WaitlistDeps> = {}) {
  const tasks: (() => Promise<void>)[] = [];
  const logs: Record<string, unknown>[] = [];
  const made: WaitlistDeps = {
    env: OPEN,
    now: () => NOW,
    join: vi.fn(async () => ({ id: 41 })),
    markForwarded: vi.fn(async () => true),
    forward: vi.fn(async () => true),
    later: (task) => void tasks.push(task),
    limiter: createRateLimiter(),
    contactEmail: 'hello@dripmetric.com',
    homeUrl: 'https://dripmetric.com/',
    log: (line) => void logs.push(line),
    ...overrides,
  };
  return { made, tasks, logs };
}

function post(
  body: string,
  {
    json = true,
    type = 'application/x-www-form-urlencoded',
    origin = 'https://dripmetric.com',
    ip = '203.0.113.7',
  }: { json?: boolean; type?: string; origin?: string | null; ip?: string } = {},
): Request {
  const headers: Record<string, string> = {
    'content-type': type,
    host: 'dripmetric.com',
    'x-forwarded-for': `${ip}, 10.0.0.1`,
  };
  if (json) headers['accept'] = 'application/json';
  if (origin !== null) headers['origin'] = origin;
  return new Request('https://dripmetric.com/api/waitlist', { method: 'POST', headers, body });
}

const form = (email: string, extra = '') =>
  `email=${encodeURIComponent(email)}&source=hero${extra}`;

describe('POST /api/waitlist', () => {
  it('is closed unless WAITLIST_INTAKE=open, and stores nothing', async () => {
    const { made } = deps({ env: { SITE_DATABASE_URL: 'postgres://test' } });
    const response = await handleWaitlistPost(post(form('ada@example.com')), made);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: 'waitlist_closed' });
    expect(made.join).not.toHaveBeenCalled();
  });

  it('stores a real address and says so', async () => {
    const { made, logs } = deps();
    const response = await handleWaitlistPost(post(form(' ada@example.com ')), made);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(made.join).toHaveBeenCalledWith({ email: 'ada@example.com', source: 'hero' }, OPEN);
    // The address never reaches a log line.
    expect(JSON.stringify(logs)).not.toContain('ada@example.com');
  });

  it('answers an address already on the list exactly like a new one', async () => {
    const fresh = deps();
    const known = deps({ join: vi.fn(async () => ({ id: null })) });
    const a = await handleWaitlistPost(post(form('ada@example.com')), fresh.made);
    const b = await handleWaitlistPost(post(form('ada@example.com')), known.made);
    expect([b.status, await b.text()]).toEqual([a.status, await a.text()]);
  });

  it.each([
    ['not-an-email', 'email_invalid'],
    ['someone@mailinator.com', 'email_disposable'],
  ])('refuses %j as %s', async (email, error) => {
    const { made } = deps();
    const response = await handleWaitlistPost(post(form(email)), made);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ ok: false, error });
    expect(made.join).not.toHaveBeenCalled();
  });

  it('refuses a post from another site, and allows one with no Origin at all', async () => {
    const { made } = deps();
    const foreign = await handleWaitlistPost(
      post(form('a@example.com'), { origin: 'https://evil.example' }),
      made,
    );
    expect(foreign.status).toBe(403);
    const plain = await handleWaitlistPost(post(form('a@example.com'), { origin: null }), made);
    expect(plain.status).toBe(200);
  });

  it('takes JSON as well as a form body, and refuses anything else', async () => {
    const { made } = deps();
    const asJson = await handleWaitlistPost(
      post(JSON.stringify({ email: 'ada@example.com', source: 'final' }), {
        type: 'application/json',
      }),
      made,
    );
    expect(asJson.status).toBe(200);
    expect(made.join).toHaveBeenCalledWith({ email: 'ada@example.com', source: 'final' }, OPEN);
    for (const [body, type] of [
      ['email=a@example.com', 'text/plain'],
      ['[1,2]', 'application/json'],
      ['{oops', 'application/json'],
      [
        form('a@example.com', `&pad=${'x'.repeat(MAX_BODY_BYTES)}`),
        'application/x-www-form-urlencoded',
      ],
    ] as const) {
      const response = await handleWaitlistPost(post(body, { type }), made);
      expect(response.status, `${type} ${body.slice(0, 20)}`).toBe(400);
    }
  });

  it('pretends to succeed for the honeypot, and stores nothing', async () => {
    const { made } = deps();
    const response = await handleWaitlistPost(post(form('bot@example.com', '&_gotcha=yes')), made);
    expect(response.status).toBe(200);
    expect(made.join).not.toHaveBeenCalled();
  });

  it(`allows ${RATE_LIMIT.max} tries per address, then asks for a pause`, async () => {
    const { made } = deps();
    for (let i = 0; i < RATE_LIMIT.max; i++) {
      expect((await handleWaitlistPost(post(form(`p${i}@example.com`)), made)).status).toBe(200);
    }
    const limited = await handleWaitlistPost(post(form('p9@example.com')), made);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    // Someone else is unaffected.
    const other = await handleWaitlistPost(
      post(form('q@example.com'), { ip: '198.51.100.2' }),
      made,
    );
    expect(other.status).toBe(200);
  });

  it('says "try again" when the database is down, and logs why', async () => {
    const { made, logs } = deps({
      join: vi.fn(async () => Promise.reject(new Error('ECONNREFUSED'))),
    });
    const response = await handleWaitlistPost(post(form('ada@example.com')), made);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: 'waitlist_unavailable' });
    expect(logs).toContainEqual(
      expect.objectContaining({ level: 'error', msg: 'waitlist store failed' }),
    );
  });

  it('sends nothing to any automation while it is off', async () => {
    const { made, tasks } = deps();
    await handleWaitlistPost(post(form('ada@example.com')), made);
    expect(tasks).toHaveLength(0);
    expect(made.forward).not.toHaveBeenCalled();
  });

  it('hands a NEW address to the automation after responding, and records it', async () => {
    const { made, tasks } = deps({ env: { ...OPEN, ...AUTOMATION } });
    await handleWaitlistPost(post(form('ada@example.com')), made);
    expect(made.forward).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(1);
    await tasks[0]!();
    expect(made.forward).toHaveBeenCalledWith(
      { id: 41, email: 'ada@example.com', source: 'hero', joinedAt: NOW },
      { url: AUTOMATION.WAITLIST_AUTOMATION_URL, secret: AUTOMATION.WAITLIST_AUTOMATION_SECRET },
      { now: NOW },
    );
    expect(made.markForwarded).toHaveBeenCalledWith(41, { ...OPEN, ...AUTOMATION });

    // Already on the list: no second welcome mail.
    const repeat = deps({
      env: { ...OPEN, ...AUTOMATION },
      join: vi.fn(async () => ({ id: null })),
    });
    await handleWaitlistPost(post(form('ada@example.com')), repeat.made);
    expect(repeat.tasks).toHaveLength(0);
  });

  it('leaves a failed hand-off unrecorded, so the backlog command sends it later', async () => {
    const { made, tasks, logs } = deps({
      env: { ...OPEN, ...AUTOMATION },
      forward: vi.fn(async () => false),
    });
    await handleWaitlistPost(post(form('ada@example.com')), made);
    await tasks[0]!();
    expect(made.markForwarded).not.toHaveBeenCalled();
    expect(logs).toContainEqual(expect.objectContaining({ level: 'warn', id: 41 }));
  });

  it('keeps an incomplete automation off and says so in the log', async () => {
    const { made, tasks, logs } = deps({
      env: {
        ...OPEN,
        WAITLIST_AUTOMATION: 'on',
        WAITLIST_AUTOMATION_URL: 'https://hooks.example.com/w',
      },
    });
    await handleWaitlistPost(post(form('ada@example.com')), made);
    expect(tasks).toHaveLength(0);
    expect(logs).toContainEqual(
      expect.objectContaining({ level: 'warn', msg: 'waitlist automation is on but incomplete' }),
    );
  });

  it('answers a browser without JavaScript with a small, unindexed page', async () => {
    const { made } = deps({ env: {} });
    const response = await handleWaitlistPost(post(form('ada@example.com'), { json: false }), made);
    const page = await response.text();
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(page).toContain('<h1>The waitlist isn’t open yet.</h1>');
    expect(page).toContain('href="https://dripmetric.com/"');
  });
});

describe('the in-memory rate limit', () => {
  it('opens again when the window passes', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1_000 });
    expect(limiter.hit('a', 0)).toBeNull();
    expect(limiter.hit('a', 500)).toBe(1);
    expect(limiter.hit('a', 1_000)).toBeNull();
  });

  it('forgets everyone rather than grow without bound', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 }, 2);
    limiter.hit('a', 0);
    limiter.hit('a', 0);
    expect(limiter.hit('a', 0)).not.toBeNull();
    limiter.hit('b', 0);
    limiter.hit('c', 0); // over the cap: the map is cleared
    expect(limiter.hit('a', 0)).toBeNull();
  });
});
