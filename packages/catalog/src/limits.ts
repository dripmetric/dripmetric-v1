/**
 * Ingest limits (brief section 5). Named constants with their section, because the
 * brief's numbers must survive a context compaction (CLAUDE.md rule 11).
 */

/** Per message. Over this, that one message errors; the rest of the batch still lands. */
export const MAX_MESSAGE_BYTES = 32 * 1024;

/** Per batch body. Over this the whole request is refused with 413. */
export const MAX_BATCH_BYTES = 500 * 1024;

/** A batch may not carry more messages than this, whatever its size. */
export const MAX_BATCH_MESSAGES = 1000;

/**
 * Never trust the client (brief section 5). A timestamp more than this far in the
 * future is a wrong device clock or a forgery, and is rejected.
 */
export const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

/** Caps on property and trait objects, so one message cannot carry a document. */
export const MAX_PROPERTY_KEYS = 64;
export const MAX_PROPERTY_DEPTH = 5;
export const MAX_STRING_VALUE_CHARS = 1024;

/**
 * An event is "late" when it reaches us more than an hour after it happened.
 * Late events are accepted and flagged; they never corrupt step state, because
 * `user_step_state` keeps the earliest entered and earliest completed time.
 */
export const LATE_EVENT_THRESHOLD_MS = 60 * 60 * 1000;

/**
 * Volume guard (brief section 4). Past this many rows per user, per event type, per
 * day, we count instead of storing, so a `track()` call stuck in a loop cannot fill
 * the database. Configurable per project.
 */
export const DEFAULT_DAILY_ROWS_PER_USER_PER_EVENT = 200;

/** A new session starts after this much idle time (brief section 6). */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

/** Rate limit: a token bucket per key, stored in Postgres to start (brief section 5). */
export const DEFAULT_RATE_LIMIT_BURST = 2000;
export const DEFAULT_RATE_LIMIT_PER_SECOND = 200;

/** Retention windows (brief, settled decision 4). Daily summaries are kept forever. */
export const RETENTION_DAYS_FREE = 90;
export const RETENTION_DAYS_PAID = 13 * 30; // 13 months
