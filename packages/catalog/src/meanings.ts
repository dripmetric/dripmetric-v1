import { CATALOG_EVENTS_BY_NAME } from './events.js';

/**
 * The dozen meanings founders map their own event names onto (brief section 7).
 * The engines depend on exactly these. Founders cannot invent new meanings: an event
 * is mapped to one of these, or ignored, or left custom in the Inbox where it counts
 * toward nothing.
 *
 * Each meaning appears in the UI under the founder's own name for it (their
 * "Created first board" is shown wherever Activated is meant); the canonical name
 * stays internal.
 */
export const CANONICAL_MEANINGS = [
  'Signed Up',
  'Onboarding Step Completed',
  'Activated',
  'Core Action',
  'Pricing Viewed',
  'Plan Limit Reached',
  'Checkout Started',
  'Subscription Started',
  'Subscription Cancelled',
  'Payment Failed',
  'Invite Sent',
  'Integration Connected',
  'Data Imported',
] as const;

export type CanonicalMeaning = (typeof CANONICAL_MEANINGS)[number];

export const CANONICAL_MEANING_SET: ReadonlySet<string> = new Set(CANONICAL_MEANINGS);

export function isCanonicalMeaning(name: string): name is CanonicalMeaning {
  return CANONICAL_MEANING_SET.has(name);
}

/** Every mappable meaning must also be a catalog event; the test below is the guard. */
export function meaningsAreCatalogEvents(): boolean {
  return CANONICAL_MEANINGS.every((m) => CATALOG_EVENTS_BY_NAME.has(m));
}

/** The status of a raw event name in a project's dictionary (brief section 4, `event_names`). */
export const EVENT_NAME_STATUSES = ['unmapped', 'suggested', 'confirmed', 'ignored'] as const;
export type EventNameStatus = (typeof EVENT_NAME_STATUSES)[number];

/** AI suggestion confidence (brief section 7). */
export const SUGGESTION_CONFIDENCES = ['high', 'medium', 'low'] as const;
export type SuggestionConfidence = (typeof SUGGESTION_CONFIDENCES)[number];
