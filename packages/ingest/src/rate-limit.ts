import { DEFAULT_RATE_LIMIT_BURST, DEFAULT_RATE_LIMIT_PER_SECOND } from '@dripmetric/catalog';
import type { UnscopedDb } from '@dripmetric/db';

/**
 * A token bucket per API key, kept in Postgres (brief section 5).
 *
 * Postgres is the obvious wrong answer for a rate limiter and the right one for us
 * right now: it is already there, it survives a restart, and at our volume two small
 * statements cost less than running Redis would. Both statements run inside the
 * caller's transaction, and the upsert locks the row for the rest of it, so two
 * concurrent batches cannot both spend the last token.
 */

export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds until enough tokens exist again, for the `Retry-After` header. */
  retryAfterSeconds: number;
  remaining: number;
}

export interface RateLimitOptions {
  burst?: number;
  perSecond?: number;
}

export async function consumeTokens(
  db: UnscopedDb,
  apiKeyId: string,
  projectId: number,
  cost: number,
  now: Date,
  options: RateLimitOptions = {},
): Promise<RateLimitDecision> {
  const burst = options.burst ?? DEFAULT_RATE_LIMIT_BURST;
  const perSecond = options.perSecond ?? DEFAULT_RATE_LIMIT_PER_SECOND;

  // Refill by however long it has been, capped at the burst. A new bucket starts
  // full, so a founder's very first batch is never refused.
  const refilled = await db.one<{ tokens: string }>(
    `INSERT INTO rate_buckets (api_key_id, project_id, tokens, updated_at)
          VALUES ($1, $2, $3::float8, $4::timestamptz)
     ON CONFLICT (api_key_id) DO UPDATE
            SET tokens = LEAST(
                  $3::float8,
                  rate_buckets.tokens
                    + EXTRACT(EPOCH FROM ($4::timestamptz - rate_buckets.updated_at)) * $5::float8
                ),
                updated_at = $4::timestamptz
       RETURNING tokens`,
    [apiKeyId, projectId, burst, now, perSecond],
  );

  const available = Number(refilled.tokens);
  if (available < cost) {
    return {
      allowed: false,
      remaining: Math.max(0, Math.floor(available)),
      // How long until the shortfall has refilled.
      retryAfterSeconds: Math.max(1, Math.ceil((cost - available) / perSecond)),
    };
  }

  // The row is already locked by the upsert above, so this cannot race.
  const spent = await db.one<{ tokens: string }>(
    `UPDATE rate_buckets SET tokens = tokens - $2::float8
      WHERE api_key_id = $1
      RETURNING tokens`,
    [apiKeyId, cost],
  );

  return {
    allowed: true,
    remaining: Math.max(0, Math.floor(Number(spent.tokens))),
    retryAfterSeconds: 0,
  };
}
