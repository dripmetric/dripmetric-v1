import { describe, expect, it } from 'vitest';
import {
  CATALOG_EVENTS,
  CATALOG_EVENTS_BY_NAME,
  CATALOG_TRAITS,
  CANONICAL_MEANINGS,
  COMPUTED_SIGNALS,
  CONTEXT_FIELDS,
  PAID_EVENT,
  SERVER_ONLY_EVENT_NAMES,
  SERVER_ONLY_TRAITS,
  meaningsAreCatalogEvents,
  Message,
  BatchBody,
} from '../index.js';

/**
 * M0 exit check: "a test counts every event name from Appendix A in the catalog package."
 *
 * These counts come straight from the settled Event catalog (brief Appendix A, settled
 * 8 Oct 2026). If one of them changes, the catalog drifted from the settled decision and
 * this test is the alarm, not a number to update quietly.
 */
describe('event catalog (brief Appendix A)', () => {
  const countBySection = (section: string) =>
    CATALOG_EVENTS.filter((e) => e.section === section).length;

  it('holds exactly the settled number of events in each section', () => {
    expect(countBySection('visits')).toBe(3); // C. Visits and sessions
    expect(countBySection('onboarding')).toBe(12); // D. Signup, onboarding and activation
    expect(countBySection('value')).toBe(10); // E. Value and depth
    expect(countBySection('team')).toBe(4); // F. Team and collaboration
    expect(countBySection('intent')).toBe(15); // G. Buying intent
    expect(countBySection('revenue')).toBe(18); // H. Revenue: "18 events"
    expect(countBySection('friction')).toBe(12); // I. Friction and risk
    expect(countBySection('segment-compat')).toBe(2); // Signed Out, Account Deleted
    expect(CATALOG_EVENTS).toHaveLength(76);
  });

  it('adds up to the "over 100 signals" the catalog promises', () => {
    // 76 events + 18 context fields + 20 computed signals = 114.
    expect(CONTEXT_FIELDS).toHaveLength(18);
    expect(COMPUTED_SIGNALS).toHaveLength(20);
    expect(CATALOG_EVENTS.length + CONTEXT_FIELDS.length + COMPUTED_SIGNALS.length).toBe(114);
  });

  it('names every event exactly once', () => {
    const names = CATALOG_EVENTS.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    expect(CATALOG_EVENTS_BY_NAME.size).toBe(names.length);
  });

  it('gives every event a job: anything without one is not collected', () => {
    for (const event of CATALOG_EVENTS) {
      expect(event.job.length, `${event.name} has no job`).toBeGreaterThan(10);
    }
  });

  it('spells the names the way founders and adapters must send them', () => {
    // Spot-checks against the brief's own text, including the ones easiest to get wrong.
    for (const name of [
      'Page Viewed',
      'Page Left',
      'Signed Up',
      'Activated',
      'Core Action',
      'Plan Limit Reached',
      'Pricing Viewed',
      'Checkout Started',
      'Subscription Started',
      'Subscription Cancelled', // British spelling, as settled
      'Payment Failed',
      'Invite Sent',
      'Account Added User', // Segment B2B spec order
      'Integration Connected',
      'Data Imported',
      'Trial Ending Soon',
      'Card Expiring Soon',
    ]) {
      expect(CATALOG_EVENTS_BY_NAME.has(name), `missing ${name}`).toBe(true);
    }
  });

  it('marks the paid event and finds it in the catalog', () => {
    expect(PAID_EVENT).toBe('Subscription Started');
    expect(CATALOG_EVENTS_BY_NAME.has(PAID_EVENT)).toBe(true);
  });

  it('keeps every revenue event server-only, so a browser cannot forge a payment', () => {
    for (const event of CATALOG_EVENTS.filter((e) => e.section === 'revenue')) {
      expect(SERVER_ONLY_EVENT_NAMES.has(event.name), `${event.name} must be server-only`).toBe(true);
    }
    // Plus the three billing-backed events that live in section G: 18 + 3 = the
    // "21 billing events" of brief section 2.
    expect(SERVER_ONLY_EVENT_NAMES.size).toBe(21);
    for (const name of ['Checkout Payment Declined', 'Payment Method Added', 'Checkout Abandoned']) {
      expect(SERVER_ONLY_EVENT_NAMES.has(name)).toBe(true);
    }
  });

  it('keeps stripeCustomerId server-only', () => {
    expect(SERVER_ONLY_TRAITS.has('stripeCustomerId')).toBe(true);
  });

  it('has a coverage checklist that matches brief Appendix B', () => {
    const must = CATALOG_EVENTS.filter((e) => e.priority === 'must').map((e) => e.name).sort();
    expect(must).toEqual(
      [
        'Activated',
        'Checkout Started',
        'Page Left',
        'Page Viewed',
        'Signed Up',
        'Subscription Started',
      ].sort(),
    );
  });
});

describe('canonical meanings (brief section 7)', () => {
  it('is the dozen meanings the engines depend on, and every one is a catalog event', () => {
    expect(CANONICAL_MEANINGS).toHaveLength(13); // "about a dozen"
    expect(meaningsAreCatalogEvents()).toBe(true);
  });
});

describe('traits (brief Appendix A, section B)', () => {
  it('has both user and account traits', () => {
    expect(CATALOG_TRAITS.some((t) => t.scope === 'user')).toBe(true);
    expect(CATALOG_TRAITS.some((t) => t.scope === 'account')).toBe(true);
  });
});

describe('message schemas (brief section 5)', () => {
  it('accepts a Segment-shaped track message', () => {
    const parsed = Message.safeParse({
      type: 'track',
      messageId: '0192b3a4-5c6d-7e8f-9a0b-1c2d3e4f5a6b',
      userId: 'user_123',
      event: 'Checkout Started',
      properties: { plan: 'pro', amount: 2900, currency: 'usd' },
      timestamp: '2026-09-29T10:15:00Z',
    });
    expect(parsed.success).toBe(true);
  });

  it('strips unknown fields rather than erroring on them', () => {
    const parsed = Message.parse({
      type: 'track',
      messageId: 'm1',
      userId: 'u1',
      event: 'Activated',
      somethingSegmentAdded: { deep: true },
    });
    expect(parsed).not.toHaveProperty('somethingSegmentAdded');
  });

  it('accepts screen and alias instead of erroring, so a Segment source does not break', () => {
    expect(Message.safeParse({ type: 'screen', messageId: 'm2', userId: 'u1' }).success).toBe(true);
  });

  it('rejects a message with no messageId: retries would then double-count', () => {
    expect(Message.safeParse({ type: 'track', userId: 'u1', event: 'Activated' }).success).toBe(false);
  });

  it('accepts a batch body with the write key inside, the way a beacon sends it', () => {
    const parsed = BatchBody.safeParse({
      batch: [{ type: 'page', messageId: 'm3', anonymousId: 'a1' }],
      writeKey: 'pk_test_abc',
      sentAt: '2026-09-29T10:15:01Z',
    });
    expect(parsed.success).toBe(true);
  });
});
