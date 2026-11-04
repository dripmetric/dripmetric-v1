import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Transport } from '../browser/transport.js';
import { MAX_QUEUED_EVENTS } from '../shared/constants.js';
import type { Message } from '../shared/types.js';

/**
 * The transport's guarantees (brief section 6). "The SDK must never slow, break or
 * block the founder's app" is the whole design brief, so each promise is a test.
 */
function message(id: string): Message {
  return {
    type: 'track',
    messageId: id,
    timestamp: '2026-06-01T10:00:00.000Z',
    event: 'Core Action',
  };
}

describe('transport', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let dropped = 0;
  /*
   * Every transport a test makes is disposed afterwards.
   *
   * Without this the suite is not deterministic: a transport that still has events
   * queued keeps a 2-second flush timer, and when it fires DURING a later test it
   * lands on that test's shared `fetch` mock. "retries a 500 and a 429" saw four
   * calls in the full suite and three on its own, which is exactly that.
   */
  const made: Transport[] = [];

  const make = () => {
    const transport = new Transport({
      host: 'https://example.invalid',
      publishableKey: 'pk_test_abc',
      debug: false,
      onDropped: (count) => {
        dropped = count;
      },
    });
    made.push(transport);
    return transport;
  };

  beforeEach(() => {
    dropped = 0;
    fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    // discard() clears the pending timer as well as the queue.
    for (const transport of made.splice(0, made.length)) transport.discard();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('sends nothing at all until consent opens the gate', async () => {
    // Settled decision 13: nothing is sent until consent(true), not even one event.
    const transport = make();
    for (let i = 0; i < 50; i++) transport.enqueue(message(`m${i}`));
    await transport.flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(transport.queued()).toBe(50);
  });

  it('flushes what was waiting once consent arrives', async () => {
    const transport = make();
    transport.enqueue(message('m1'));
    expect(fetchMock).not.toHaveBeenCalled();

    transport.allowSending();
    await transport.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.batch).toHaveLength(1);
    // The key travels in the BODY, because a beacon cannot set a header.
    expect(body.writeKey).toBe('pk_test_abc');
  });

  it('puts the key in the body and uses text/plain, so no CORS preflight is needed', async () => {
    const transport = make();
    transport.allowSending();
    transport.enqueue(message('m1'));
    await transport.flush();

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init.headers['content-type']).toBe('text/plain');
    expect(init.headers.authorization).toBeUndefined();
  });

  it('caps the queue and drops the OLDEST, because the newest still matter', () => {
    const transport = make();
    for (let i = 0; i < MAX_QUEUED_EVENTS + 25; i++) transport.enqueue(message(`m${i}`));

    expect(transport.queued()).toBe(MAX_QUEUED_EVENTS);
    expect(transport.droppedCount()).toBe(25);
    expect(dropped).toBe(25);

    // The survivors are the most recent ones.
    const remaining = transport.drain();
    expect(remaining[0]?.messageId).toBe('m25');
  });

  it('never rejects when the network is down', async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new Error('network is gone'));
    const transport = make();
    transport.allowSending();
    transport.enqueue(message('m1'));

    // A rejection here would surface in a founder's app as an unhandled rejection.
    const flushed = transport.flush();
    await vi.runAllTimersAsync();
    await expect(flushed).resolves.toBeUndefined();
  });

  it('keeps events queued after a failure, so they go out on the next attempt', async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new Error('offline'));
    const transport = make();
    transport.allowSending();
    transport.enqueue(message('m1'));

    const flushed = transport.flush();
    await vi.runAllTimersAsync();
    await flushed;

    // Our outage is our problem: the event is still here, not lost.
    expect(transport.queued()).toBe(1);
  });

  it('does not retry a 400, because it will never succeed', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 400 }));
    const transport = make();
    transport.allowSending();
    transport.enqueue(message('m1'));
    await transport.flush();

    // One attempt, not four: retrying a permanent refusal only wastes a battery.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(transport.queued()).toBe(0);
    expect(transport.droppedCount()).toBe(1);
  });

  it('retries a 500 and a 429, then succeeds', async () => {
    /*
     * Fake timers, because this test is about COUNTING attempts.
     *
     * The retry backoff is real time (500 ms, then 1 s, both jittered), and the
     * 2-second flush timer fires inside that window. With real timers the test saw
     * three requests on its own and four in the suite — the flakiness was the test's
     * clock, not the transport's logic.
     */
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const transport = make();
    transport.allowSending();
    transport.enqueue(message('m1'));

    const flushed = transport.flush();
    await vi.runAllTimersAsync();
    await flushed;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(transport.queued()).toBe(0);
  });

  it('uses a beacon at page close, falling back to keepalive fetch', () => {
    const beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    vi.stubGlobal(
      'Blob',
      class {
        constructor(readonly parts: unknown[]) {}
      },
    );

    const transport = make();
    transport.allowSending();
    expect(transport.sendBeacon([message('m1')])).toBe(true);
    expect(beacon).toHaveBeenCalledTimes(1);

    // When sendBeacon refuses (it has a size limit), keepalive fetch takes over.
    beacon.mockReturnValue(false);
    expect(transport.sendBeacon([message('m2')])).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls.at(-1)?.[1]?.keepalive).toBe(true);
  });

  it('sends no beacon before consent', () => {
    const beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    const transport = make();
    expect(transport.sendBeacon([message('m1')])).toBe(false);
    expect(beacon).not.toHaveBeenCalled();
  });
});
