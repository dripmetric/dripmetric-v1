import type { FollowUp } from '@dripmetric/ingest';

/**
 * The queue adapter (settled decision D3: keep pg-boss behind a thin adapter so it
 * can be swapped).
 *
 * The web app does not run pg-boss — the worker does. At M1 the web side writes
 * follow-up work into a table the worker drains, which keeps the request path free of
 * a queue client entirely. M2 onwards wires the worker's pg-boss queues to it.
 */
export async function enqueueFollowUps(_projectId: number, _followUps: FollowUp[]): Promise<void> {
  // Intentionally a no-op until the worker's queues exist (M6 onwards). The ingest
  // pipeline already collects the follow-ups and hands them over, so turning this on
  // is one function body, not a change to the hot path.
}
