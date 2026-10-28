import type { MessageInput, MessageResult, Source } from '@dripmetric/catalog';

/**
 * The ingest pipeline's own types.
 *
 * Nothing here imports Next.js, or anything else framework-shaped: a route handler is
 * a thin adapter over this package, so ingest can move to its own service later
 * (brief section 4). ESLint enforces that.
 */

/** Everything a request carries, flattened by the adapter. */
export interface IngestRequest {
  /** The raw body, read as TEXT. Beacons send `text/plain`, so the content type is
   *  not trusted and the body is parsed here (brief section 5). */
  body: string;
  /** Lower-cased header names. */
  headers: Readonly<Record<string, string | undefined>>;
  /**
   * Set only by the no-code feed adapters (/v1/sources/segment and friends, M12).
   * On /v1/batch it is left out and derived from the key: a publishable key is a
   * browser, a secret key is a server. A billing event narrows it further, per
   * message, in the pipeline.
   */
  source?: Source | undefined;
  /** When the request reached us. Passed in, never read from the clock here, so a
   *  test can place a batch anywhere in time (CLAUDE.md rule 9). */
  receivedAt: Date;
}

export interface IngestResponse {
  status: number;
  /** Already-serialised JSON, so the adapter does no shaping of its own. */
  body: unknown;
  headers?: Record<string, string>;
}

/** A message that has passed validation, with everything the writer needs. */
export interface PreparedMessage {
  input: MessageInput;
  /** The client's own id, echoed back in the result. */
  messageId: string;
  /** The first 16 bytes of sha256(messageId), as a uuid string: the dedupe key. */
  messageHash: string;
  /** Skew-corrected: when it actually happened. */
  occurredAt: Date;
  /** Received more than an hour after it happened. */
  late: boolean;
}

export type { MessageResult, Source };
