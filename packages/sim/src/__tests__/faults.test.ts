import { describe, expect, it } from 'vitest';
import { runSimulation } from '../run.js';
import { product } from '../products/index.js';

/**
 * Injected faults (brief section 10). Each of these happens in the wild, and each
 * would quietly corrupt the numbers if the pipeline got it wrong.
 */
describe('fault injection', () => {
  it('adds exact duplicates: same id, same content', () => {
    const clean = runSimulation({ product: 'selfserve', users: 60, seed: 1 });
    const faulty = runSimulation({
      product: 'selfserve',
      users: 60,
      seed: 1,
      faults: ['duplicates'],
    });

    expect(faulty.messages.length).toBeGreaterThan(clean.messages.length);

    const ids = faulty.messages.map((m) => m.message.messageId);
    const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(repeated.length).toBeGreaterThan(0);

    // A duplicate must be byte-identical, or it is a different event, not a retry.
    const firstRepeat = repeated[0]!;
    const copies = faulty.messages.filter((m) => m.message.messageId === firstRepeat);
    expect(copies).toHaveLength(2);
    expect(JSON.stringify(copies[0]!.message)).toBe(JSON.stringify(copies[1]!.message));
  });

  it('delays some events without changing when they happened', () => {
    const faulty = runSimulation({
      product: 'selfserve',
      users: 60,
      seed: 1,
      faults: ['late-events'],
    });
    const late = faulty.messages.filter(
      (m) => (m as { deliverAfterHours?: number }).deliverAfterHours,
    );

    expect(late.length).toBeGreaterThan(0);
    for (const message of late) {
      const delay = (message as { deliverAfterHours?: number }).deliverAfterHours!;
      expect(delay).toBeGreaterThanOrEqual(2);
      expect(delay).toBeLessThanOrEqual(30);
      // The timestamp still says when it happened; only delivery moved.
      expect(message.message.timestamp).toBe(message.at.toISOString());
    }
  });

  it('stops a key event arriving partway through, leaving a clean baseline first', () => {
    const activation = product('selfserve').activationEvent;
    const clean = runSimulation({ product: 'selfserve', users: 120, seed: 1 });
    const faulty = runSimulation({
      product: 'selfserve',
      users: 120,
      seed: 1,
      faults: ['missing-event'],
    });

    const count = (run: typeof clean) =>
      run.messages.filter((m) => m.message.type === 'track' && m.message.event === activation)
        .length;

    expect(count(faulty)).toBeLessThan(count(clean));
    // There has to be a baseline before the break, or tracking health has nothing
    // to compare against (brief section 9).
    expect(count(faulty)).toBeGreaterThan(0);

    const faultsFrom = new Date(new Date(clean.truthFile.startedAt).getTime() + 10 * 86400 * 1000);
    const after = faulty.messages.filter(
      (m) => m.message.type === 'track' && m.message.event === activation && m.at >= faultsFrom,
    );
    expect(after).toHaveLength(0);
  });

  it('renames an event, so the new name lands in the Inbox', () => {
    const own = product('selfserve').coreActionName; // 'Invoice Sent'
    const faulty = runSimulation({
      product: 'selfserve',
      users: 120,
      seed: 1,
      faults: ['renamed-event'],
    });

    const renamed = faulty.messages.filter(
      (m) => m.message.type === 'track' && m.message.event === 'invoice_sent_v2',
    );
    expect(renamed.length).toBeGreaterThan(0);

    // The old name keeps its mapping; only events after the deploy use the new one.
    const original = faulty.messages.filter(
      (m) => m.message.type === 'track' && m.message.event === own,
    );
    expect(original.length).toBeGreaterThan(0);
  });

  it('skews some device clocks, stamping sentAt with the same wrong clock', () => {
    const faulty = runSimulation({
      product: 'selfserve',
      users: 80,
      seed: 1,
      faults: ['clock-skew'],
    });
    const skewed = faulty.messages.filter((m) => m.message.timestamp !== m.at.toISOString());

    expect(skewed.length).toBeGreaterThan(0);
    for (const message of skewed) {
      // This is what makes the skew correctable: the gap between sentAt and when we
      // receive it IS the clock's error (brief section 5, step 5).
      expect(message.message.sentAt).toBe(message.message.timestamp);
    }
  });

  it('adds a burst at 100 times volume, which the rate limit and daily cap must absorb', () => {
    const clean = runSimulation({ product: 'selfserve', users: 40, seed: 1 });
    const faulty = runSimulation({ product: 'selfserve', users: 40, seed: 1, faults: ['burst'] });

    expect(faulty.messages.length - clean.messages.length).toBe(2000); // 20 events x 100
    const burst = faulty.messages.filter((m) => m.message.messageId.includes('-burst-'));
    expect(burst).toHaveLength(2000);
    // Each gets its own id, so they are 2,000 real events to absorb, not 2,000
    // duplicates that dedupe would quietly swallow.
    expect(new Set(burst.map((m) => m.message.messageId)).size).toBe(2000);
  });

  it('records what each fault did, so a surprising count has an explanation', () => {
    const faulty = runSimulation({
      product: 'selfserve',
      users: 60,
      seed: 1,
      faults: ['duplicates', 'late-events', 'clock-skew'],
    });
    expect(faulty.faultLog.map((f) => f.fault).sort()).toEqual([
      'clock-skew',
      'duplicates',
      'late-events',
    ]);
    for (const entry of faulty.faultLog) expect(entry.detail.length).toBeGreaterThan(5);
  });

  it('leaves the truth untouched: a fault is a tracking problem, not a user problem', () => {
    const clean = runSimulation({ product: 'selfserve', users: 60, seed: 1 });
    const faulty = runSimulation({
      product: 'selfserve',
      users: 60,
      seed: 1,
      faults: ['duplicates', 'late-events', 'missing-event', 'clock-skew'],
    });
    // The person still signed up and still stalled. Only what reached us changed,
    // which is exactly the distinction tracking health has to make.
    expect(JSON.stringify(faulty.truthFile.truth.map((t) => ({ ...t, eventCount: 0 })))).toBe(
      JSON.stringify(clean.truthFile.truth.map((t) => ({ ...t, eventCount: 0 }))),
    );
  });
});

describe('payload emitters for the no-code feeds', () => {
  it('emits Segment, RudderStack and PostHog shapes from the same journey', async () => {
    const { toSegmentBatch, toRudderStackBatch, toPostHogEvents } = await import('../emitters.js');
    const run = runSimulation({ product: 'selfserve', users: 20, seed: 1 });
    const slice = run.messages.slice(0, 50);

    const segment = toSegmentBatch(slice) as unknown[];
    expect(segment).toHaveLength(50);

    const rudder = toRudderStackBatch(slice) as { batch: unknown[] };
    expect(rudder.batch).toHaveLength(50);

    // PostHog only carries track and page events, and turns a page view into
    // $pageview, which the adapter has to map back.
    const posthog = toPostHogEvents(slice) as { event: string }[];
    expect(posthog.length).toBeGreaterThan(0);
    expect(posthog.length).toBeLessThanOrEqual(50);
    expect(posthog.some((e) => e.event === '$pageview')).toBe(true);
  });
});
