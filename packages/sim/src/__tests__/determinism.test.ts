import { describe, expect, it } from 'vitest';
import { runSimulation } from '../run.js';
import { PRODUCT_KEYS } from '../products/index.js';
import { Rng } from '../random.js';

/**
 * M2 exit check: "the same seed gives identical data".
 *
 * This is the property the whole package rests on. Without it a changed number is
 * indistinguishable from a changed rule, and the simulator cannot be used to verify
 * an engine at all.
 */
describe('determinism (brief section 10)', () => {
  it('gives byte-identical output for the same seed', () => {
    const a = runSimulation({ product: 'selfserve', users: 40, seed: 1 });
    const b = runSimulation({ product: 'selfserve', users: 40, seed: 1 });

    expect(JSON.stringify(a.messages)).toBe(JSON.stringify(b.messages));
    // generatedAt is the one real-clock read, and it is metadata, so it is excluded.
    expect(JSON.stringify({ ...a.truthFile, generatedAt: '' })).toBe(
      JSON.stringify({ ...b.truthFile, generatedAt: '' }),
    );
  });

  it('gives different output for a different seed', () => {
    const a = runSimulation({ product: 'selfserve', users: 40, seed: 1 });
    const b = runSimulation({ product: 'selfserve', users: 40, seed: 2 });
    expect(JSON.stringify(a.messages)).not.toBe(JSON.stringify(b.messages));
  });

  it('keeps one person’s journey stable when the user count changes', () => {
    // Each person's stream is derived from the seed AND their index, so adding more
    // people does not reshuffle the ones already there. Without this, growing a run
    // would invalidate every number measured from a smaller one.
    const small = runSimulation({ product: 'selfserve', users: 10, seed: 5 });
    const large = runSimulation({ product: 'selfserve', users: 50, seed: 5 });

    const firstTen = large.truthFile.truth.slice(0, 10);
    expect(JSON.stringify(firstTen)).toBe(JSON.stringify(small.truthFile.truth));
  });

  it('is deterministic for every product', () => {
    for (const key of PRODUCT_KEYS) {
      const a = runSimulation({ product: key, users: 20, seed: 3 });
      const b = runSimulation({ product: key, users: 20, seed: 3 });
      expect(JSON.stringify(a.messages), `${key} is not deterministic`).toBe(
        JSON.stringify(b.messages),
      );
    }
  });

  it('produces messages in delivery order', () => {
    const run = runSimulation({ product: 'b2b', users: 30, seed: 9, faults: ['late-events'] });
    // Not timestamp order: a late event keeps its original timestamp but arrives
    // later, which is exactly the case step state has to survive.
    const deliveries = run.messages.map(
      (m) =>
        m.at.getTime() +
        ((m as { deliverAfterHours?: number }).deliverAfterHours ?? 0) * 3600 * 1000,
    );
    for (let i = 1; i < deliveries.length; i++) {
      expect(deliveries[i]!).toBeGreaterThanOrEqual(deliveries[i - 1]!);
    }
  });

  it('gives every message a unique id, apart from deliberate duplicates', () => {
    const clean = runSimulation({ product: 'selfserve', users: 50, seed: 4 });
    const ids = clean.messages.map((m) => m.message.messageId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('seeded randomness', () => {
  it('replays the same sequence from the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const draws = Array.from({ length: 50 }, () => a.next());
    expect(draws).toEqual(Array.from({ length: 50 }, () => b.next()));
  });

  it('stays inside its bounds', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      const int = rng.int(3, 9);
      expect(int).toBeGreaterThanOrEqual(3);
      expect(int).toBeLessThanOrEqual(9);
    }
  });

  it('shuffles without losing or duplicating an item', () => {
    const rng = new Rng(11);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = rng.shuffle(input);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(input);
  });
});
