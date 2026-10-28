import { BATCH_PATH, LIBRARY_NAME, LIBRARY_VERSION } from '../shared/constants.js';
import type { Message } from '../shared/types.js';

/**
 * The server library (brief section 6). Full behaviour, including the serverless
 * flush helper, is finished at M4; what is here already keeps the guarantees that
 * matter most:
 *
 *  - **A call never blocks.** It adds to an in-memory queue and returns.
 *  - **A call never throws.** Delivery problems go to an optional `onError`.
 *  - **The background timer never keeps the process alive** (it is unref'd), so a
 *    script that finishes does not hang waiting for a flush.
 */

export interface ServerOptions {
  secretKey: string;
  /** Defaults to our API. Point it at your own host if you proxy. */
  host?: string;
  /** Called when a batch could not be delivered. Never throws into your code. */
  onError?: (error: Error) => void;
  flushAt?: number;
  flushIntervalMs?: number;
}

const DEFAULT_HOST = 'https://api.dripmetric.com';

export class Dripmetric {
  private queue: Message[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly host: string;
  private readonly flushAt: number;
  private readonly flushIntervalMs: number;
  private closed = false;

  constructor(private readonly options: ServerOptions) {
    if (!options.secretKey?.startsWith('sk_')) {
      throw new Error('Dripmetric needs your SECRET key (sk_live_… or sk_test_…).');
    }
    this.host = (options.host ?? DEFAULT_HOST).replace(/\/+$/, '');
    this.flushAt = options.flushAt ?? 20;
    this.flushIntervalMs = options.flushIntervalMs ?? 2000;
  }

  identify(userId: string, traits: Record<string, unknown> = {}): void {
    this.enqueue({ type: 'identify', userId, traits });
  }

  group(userId: string, groupId: string, traits: Record<string, unknown> = {}): void {
    this.enqueue({ type: 'group', userId, groupId, traits });
  }

  track(userId: string, event: string, properties: Record<string, unknown> = {}): void {
    this.enqueue({ type: 'track', userId, event, properties });
  }

  page(userId: string, properties: Record<string, unknown> = {}): void {
    this.enqueue({ type: 'page', userId, properties });
  }

  private enqueue(partial: Omit<Message, 'messageId' | 'timestamp' | 'context'>): void {
    if (this.closed) return;
    this.queue.push({
      ...partial,
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
      // Must not keep the process alive: a CLI or a serverless invocation has to
      // be able to exit. The handle is a Node Timeout here, but the same file is
      // type-checked with DOM types in scope, where it is a number.
      (this.timer as unknown as { unref?: () => void }).unref?.();
    }
  }

  /** Sends what is queued. Resolves when the attempt is over, and never rejects. */
  async flush(): Promise<void> {
    const batch = this.queue.splice(0, this.queue.length);
    if (batch.length === 0) return;

    try {
      const response = await fetch(this.host + BATCH_PATH, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.secretKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ batch, sentAt: new Date().toISOString() }),
      });
      if (!response.ok) {
        this.options.onError?.(new Error(`Dripmetric returned ${response.status}`));
      }
    } catch (error) {
      this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** Flush and stop accepting events. Call before a process exits. */
  async shutdown(): Promise<void> {
    this.closed = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    await this.flush();
  }
}

function randomId(): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}
