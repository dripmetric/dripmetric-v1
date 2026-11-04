/**
 * Deterministic randomness (brief section 10: "deterministic by seed").
 *
 * The same seed must give byte-identical data, or the simulator cannot be used to
 * verify an engine: a changed number would be indistinguishable from a changed rule.
 * So no Math.random anywhere — every choice comes from here.
 *
 * mulberry32: 32-bit state, a handful of operations, good enough distribution for
 * synthetic traffic and short enough to read in one sitting.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // A zero state would stay zero, so fold the seed into something non-zero.
    this.state = (seed ^ 0x9e3779b9) >>> 0;
  }

  /** A float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** An integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with the given probability. */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.next() * items.length)];
    if (item === undefined) throw new Error('Rng.pick needs a non-empty array.');
    return item;
  }

  /** One of the items, chosen by weight. */
  weighted<T>(items: readonly { value: T; weight: number }[]): T {
    const total = items.reduce((sum, i) => sum + i.weight, 0);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) return item.value;
    }
    const last = items[items.length - 1];
    if (!last) throw new Error('Rng.weighted needs a non-empty array.');
    return last.value;
  }

  /** A value around `mean`, never below `min`. For think times and durations. */
  around(mean: number, spread: number, min = 0): number {
    return Math.max(min, Math.round(mean + (this.next() - 0.5) * 2 * spread));
  }

  /** A Fisher-Yates shuffle, so the order is seeded too. */
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const a = copy[i];
      const b = copy[j];
      if (a !== undefined && b !== undefined) {
        copy[i] = b;
        copy[j] = a;
      }
    }
    return copy;
  }

  /** A hex id, so simulated ids look like real ones but stay reproducible. */
  id(prefix: string, length = 12): string {
    let out = '';
    for (let i = 0; i < length; i++) out += '0123456789abcdef'[this.int(0, 15)];
    return `${prefix}_${out}`;
  }
}
