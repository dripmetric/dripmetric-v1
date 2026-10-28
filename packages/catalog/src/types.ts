/**
 * Shared vocabulary for the event catalog (brief Appendix A).
 *
 * Nothing here knows about the database or about HTTP. The catalog is typed data plus
 * Zod schemas, and it is the single source of truth the rest of the system reads:
 * the ingest pipeline, the engines, the setup flow and the coverage checklist all
 * import from here rather than writing an event name as a string literal.
 */

/** How an event reaches us. Brief Appendix A, "How it arrives". */
export const ARRIVALS = ['auto', 'rule', 'line', 'billing', 'derived'] as const;
export type Arrival = (typeof ARRIVALS)[number];

/** Which section of Appendix A an item came from. Used by the catalog count test. */
export const SECTIONS = [
  'context',
  'traits',
  'visits',
  'onboarding',
  'value',
  'team',
  'intent',
  'revenue',
  'friction',
  'segment-compat',
  'computed',
] as const;
export type Section = (typeof SECTIONS)[number];

/**
 * The tracking-health coverage checklist (brief Appendix B).
 * `must` events unlock the funnel, step timing, context, every leak and
 * "intent but didn't pay"; `should` unlock stalls, depth, the upgrade moment and
 * accounts; `could` unlock the "why" behind leaks and scores.
 */
export const PRIORITIES = ['must', 'should', 'could'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Where an event may enter the system from. Brief section 5. */
export const SOURCES = [
  'browser',
  'server',
  'segment',
  'rudderstack',
  'posthog',
  'billing',
] as const;
export type Source = (typeof SOURCES)[number];

export interface CatalogEvent {
  /** The canonical name, exactly as founders and adapters must send it. */
  readonly name: string;
  readonly section: Section;
  readonly arrival: Arrival;
  /** Property keys we read. Extra properties are stored but nothing depends on them. */
  readonly properties: readonly string[];
  /** Why we collect it. Brief Appendix A: anything without a job is not collected. */
  readonly job: string;
  /** Coverage-checklist priority, when the event is on the checklist at all. */
  readonly priority?: Priority;
  /**
   * True when the event is only meaningful from a secret key. Billing events and
   * server-only facts can never be set by a browser (brief section 5).
   */
  readonly serverOnly?: true;
}

export interface ContextField {
  readonly key: string;
  readonly howCaptured: string;
  readonly job: string;
  /** Stored once per session rather than on every event. Brief section 4, volume guards. */
  readonly perSession: boolean;
}

export interface CatalogTrait {
  readonly key: string;
  readonly expectation: 'always' | 'recommended' | 'conditional' | 'optional';
  readonly job: string;
  /** Accepted only from a secret key. Brief section 5. */
  readonly serverOnly?: true;
  /** Set by `group()` rather than `identify()`. */
  readonly scope: 'user' | 'account';
}

export interface ComputedSignal {
  readonly key: string;
  readonly job: string;
  /** False for the signals the brief defers until calibration (brief Appendix A, J). */
  readonly neededNow: boolean;
}
