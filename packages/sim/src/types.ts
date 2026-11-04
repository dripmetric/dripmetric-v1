import type { MessageInput } from '@dripmetric/catalog';

/**
 * The simulator's own vocabulary (brief section 10).
 *
 * The point of the whole package is the TRUTH FILE: it stores each user's real
 * outcome beside their events, so an engine can be scored rather than eyeballed.
 * "Did leak detection catch this stall?" is only answerable because something
 * recorded that the stall was deliberate.
 */

/** The three dummy products (brief section 10). */
export type ProductKey = 'selfserve' | 'b2b' | 'devtool';

/**
 * Who a simulated person is. The first four are the brief's own list; the last three
 * exist to prove the filters work rather than to be measured.
 */
export type PersonaKey =
  /** Sails through and pays. */
  | 'converter'
  /** Stalls at step 2 and never finishes. */
  | 'staller'
  /** Shows high intent, then leaves without paying. */
  | 'intent-then-leaves'
  /** Pays, then goes quiet. */
  | 'payer-gone-quiet'
  /** A tourist on a disposable address: should score low and never alert. */
  | 'tourist'
  /** A crawler: should be dropped at ingest. */
  | 'bot'
  /** The founder's own team: should be filtered out of every number. */
  | 'internal';

/** What actually happened to this person, recorded as we generate them. */
export interface UserTruth {
  userId: string;
  anonymousId: string;
  persona: PersonaKey;
  product: ProductKey;
  email: string;
  /** null for someone who never signs up. */
  signedUpAt: string | null;
  activatedAt: string | null;
  /** The paid event. null for everyone who never paid. */
  paidAt: string | null;
  /** The step they got stuck on, by label. null if they never stalled. */
  stalledAtStep: string | null;
  /** True when the persona is MEANT to be caught as a stall. */
  expectStallLeak: boolean;
  /** True when the persona is MEANT to reach a high intent score before leaving. */
  expectHighIntent: boolean;
  /** True when the persona is MEANT to be filtered out entirely. */
  expectFiltered: boolean;
  /** Steps completed, in order, by label. */
  stepsCompleted: string[];
  eventCount: number;
  accountId: string | null;
  lastEventAt: string | null;
}

/** Everything one run produces. Written next to the events as JSON. */
export interface TruthFile {
  /** So a reader can tell which run they are looking at. */
  product: ProductKey;
  seed: number;
  users: number;
  generatedAt: string;
  /** The window the run covers in virtual time. */
  startedAt: string;
  endedAt: string;
  /** The funnel the product declares, so the engines can be configured from it. */
  steps: { label: string; eventName: string | null; urlPattern: string | null }[];
  activationEvent: string;
  paidEvent: string;
  listPriceAmount: number;
  listPriceCurrency: string;
  trialDays: number | null;
  /** Every person, with what really happened to them. */
  truth: UserTruth[];
  /** Totals, so a report can be checked at a glance. */
  totals: {
    events: number;
    signedUp: number;
    activated: number;
    paid: number;
    stalled: number;
    highIntentNoPay: number;
    filtered: number;
  };
  /** Which faults were injected, so a surprising number has an explanation. */
  faults: FaultName[];
}

/** Injected faults (brief section 10). Each one is a thing that happens in the wild. */
export const FAULT_NAMES = [
  /** The same message sent twice: a retry that already succeeded. */
  'duplicates',
  /** Events arriving hours after they happened, out of order. */
  'late-events',
  /** A key event stops arriving: tracking broke, users did not vanish. */
  'missing-event',
  /** An event name changes: a deploy renamed it. */
  'renamed-event',
  /** A device clock hours out, so timestamps need correcting. */
  'clock-skew',
  /** A burst at 100 times normal volume. */
  'burst',
] as const;
export type FaultName = (typeof FAULT_NAMES)[number];

/** A message the simulator produced, with the virtual time it happened at. */
export interface SimMessage {
  message: MessageInput;
  at: Date;
  /** Which persona produced it, for debugging a surprising result. */
  persona: PersonaKey;
  /** True when this message must go through a SECRET key (billing, server events). */
  serverSide: boolean;
}

/** A product definition: its funnel, its prices, how its people behave. */
export interface ProductDefinition {
  key: ProductKey;
  name: string;
  description: string;
  steps: { label: string; eventName: string | null; urlPattern: string | null }[];
  activationEvent: string;
  /** Mapped to Core Action. Uses the founder's own name, as a real product would. */
  coreActionName: string;
  listPriceAmount: number;
  listPriceCurrency: string;
  trialDays: number | null;
  /** Team products call group() and send invites. */
  hasAccounts: boolean;
  /** Freemium products hit plan limits instead of running a trial. */
  hasPlanLimits: boolean;
  /** How personas are mixed, by weight. */
  personaMix: { value: PersonaKey; weight: number }[];
}
