/**
 * Every tunable number, with the brief section it came from.
 * CLAUDE.md rule 11: a rule from the brief becomes a named constant, not a memory.
 */

/** The library name and version sent in context, for tracking health. */
export const LIBRARY_NAME = 'dripmetric';
export const LIBRARY_VERSION = '2.0.0';

/** A new session after this much idle time (brief section 6). */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

/** The queue is capped; the oldest drop first (brief section 6, "bounded memory"). */
export const MAX_QUEUED_EVENTS = 1000;

/** Flush when the queue reaches this, or after the interval below. */
export const BATCH_SIZE = 20;
export const FLUSH_INTERVAL_MS = 2000;

/** Short timeouts, so the SDK can never hold up the founder's app. */
export const REQUEST_TIMEOUT_MS = 3000;
export const MAX_RETRIES = 3;
/** After repeated failures, stop trying for a minute (brief section 6). */
export const FAILURE_PAUSE_MS = 60_000;
export const FAILURES_BEFORE_PAUSE = 3;

/**
 * Active time (brief section 6): a second counts as active while the tab is visible
 * AND, in the previous 60 seconds, the page loaded, the tab returned to view, or
 * there was a click, key press, scroll or touch.
 */
export const ACTIVITY_WINDOW_MS = 60_000;
export const ACTIVITY_TICK_MS = 1000;

/** Rage click: three clicks, each within 1 s and 30 px of the previous one. */
export const RAGE_CLICK_COUNT = 3;
export const RAGE_CLICK_WINDOW_MS = 1000;
export const RAGE_CLICK_RADIUS_PX = 30;

/** Dead click: a click followed by no change on the page within this window. */
export const DEAD_CLICK_WINDOW_MS = 800;

/** Slow page: main content over 4 s on a full load, or a click reply over 500 ms. */
export const SLOW_PAGE_MS = 4000;
export const SLOW_INTERACTION_MS = 500;

/** The anonymous id cookie, on the root domain so marketing and app share it. */
export const ANON_COOKIE = 'dm_anon';
/** At most a year (brief section 6). */
export const ANON_COOKIE_DAYS = 365;

/** Where settings (key pages, URL rules) are fetched from, once consent allows. */
export const SETTINGS_PATH = '/v1/settings';
export const BATCH_PATH = '/v1/batch';

/** Campaign parameters are the only query parameters we keep. */
export const CAMPAIGN_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;
