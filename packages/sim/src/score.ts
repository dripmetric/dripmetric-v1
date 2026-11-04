import type { ScopedDb } from '@dripmetric/db';
import type { TruthFile } from './types.js';

/**
 * Scoring against truth (brief section 10).
 *
 * "What share of stalled users did leak detection catch, and what share of users who
 * left with intent did the score flag? Print both. Aim for at least 90% on the
 * simulator and explain any shortfall."
 *
 * The engines that produce those two numbers land at M7 and M8. What CAN be scored
 * today is whether ingest put the right people and events in the database at all,
 * which is the floor every later score stands on: a stall the pipeline never
 * recorded cannot be caught by any rule.
 */

export interface IngestScore {
  /** People the truth file says should have been filtered out entirely. */
  shouldBeFiltered: number;
  /** How many of those left no trace. 100% is the only acceptable answer. */
  actuallyFiltered: number;
  /** People who signed up and are not filtered. */
  shouldBeTracked: number;
  /** How many of those we can find. */
  actuallyTracked: number;
  /** People the truth says paid. */
  shouldHavePaid: number;
  actuallyPaid: number;
  /** People the truth says stalled: the population M8's leak engine is scored on. */
  shouldHaveStalled: number;
  /** How many of those have a step entered and not completed, which is the raw
   *  material the stall rule reads. */
  stallDetectable: number;
  /** People the truth says reached high intent and did not pay: M7's population. */
  shouldBeHighIntent: number;
  /** How many of those have the signals the score needs. */
  highIntentDetectable: number;
}

export async function scoreIngest(db: ScopedDb, truthFile: TruthFile): Promise<IngestScore> {
  const notFiltered = truthFile.truth.filter((t) => !t.expectFiltered);
  const filtered = truthFile.truth.filter((t) => t.expectFiltered);

  const present = new Set(
    (
      await db.query<{ external_id: string }>(
        `SELECT external_id FROM end_users WHERE project_id = $1 AND internal = false`,
        [db.projectId],
      )
    ).map((r) => r.external_id),
  );

  // Someone who should be filtered counts as filtered when they have no events
  // attributed to them, whether because they never became a user or because the
  // internal flag keeps them out.
  const withEvents = new Set(
    (
      await db.query<{ external_id: string }>(
        `SELECT DISTINCT u.external_id
           FROM events e
           JOIN end_users u ON u.project_id = e.project_id AND u.user_key = e.user_key
          WHERE e.project_id = $1`,
        [db.projectId],
      )
    ).map((r) => r.external_id),
  );

  const paid = new Set(
    (
      await db.query<{ external_id: string }>(
        `SELECT DISTINCT u.external_id
           FROM events e
           JOIN end_users u ON u.project_id = e.project_id AND u.user_key = e.user_key
           JOIN event_names n ON n.project_id = e.project_id AND n.id = e.name_id
          WHERE e.project_id = $1 AND n.canonical = $2`,
        [db.projectId, truthFile.paidEvent],
      )
    ).map((r) => r.external_id),
  );

  // The raw material for the stall rule: a step entered and never completed.
  const stuck = new Set(
    (
      await db.query<{ external_id: string }>(
        `SELECT DISTINCT u.external_id
           FROM user_step_state s
           JOIN end_users u ON u.project_id = s.project_id AND u.user_key = s.user_key
          WHERE s.project_id = $1 AND s.first_entered_at IS NOT NULL AND s.first_completed_at IS NULL`,
        [db.projectId],
      )
    ).map((r) => r.external_id),
  );

  // The raw material for the intent score: any of the signals that carry points.
  const withIntentSignals = new Set(
    (
      await db.query<{ external_id: string }>(
        `SELECT DISTINCT u.external_id
           FROM events e
           JOIN end_users u ON u.project_id = e.project_id AND u.user_key = e.user_key
           JOIN event_names n ON n.project_id = e.project_id AND n.id = e.name_id
          WHERE e.project_id = $1
            AND n.canonical = ANY($2)`,
        [
          db.projectId,
          ['Activated', 'Pricing Viewed', 'Checkout Started', 'Plan Limit Reached', 'Invite Sent'],
        ],
      )
    ).map((r) => r.external_id),
  );

  const shouldStall = notFiltered.filter((t) => t.expectStallLeak);
  const shouldIntend = notFiltered.filter((t) => t.expectHighIntent && t.paidAt === null);

  return {
    shouldBeFiltered: filtered.length,
    actuallyFiltered: filtered.filter((t) => !withEvents.has(t.userId)).length,
    shouldBeTracked: notFiltered.filter((t) => t.signedUpAt !== null).length,
    actuallyTracked: notFiltered.filter((t) => t.signedUpAt !== null && present.has(t.userId))
      .length,
    shouldHavePaid: notFiltered.filter((t) => t.paidAt !== null).length,
    actuallyPaid: notFiltered.filter((t) => t.paidAt !== null && paid.has(t.userId)).length,
    shouldHaveStalled: shouldStall.length,
    stallDetectable: shouldStall.filter((t) => stuck.has(t.userId)).length,
    shouldBeHighIntent: shouldIntend.length,
    highIntentDetectable: shouldIntend.filter((t) => withIntentSignals.has(t.userId)).length,
  };
}

/** A share as a percentage, with 0/0 counting as 100: nothing to find, nothing missed. */
export function share(found: number, expected: number): number {
  if (expected === 0) return 100;
  return Math.round((found / expected) * 1000) / 10;
}

export function formatScore(score: IngestScore): string {
  const line = (label: string, found: number, expected: number) =>
    `  ${label.padEnd(34)} ${String(found).padStart(4)} / ${String(expected).padEnd(4)}  ${share(found, expected).toFixed(1)}%`;

  return [
    'scored against the truth file:',
    line('filtered as intended', score.actuallyFiltered, score.shouldBeFiltered),
    line('signed-up users tracked', score.actuallyTracked, score.shouldBeTracked),
    line('payments recorded', score.actuallyPaid, score.shouldHavePaid),
    line('stalls visible to the leak rule', score.stallDetectable, score.shouldHaveStalled),
    line('intent signals present', score.highIntentDetectable, score.shouldBeHighIntent),
  ].join('\n');
}
