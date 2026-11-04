import {
  BATCH_PATH,
  BATCH_SIZE,
  FAILURES_BEFORE_PAUSE,
  FAILURE_PAUSE_MS,
  FLUSH_INTERVAL_MS,
  MAX_QUEUED_EVENTS,
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
} from '../shared/constants.js';
import type { Message } from '../shared/types.js';

/**
 * The transport (brief section 6, "Guarantees for both").
 *
 * The SDK must never slow, break or block the founder's app. That is the whole
 * design brief for this file:
 *
 *  - **Never blocks.** Sending happens off the rendering path, on a timer.
 *  - **Never throws.** Every path is wrapped; failures go to an opt-in debug log.
 *  - **Bounded memory.** 1,000 events, oldest dropped first.
 *  - **Short timeouts.** 3 seconds, 3 retries with jittered backoff.
 *  - **Our outage is our problem.** Events buffer briefly, then drop and are counted.
 */

export interface TransportOptions {
  host: string;
  publishableKey: string;
  debug: boolean;
  onDropped: (count: number) => void;
}

export class Transport {
  private queue: Message[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private consecutiveFailures = 0;
  private pausedUntil = 0;
  private dropped = 0;
  /** Sending is held back entirely until consent arrives (settled decision 13). */
  private sendingAllowed = false;
  private inFlight: Promise<void> | undefined;
  /**
   * True while a batch is being sent, retries and all.
   *
   * A retry loop can run for several seconds, and the 2-second flush timer would
   * fire inside it and queue a second attempt behind the first. That is wasted work
   * at best, and it made the retry test non-deterministic: it saw four requests in
   * the suite and three on its own.
   */
  private sending = false;

  constructor(private readonly options: TransportOptions) {}

  /** After this, queued events may leave the device. */
  allowSending(): void {
    this.sendingAllowed = true;
    this.schedule();
  }

  isSendingAllowed(): boolean {
    return this.sendingAllowed;
  }

  /**
   * Adds a message. Never throws, and never grows without bound: past the cap the
   * OLDEST are dropped, because the newest events are the ones still worth having.
   */
  enqueue(message: Message): void {
    this.queue.push(message);
    if (this.queue.length > MAX_QUEUED_EVENTS) {
      const overflow = this.queue.length - MAX_QUEUED_EVENTS;
      this.queue.splice(0, overflow);
      this.dropped += overflow;
      this.options.onDropped(this.dropped);
      this.log(`queue full, dropped ${overflow} of the oldest events`);
    }
    if (this.queue.length >= BATCH_SIZE) this.flush();
    else this.schedule();
  }

  private schedule(): void {
    // No timer while a send is in flight: the in-flight attempt will take whatever
    // is queued when it finishes, and `sendOnce` schedules again if anything is left.
    if (this.timer !== undefined || !this.sendingAllowed || this.sending) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.flush();
    }, FLUSH_INTERVAL_MS);
    // A pending flush must never hold a page open or keep a test process alive.
    (this.timer as unknown as { unref?: () => void }).unref?.();
  }

  /** Sends what is queued. Resolves when the attempt is over, and never rejects. */
  flush(): Promise<void> {
    if (!this.sendingAllowed) return Promise.resolve();
    // One send at a time, so retries cannot interleave and reorder a batch.
    this.inFlight = (this.inFlight ?? Promise.resolve()).then(() => this.sendOnce());
    return this.inFlight;
  }

  private async sendOnce(): Promise<void> {
    if (this.sending || this.queue.length === 0) return;
    if (Date.now() < this.pausedUntil) {
      this.log('paused after repeated failures; keeping events queued');
      return;
    }

    this.sending = true;
    try {
      await this.sendBatch();
    } finally {
      this.sending = false;
      // Anything that arrived while we were busy goes out on the next tick.
      if (this.queue.length > 0) this.schedule();
    }
  }

  private async sendBatch(): Promise<void> {
    const batch = this.queue.splice(0, MAX_QUEUED_EVENTS);
    const body = this.bodyFor(batch);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const outcome = await this.attempt(body);

      if (outcome === 'ok') {
        this.consecutiveFailures = 0;
        return;
      }

      // A 4xx other than 429 will never succeed, so retrying only wastes the
      // visitor's battery. The events are dropped and counted.
      if (outcome === 'permanent') {
        this.dropped += batch.length;
        this.options.onDropped(this.dropped);
        this.log(`server refused ${batch.length} events; they will not be retried`);
        return;
      }

      if (attempt < MAX_RETRIES) {
        // Jittered backoff, so a thundering herd after our outage does not
        // arrive in lockstep.
        const base = 500 * 2 ** attempt;
        await sleep(base + Math.random() * base);
      }
    }

    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= FAILURES_BEFORE_PAUSE) {
      this.pausedUntil = Date.now() + FAILURE_PAUSE_MS;
      this.log(
        `pausing for ${FAILURE_PAUSE_MS / 1000}s after ${this.consecutiveFailures} failures`,
      );
    }

    // Put them back at the FRONT, so order is preserved for the next attempt.
    this.queue.unshift(...batch);
    if (this.queue.length > MAX_QUEUED_EVENTS) {
      const overflow = this.queue.length - MAX_QUEUED_EVENTS;
      this.queue.splice(0, overflow);
      this.dropped += overflow;
      this.options.onDropped(this.dropped);
    }
  }

  private async attempt(body: string): Promise<'ok' | 'retry' | 'permanent'> {
    const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
    const timeout = setTimeout(() => controller?.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(this.url(), {
        method: 'POST',
        // text/plain avoids a CORS preflight, and is what a beacon must send anyway,
        // so both paths use one content type (brief section 5).
        headers: { 'content-type': 'text/plain' },
        body,
        credentials: 'omit',
        keepalive: body.length < 60_000,
        ...(controller ? { signal: controller.signal } : {}),
      });

      if (response.ok) return 'ok';
      // 429 and 5xx are worth retrying; everything else is our mistake or the
      // founder's configuration, and will not fix itself.
      if (response.status === 429 || response.status >= 500) return 'retry';
      this.log(`server said ${response.status}`);
      return 'permanent';
    } catch (error) {
      this.log(`send failed: ${String(error)}`);
      return 'retry';
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * A beacon: for the last moment of a page, when a normal fetch would be cancelled
   * by the navigation. `sendBeacon` cannot set headers, which is the whole reason
   * the key travels in the body (brief section 5).
   */
  sendBeacon(messages: Message[]): boolean {
    if (!this.sendingAllowed || messages.length === 0) return false;
    const body = this.bodyFor(messages);
    try {
      if (navigator.sendBeacon?.(this.url(), new Blob([body], { type: 'text/plain' }))) return true;
    } catch {
      // Fall through to keepalive fetch.
    }
    try {
      // The documented fallback: fetch with keepalive survives the navigation too.
      void fetch(this.url(), {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body,
        keepalive: true,
        credentials: 'omit',
      }).catch(() => undefined);
      return true;
    } catch {
      return false;
    }
  }

  private url(): string {
    return this.options.host.replace(/\/+$/, '') + BATCH_PATH;
  }

  private bodyFor(batch: Message[]): string {
    return JSON.stringify({
      batch,
      // Our clock. The server compares it with receipt time to correct a wrong one.
      sentAt: new Date().toISOString(),
      // In the body because a beacon cannot set a header.
      writeKey: this.options.publishableKey,
    });
  }

  /** Everything still waiting, for a beacon at page close. */
  drain(): Message[] {
    return this.queue.splice(0, this.queue.length);
  }

  queued(): number {
    return this.queue.length;
  }

  droppedCount(): number {
    return this.dropped;
  }

  /** `reset()` and teardown: forget what was queued without sending it. */
  discard(): void {
    this.queue.length = 0;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private log(message: string): void {
    if (this.options.debug) console.warn(`[dripmetric] ${message}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    (t as unknown as { unref?: () => void }).unref?.();
  });
}
