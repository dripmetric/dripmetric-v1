import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { Dripmetric, flushAfterResponse } from '../server/client.js';
import { signUserId } from '../server/signing.js';

/**
 * M4 exit checks (brief section 11), plus the guarantees that make the library safe
 * to call from inside a founder's request handler.
 */

interface Recorder {
  url: string;
  bodies: unknown[];
  /** Hangs every request, to prove a call still does not block. */
  hang: boolean;
  /** Closes the socket mid-request, to prove a death mid-send is survivable. */
  die: boolean;
  status: number;
  close: () => Promise<void>;
}

async function recorder(): Promise<Recorder> {
  const state = { bodies: [] as unknown[], hang: false, die: false, status: 200 };

  const server: Server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      if (state.die) {
        // The server dies with the request half-read: a deploy, a crash, a timeout.
        request.socket.destroy();
        return;
      }
      if (state.hang) return; // never responds
      try {
        state.bodies.push(JSON.parse(body));
      } catch {
        state.bodies.push(body);
      }
      response.writeHead(state.status, { 'content-type': 'application/json' });
      response.end('{"results":[],"accepted":0}');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}`,
    get bodies() {
      return state.bodies;
    },
    set hang(value: boolean) {
      state.hang = value;
    },
    get hang() {
      return state.hang;
    },
    set die(value: boolean) {
      state.die = value;
    },
    get die() {
      return state.die;
    },
    set status(value: number) {
      state.status = value;
    },
    get status() {
      return state.status;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

describe('the server library', () => {
  let api: Recorder;

  beforeEach(async () => {
    api = await recorder();
  });
  afterEach(async () => {
    await api.close();
    vi.useRealTimers();
  });

  const make = (over: Partial<ConstructorParameters<typeof Dripmetric>[0]> = {}) =>
    new Dripmetric({ secretKey: 'sk_test_abcdefghijklmnop', host: api.url, retries: 0, ...over });

  it('refuses a publishable key, rather than failing event by event later', () => {
    // With a pk, every server-only trait and billing event would be refused one at
    // a time with no obvious cause.
    expect(() => new Dripmetric({ secretKey: 'pk_live_abcdefghijklmnop' })).toThrow(/SECRET key/);
    expect(() => new Dripmetric({ secretKey: '' })).toThrow(/SECRET key/);
  });

  it('sends what the example app sends', async () => {
    const dm = make();
    dm.identify('user_1', { email: 'sam@acme.com', createdAt: '2026-06-01T10:00:00Z' });
    dm.track('user_1', 'Signed Up', { method: 'email' });
    dm.track('user_1', 'Activated');
    dm.track('user_1', 'Checkout Started', { plan: 'pro', amount: 2900, currency: 'usd' });
    await dm.shutdown();

    const batch = (api.bodies[0] as { batch: { type: string; event?: string }[] }).batch;
    expect(batch.map((m) => m.event ?? m.type)).toEqual([
      'identify',
      'Signed Up',
      'Activated',
      'Checkout Started',
    ]);
  });

  it('gives every message its own id, so a retry cannot double-count', async () => {
    const dm = make();
    for (let i = 0; i < 5; i++) dm.track('user_1', 'Core Action');
    await dm.shutdown();

    const batch = (api.bodies[0] as { batch: { messageId: string }[] }).batch;
    const ids = batch.map((m) => m.messageId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not block when the server never answers', async () => {
    api.hang = true;
    const dm = make({ timeoutMs: 300 });

    // The founder's own request handler. If a track() call blocked, this would take
    // as long as the hanging request does.
    const started = Date.now();
    dm.track('user_1', 'Signed Up');
    dm.track('user_1', 'Activated');
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(50);
    expect(dm.queued()).toBe(2);
    await dm.shutdown();
  });

  it('neither throws nor blocks when the server dies mid-send', async () => {
    api.die = true;
    const errors: Error[] = [];
    const dm = make({ onError: (error) => errors.push(error), timeoutMs: 500 });

    dm.track('user_1', 'Signed Up');

    // The exit check: a death mid-send must not reject, and must not take the
    // founder's request down with it.
    await expect(dm.shutdown()).resolves.toBeUndefined();
    // It is reported, not swallowed silently.
    expect(errors.length).toBeGreaterThan(0);
  });

  it('reports a refused batch and does not retry it', async () => {
    api.status = 401;
    const errors: Error[] = [];
    const dm = make({ onError: (error) => errors.push(error), retries: 3 });

    dm.track('user_1', 'Signed Up');
    await dm.shutdown();

    // A bad key does not fix itself, so retrying only delays the founder's request.
    // The request arrives exactly once, even though three retries were allowed.
    expect(api.bodies).toHaveLength(1);
    expect(errors.some((e) => /401/.test(e.message))).toBe(true);
  });

  it('retries a 500 with backoff, then gives up and says so', async () => {
    /*
     * Real timers here, unlike the browser transport's retry test.
     *
     * Fake timers do not mix with a real HTTP server: `runAllTimersAsync` decides
     * there are no more timers while a round trip is still in flight, so the next
     * backoff is never queued and the loop ends an attempt early — it saw two
     * requests where three were due. The backoff is 250 ms then 500 ms, so real
     * time costs about a second and is honest about what happens.
     */
    api.status = 500;
    const errors: Error[] = [];
    const dm = make({ onError: (error) => errors.push(error), retries: 2, timeoutMs: 500 });

    dm.track('user_1', 'Signed Up');
    await dm.flush();

    // Three attempts: the first, plus the two retries that were allowed. A 500 is
    // worth retrying, unlike a 401.
    expect(api.bodies).toHaveLength(3);
    expect(errors.some((e) => /could not deliver/.test(e.message))).toBe(true);
  });

  it('flushes once the batch reaches flushAt, without waiting for the timer', async () => {
    const dm = make({ flushAt: 3, flushIntervalMs: 60_000 });
    dm.track('user_1', 'Core Action');
    dm.track('user_1', 'Core Action');
    expect(api.bodies).toHaveLength(0);

    dm.track('user_1', 'Core Action');
    // The third event trips flushAt, so this resolves without the 60s timer.
    await dm.flush();
    expect(api.bodies).toHaveLength(1);
    await dm.shutdown();
  });

  it('accepts no more events after shutdown', async () => {
    const dm = make();
    await dm.shutdown();
    dm.track('user_1', 'Core Action');
    expect(dm.queued()).toBe(0);
  });

  it('deletes a user and treats an unknown one as already gone', async () => {
    const dm = make();
    // Our recorder answers 200 to anything, which is the "deleted" case.
    await expect(dm.deleteUser('user_1')).resolves.toEqual({ deleted: true });

    api.status = 404;
    await expect(dm.deleteUser('user_missing')).resolves.toEqual({ deleted: false });

    // Anything else is a real failure the caller should see.
    api.status = 500;
    await expect(dm.deleteUser('user_1')).rejects.toThrow(/could not delete/);
    await dm.shutdown();
  });
});

describe('flushAfterResponse (brief section 6)', () => {
  it('hands the promise to the platform, so delivery outlives the response', async () => {
    const api = await recorder();
    try {
      const dm = new Dripmetric({
        secretKey: 'sk_test_abcdefghijklmnop',
        host: api.url,
        retries: 0,
      });
      dm.track('user_1', 'Signed Up');

      // Both Vercel's waitUntil and Next's `after` take a promise, verified against
      // @vercel/functions 3.10.4 and Next.js 16.4.3, so one call serves both.
      const scheduled: Promise<unknown>[] = [];
      flushAfterResponse(dm, (work) => scheduled.push(work as Promise<unknown>));

      expect(scheduled).toHaveLength(1);
      // The response could already have been sent by now; delivery finishes after.
      await scheduled[0];
      expect(api.bodies).toHaveLength(1);
      await dm.shutdown();
    } finally {
      await api.close();
    }
  });

  it('still delivers with no scheduler, which is right on a long-running server', async () => {
    const api = await recorder();
    try {
      const dm = new Dripmetric({
        secretKey: 'sk_test_abcdefghijklmnop',
        host: api.url,
        retries: 0,
      });
      dm.track('user_1', 'Signed Up');
      flushAfterResponse(dm);
      await dm.flush();
      expect(api.bodies).toHaveLength(1);
      await dm.shutdown();
    } finally {
      await api.close();
    }
  });

  it('does not throw when the platform rejects the call outside a request scope', async () => {
    const api = await recorder();
    try {
      const dm = new Dripmetric({
        secretKey: 'sk_test_abcdefghijklmnop',
        host: api.url,
        retries: 0,
      });
      dm.track('user_1', 'Signed Up');
      // Next's `after` throws if called outside a request; the flush is already
      // running, so nothing is lost and nothing escapes.
      expect(() =>
        flushAfterResponse(dm, () => {
          throw new Error('after() was called outside a request scope');
        }),
      ).not.toThrow();
      await dm.flush();
      await dm.shutdown();
    } finally {
      await api.close();
    }
  });
});

describe('signUserId (brief section 5)', () => {
  it('is stable, and different per user and per key', () => {
    const a = signUserId('sk_live_aaaaaaaaaaaaaaaa', 'user_1');
    expect(a).toBe(signUserId('sk_live_aaaaaaaaaaaaaaaa', 'user_1'));
    expect(a).not.toBe(signUserId('sk_live_aaaaaaaaaaaaaaaa', 'user_2'));
    expect(a).not.toBe(signUserId('sk_live_bbbbbbbbbbbbbbbb', 'user_1'));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses a publishable key, which would make the whole check pointless', () => {
    // A pk is public, so anyone could forge the signature with it.
    expect(() => signUserId('pk_live_aaaaaaaaaaaaaaaa', 'user_1')).toThrow(/SECRET key/);
  });
});
