import { VirtualClock } from './clock.js';
import { deliveredAt, deliveryOrder, injectFaults } from './faults.js';
import { playPersona } from './personas.js';
import { product } from './products/index.js';
import { Rng } from './random.js';
import type { FaultName, ProductKey, SimMessage, TruthFile, UserTruth } from './types.js';

/**
 * One simulator run (brief section 10).
 *
 * Generates a product's worth of synthetic people on a virtual clock, injects
 * whatever faults were asked for, and returns the messages in DELIVERY order beside
 * the truth file. Deterministic by seed: the same seed gives byte-identical output,
 * which is what makes the engines verifiable rather than merely plausible.
 */

export interface RunOptions {
  product: ProductKey;
  users: number;
  seed: number;
  /** The virtual time the run starts. Fixed by default, so runs are comparable. */
  startedAt?: Date;
  faults?: readonly FaultName[];
}

export interface SimRun {
  messages: SimMessage[];
  truthFile: TruthFile;
  /** What each fault did, for the report. */
  faultLog: { fault: FaultName; detail: string }[];
}

/** The default start: a fixed past Monday, so weekday-sensitive rules are stable. */
const DEFAULT_START = new Date('2026-06-01T08:00:00Z');

export function runSimulation(options: RunOptions): SimRun {
  const definition = product(options.product);
  const startedAt = options.startedAt ?? DEFAULT_START;
  const faults = options.faults ?? [];

  const all: SimMessage[] = [];
  const truth: UserTruth[] = [];

  for (let index = 0; index < options.users; index++) {
    // A stream per person, derived from the run seed, so one person's journey does
    // not shift when the number of users changes.
    const rng = new Rng(options.seed * 1_000_003 + index);
    const clock = new VirtualClock(startedAt);

    // People arrive spread over the first three weeks, not all at once.
    clock.advanceSeconds(rng.int(0, 21 * 86400));

    const persona = rng.weighted(definition.personaMix);
    const played = playPersona({ rng, clock, product: definition, index }, persona);

    all.push(...played.messages);
    truth.push(played.truth);
  }

  // Faults start partway through the window, so there is a clean baseline before
  // them. Tracking health compares against that baseline.
  const faultsFrom = new Date(startedAt.getTime() + 10 * 86400 * 1000);
  const injected = injectFaults(all, {
    faults,
    rng: new Rng(options.seed ^ 0x5f3759df),
    missingEventName: definition.activationEvent,
    renameFrom: definition.coreActionName,
    renameTo: `${definition.coreActionName.toLowerCase().replace(/ /g, '_')}_v2`,
    faultsFrom,
  });

  const messages = deliveryOrder(injected.messages);
  const endedAt = messages.reduce(
    (latest, m) => (deliveredAt(m) > latest ? deliveredAt(m) : latest),
    startedAt,
  );

  const totals = {
    events: messages.length,
    signedUp: truth.filter((t) => t.signedUpAt !== null && !t.expectFiltered).length,
    activated: truth.filter((t) => t.activatedAt !== null && !t.expectFiltered).length,
    paid: truth.filter((t) => t.paidAt !== null && !t.expectFiltered).length,
    stalled: truth.filter((t) => t.expectStallLeak && !t.expectFiltered).length,
    highIntentNoPay: truth.filter(
      (t) => t.expectHighIntent && t.paidAt === null && !t.expectFiltered,
    ).length,
    filtered: truth.filter((t) => t.expectFiltered).length,
  };

  const truthFile: TruthFile = {
    product: options.product,
    seed: options.seed,
    users: options.users,
    // The only real-clock read in the package, and it is metadata, not behaviour.
    generatedAt: new Date().toISOString(),
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    steps: definition.steps,
    activationEvent: definition.activationEvent,
    paidEvent: 'Subscription Started',
    listPriceAmount: definition.listPriceAmount,
    listPriceCurrency: definition.listPriceCurrency,
    trialDays: definition.trialDays,
    truth,
    totals,
    faults: [...faults],
  };

  return { messages, truthFile, faultLog: injected.applied };
}
