import { describe, expect, it } from 'vitest';
import { runSimulation } from '../run.js';
import { product } from '../products/index.js';
import type { UserTruth } from '../types.js';

/**
 * The truth file is the simulator's reason to exist: it records who will pay, stall
 * or leave BEFORE the engines see anything, so an engine can be scored against it.
 * These tests check the truth is internally consistent, because a wrong truth file
 * would silently invalidate every score measured from it.
 */
describe('the truth file (brief section 10)', () => {
  const run = runSimulation({ product: 'selfserve', users: 300, seed: 1 });
  const { truth, totals } = run.truthFile;

  const of = (persona: UserTruth['persona']) => truth.filter((t) => t.persona === persona);

  it('records every person', () => {
    expect(truth).toHaveLength(300);
    expect(new Set(truth.map((t) => t.userId)).size).toBe(300);
  });

  it('includes all seven personas', () => {
    const personas = new Set(truth.map((t) => t.persona));
    for (const persona of [
      'converter',
      'staller',
      'intent-then-leaves',
      'payer-gone-quiet',
      'tourist',
      'bot',
      'internal',
    ] as const) {
      expect(personas.has(persona), `no ${persona} in 300 users`).toBe(true);
    }
  });

  it('has every converter signed up, activated and paid', () => {
    const converters = of('converter');
    expect(converters.length).toBeGreaterThan(0);
    for (const person of converters) {
      expect(person.signedUpAt, person.userId).not.toBeNull();
      expect(person.activatedAt, person.userId).not.toBeNull();
      expect(person.paidAt, person.userId).not.toBeNull();
    }
  });

  it('has every staller stuck on a real step and never paying', () => {
    const stallers = of('staller');
    const labels = new Set(product('selfserve').steps.map((s) => s.label));
    expect(stallers.length).toBeGreaterThan(0);
    for (const person of stallers) {
      expect(person.stalledAtStep, person.userId).not.toBeNull();
      expect(labels.has(person.stalledAtStep!), `"${person.stalledAtStep}" is not a step`).toBe(
        true,
      );
      expect(person.expectStallLeak).toBe(true);
      expect(person.paidAt).toBeNull();
    }
  });

  it('has every intent-then-leaves person flagged high intent and unpaid', () => {
    const leavers = of('intent-then-leaves');
    expect(leavers.length).toBeGreaterThan(0);
    for (const person of leavers) {
      expect(person.expectHighIntent, person.userId).toBe(true);
      expect(person.paidAt, person.userId).toBeNull();
      // They got far enough to be worth chasing, which is the whole point of them.
      expect(person.activatedAt, person.userId).not.toBeNull();
    }
  });

  it('has every payer-gone-quiet person paid, with a long tail of activity', () => {
    const payers = of('payer-gone-quiet');
    expect(payers.length).toBeGreaterThan(0);
    for (const person of payers) {
      expect(person.paidAt, person.userId).not.toBeNull();
      // Six weeks of history: four of baseline, two of the decline.
      const span = new Date(person.lastEventAt!).getTime() - new Date(person.signedUpAt!).getTime();
      expect(span / 86400_000, person.userId).toBeGreaterThan(28);
    }
  });

  it('marks bots and internal users as the ones that should disappear', () => {
    for (const person of [...of('bot'), ...of('internal')]) {
      expect(person.expectFiltered, person.userId).toBe(true);
    }
    for (const person of [...of('converter'), ...of('staller')]) {
      expect(person.expectFiltered, person.userId).toBe(false);
    }
  });

  it('gives tourists a disposable address, which costs 20 intent points', () => {
    for (const person of of('tourist')) {
      expect(person.email).toMatch(/mailinator\.com|yopmail\.com|10minutemail\.com/);
    }
  });

  it('agrees with its own totals', () => {
    expect(totals.signedUp).toBe(truth.filter((t) => t.signedUpAt && !t.expectFiltered).length);
    expect(totals.paid).toBe(truth.filter((t) => t.paidAt && !t.expectFiltered).length);
    expect(totals.stalled).toBe(truth.filter((t) => t.expectStallLeak && !t.expectFiltered).length);
    expect(totals.events).toBe(run.messages.length);
  });

  it('is a funnel that actually leaks, or there would be nothing to find', () => {
    expect(totals.signedUp).toBeGreaterThan(100);
    expect(totals.paid).toBeLessThan(totals.activated);
    expect(totals.stalled).toBeGreaterThan(20);
    expect(totals.highIntentNoPay).toBeGreaterThan(20);
  });

  it('records the product’s own facts, so engines can be configured from it', () => {
    expect(run.truthFile.steps).toEqual(product('selfserve').steps);
    expect(run.truthFile.paidEvent).toBe('Subscription Started');
    expect(run.truthFile.listPriceAmount).toBe(1900);
    expect(run.truthFile.trialDays).toBe(14);
  });
});

describe('the other two products', () => {
  it('gives the B2B tool accounts and invites', () => {
    const run = runSimulation({ product: 'b2b', users: 120, seed: 2 });
    expect(run.truthFile.truth.every((t) => t.accountId !== null)).toBe(true);
    const invites = run.messages.filter(
      (m) => m.message.type === 'track' && m.message.event === 'Invite Sent',
    );
    expect(invites.length).toBeGreaterThan(0);
    const groups = run.messages.filter((m) => m.message.type === 'group');
    expect(groups.length).toBeGreaterThan(0);
  });

  it('gives the developer tool plan limits and no trial', () => {
    const run = runSimulation({ product: 'devtool', users: 120, seed: 3 });
    expect(run.truthFile.trialDays).toBeNull();
    const limits = run.messages.filter(
      (m) => m.message.type === 'track' && m.message.event === 'Plan Limit Reached',
    );
    expect(limits.length).toBeGreaterThan(0);
    const trials = run.messages.filter(
      (m) => m.message.type === 'track' && m.message.event === 'Trial Started',
    );
    expect(trials).toHaveLength(0);
  });

  it('sends each product’s core action under the founder’s OWN name', () => {
    // This is what the event dictionary and the Inbox exist for: a product whose
    // names are already canonical would never exercise the mapping (brief section 7).
    for (const [key, expected] of [
      ['selfserve', 'Invoice Sent'],
      ['b2b', 'Board Created'],
      ['devtool', 'Webhook Delivered'],
    ] as const) {
      const run = runSimulation({ product: key, users: 60, seed: 4 });
      const own = run.messages.filter(
        (m) => m.message.type === 'track' && m.message.event === expected,
      );
      expect(own.length, `${key} never sent "${expected}"`).toBeGreaterThan(0);
      const canonical = run.messages.filter(
        (m) => m.message.type === 'track' && m.message.event === 'Core Action',
      );
      expect(canonical, `${key} sent the canonical name instead of its own`).toHaveLength(0);
    }
  });
});
