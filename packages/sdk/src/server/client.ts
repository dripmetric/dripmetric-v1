import { BATCH_PATH, LIBRARY_NAME, LIBRARY_VERSION } from '../shared/constants.js';
import type { Message } from '../shared/types.js';

/**
 * The server library (brief section 6).
 *
 * The guarantees are the same as the browser's, for the same reason: this runs
 * inside the founder's request handlers, and an analytics call that can block or
 * throw there is worse than no analytics.
 *
 *  - **A call never blocks.** It adds to an in-memory queue and returns.
 *  - **A call never throws.** Delivery problems go to an optional `onError`.
 *  - **The background timer never keeps the process alive** (it is unref'd), so a
 *    script or a serverless invocation can still exit.
 *  - **Retries with jittered backoff**, and a permanent refusal is not retried.
 *
 * No dependencies beyond `fetch`.
 */

export interface ServerOptions {
  /** Your SECRET key. This is the only kind that may set server-only traits. */
  secretKey: string;
  /** Defaults to our API. Point it at your own host if you proxy. */
  host?: string;
  /** Called when a batch could not be delivered. Never throws into your code. */
  onError?: (error: Error) => void;
  /** Send once this many events are queued. Default 20. */
  flushAt?: number;
  /** Send at least this often, in milliseconds. Default 2000. */
  flushIntervalMs?: number;
  /** Per request. Default 5000. */
  timeoutMs?: number;
  /** Attempts after the first. Default 3. */
  retries?: number;
}

const DEFAULT_HOST = 'https://api.dripmetric.com';

export class Dripmetric {
  private queue: Message[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly host: string;
  private readonly flushAt: number;
  private readonly flushIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private closed = false;
  private inFlight: Promise<void> | undefined;

  constructor(private readonly options: ServerOptions) {
    if (!options.secretKey?.startsWith('sk_')) {
      // A publishable key here would be a silent downgrade: server-only traits and
      // billing events would be refused one by one with no obvious cause.
      throw new Error('Dripmetric needs your SECRET key (sk_live_… or sk_test_…).');
    }
    this.host = (options.host ?? DEFAULT_HOST).replace(/\/+$/, '');
    this.flushAt = options.flushAt ?? 20;
    this.flushIntervalMs = options.flushIntervalMs ?? 2000;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.retries = options.retries ?? 3;
  }

  /** Who this person is. `stripeCustomerId` is accepted only from here. */
  identify(userId: string, traits: Record<string, unknown> = {}): void {
    this.enqueue({ type: 'identify', userId, traits });
  }

  /** The account this person belongs to. */
  group(userId: string, groupId: string, traits: Record<string, unknown> = {}): void {
    this.enqueue({ type: 'group', userId, groupId, traits });
  }

  /** Something happened. */
  track(userId: string, event: string, properties: Record<string, unknown> = {}): void {
    this.enqueue({ type: 'track', userId, event, properties });
  }

  page(userId: string, properties: Record<string, unknown> = {}): void {
    this.enqueue({ type: 'page', userId, properties });
  }

  /**
   * Erases a person: their events, traits, sessions, scores, leak instances and
   * alerts (brief section 10). Unlike the others this one AWAITS, because a deletion
   * request needs an answer the caller can act on.
   */
  async deleteUser(userId: string): Promise<{ deleted: boolean }> {
    if (!userId) throw new Error('deleteUser needs a user id.');
    const response = await this.request(
      `${this.host}/v1/users/${encodeURIComponent(userId)}`,
      'DELETE',
      undefined,
    );
    if (!response.ok && response.status !== 404) {
      throw new Error(`Dripmetric could not delete that user (${response.status}).`);
    }
    return { deleted: response.ok };
  }

  private enqueue(partial: Omit<Message, 'messageId' | 'timestamp' | 'context'>): void {
    if (this.closed) return;
    this.queue.push({
      ...partial,
      // Client-generated, so a retry can never double-count.
      messageId: randomId(),
      timestamp: new Date().toISOString(),
      context: { library: { name: `${LIBRARY_NAME}-node`, version: LIBRARY_VERSION } },
    });

    if (this.queue.length >= this.flushAt) {
      void this.flush();
      return;
    }
    if (this.timer === undefined) {
      this.timer = setTimeout(() => {
        this.timer = undefined;
        void this.flush();
      }, this.flushIntervalMs);
      // Must not keep the process alive: a CLI or a serverless invocation has to be
      // able to exit. Without this, `node script.js` hangs for two seconds at the end.
      (this.timer as unknown as { unref?: () => void }).unref?.();
    }
  }

  /** Sends what is queued. Resolves when the attempt is over, and never rejects. */
  flush(): Promise<void> {
    // One send at a time, so retries cannot interleave and reorder a batch.
    this.inFlight = (this.inFlight ?? Promise.resolve()).then(() => this.sendOnce());
    return this.inFlight;
  }

  private async sendOnce(): Promise<void> {
    const batch = this.queue.splice(0, this.queue.length);
    if (batch.length === 0) return;

    const body = JSON.stringify({ batch, sentAt: new Date().toISOString() });

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      let status = 0;
      try {
        const response = await this.request(this.host + BATCH_PATH, 'POST', body);
        if (response.ok) return;
        status = response.status;
      } catch (error) {
        this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
      }

      // A 4xx other than 429 will never succeed: a bad key or a malformed body does
      // not fix itself, and retrying it just delays the founder's own request.
      if (status >= 400 && status < 500 && status !== 429) {
        this.options.onError?.(new Error(`Dripmetric refused the batch (${status}).`));
        return;
      }

      if (attempt < this.retries) {
        const base = 250 * 2 ** attempt;
        await sleep(base + Math.random() * base);
      } else {
        this.options.onError?.(
          new Error(
            `Dripmetric could not deliver ${batch.length} events after ${attempt + 1} attempts.`,
          ),
        );
      }
    }
  }

  private async request(url: string, method: string, body: string | undefined): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${this.options.secretKey}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body } : {}),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  /** How many events are waiting. For tests and for a graceful shutdown check. */
  queued(): number {
    return this.queue.length;
  }

  /** Flush and stop accepting events. Call before a process exits. */
  async shutdown(): Promise<void> {
    this.closed = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    await this.flush();
  }
}

/**
 * Finish delivery AFTER the response, so analytics never delays it
 * (brief section 6).
 *
 * Pass your platform's primitive. Both take a promise, so the same call works for
 * either — verified against `@vercel/functions` 3.10.4 and Next.js 16.4.3:
 *
 * ```js
 * import { waitUntil } from '@vercel/functions';
 * flushAfterResponse(dm, waitUntil);
 *
 * // or, in a Next.js route handler:
 * import { after } from 'next/server';
 * flushAfterResponse(dm, after);
 * ```
 *
 * Neither package is a dependency of this one: you already have whichever you use,
 * and a zero-dependency library should not reach for either.
 *
 * Without a scheduler the flush is left running in the background, which is the best
 * a plain Node server can do and is correct there — the process stays alive anyway.
 */
export function flushAfterResponse(
  dm: Dripmetric,
  schedule?: (work: Promise<unknown>) => unknown,
): void {
  const work = dm.flush();
  if (!schedule) {
    // A long-running server: the event loop will get to it.
    void work;
    return;
  }
  try {
    schedule(work);
  } catch {
    // Called outside a request scope, which both platforms reject. The flush is
    // already running, so nothing is lost.
    void work;
  }
}

function randomId(): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    (t as unknown as { unref?: () => void }).unref?.();
  });
}
