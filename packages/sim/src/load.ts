import { MAX_BATCH_MESSAGES } from '@dripmetric/catalog';
import { deliveredAt } from './faults.js';
import type { SimMessage } from './types.js';

/**
 * Loads a run through the real HTTP API (brief M2 exit check: "loads events through
 * the HTTP API").
 *
 * Through HTTP on purpose, not straight into the database. The whole point is to
 * exercise the pipeline a founder's traffic goes through: authentication, the rate
 * limit, validation, dedupe, the filters, enrichment, identity, the batched writes.
 * Seeding the tables directly would test the engines against data no ingest ever
 * produced.
 */

export interface LoadOptions {
  host: string;
  /** Browser-ish messages go through the publishable key. */
  publishableKey: string;
  /** Server and billing events need the secret key (brief section 5). */
  secretKey: string;
  /** Messages per request. The API accepts up to MAX_BATCH_MESSAGES. */
  batchSize?: number;
  /** Called after each batch, for the CLI's progress line. */
  onProgress?: (sent: number, total: number) => void;
  /** Keeps a burst inside the rate limit without making the run take all day. */
  pauseMs?: number;
}

export interface LoadResult {
  sent: number;
  accepted: number;
  duplicates: number;
  filtered: number;
  errors: { code: string; count: number }[];
  /** 429s we backed off from, so a rate-limited run is visible rather than silent. */
  rateLimited: number;
  elapsedMs: number;
}

interface ApiResult {
  messageId: string;
  status: 'ok' | 'duplicate' | 'error' | 'filtered';
  code: string;
}

export async function loadThroughApi(
  messages: readonly SimMessage[],
  options: LoadOptions,
): Promise<LoadResult> {
  const batchSize = Math.min(options.batchSize ?? 200, MAX_BATCH_MESSAGES);
  const started = Date.now();

  const result: LoadResult = {
    sent: 0,
    accepted: 0,
    duplicates: 0,
    filtered: 0,
    errors: [],
    rateLimited: 0,
    elapsedMs: 0,
  };
  const errorCounts = new Map<string, number>();

  // Server-side and browser-side messages need different keys, so they are sent as
  // separate runs of consecutive messages rather than mixed into one batch.
  for (const group of groupByKey(messages, batchSize)) {
    const body = JSON.stringify({
      batch: group.messages.map((m) => m.message),
      // The latest delivery time in the batch: what a real client's clock would say.
      sentAt: group.messages
        .reduce((latest, m) => (deliveredAt(m) > latest ? deliveredAt(m) : latest), new Date(0))
        .toISOString(),
    });

    const key = group.serverSide ? options.secretKey : options.publishableKey;
    const response = await postWithRetry(`${options.host}/v1/batch`, body, key);

    result.sent += group.messages.length;

    if (response.status === 429) {
      result.rateLimited += 1;
      continue;
    }

    if (!response.ok) {
      errorCounts.set(
        `http_${response.status}`,
        (errorCounts.get(`http_${response.status}`) ?? 0) + group.messages.length,
      );
      continue;
    }

    for (const item of response.results) {
      if (item.status === 'ok') result.accepted += 1;
      else if (item.status === 'duplicate') result.duplicates += 1;
      else if (item.status === 'filtered') result.filtered += 1;
      else errorCounts.set(item.code, (errorCounts.get(item.code) ?? 0) + 1);
    }

    options.onProgress?.(result.sent, messages.length);
    if (options.pauseMs) await sleep(options.pauseMs);
  }

  result.errors = [...errorCounts]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
  result.elapsedMs = Date.now() - started;
  return result;
}

interface PostResponse {
  ok: boolean;
  status: number;
  results: ApiResult[];
}

/**
 * Posts one batch, backing off on a 429 the way the SDKs do. The simulator is
 * deliberately allowed to hit the rate limit — the `burst` fault is supposed to —
 * so it has to behave like a well-mannered client when it does.
 */
async function postWithRetry(url: string, body: string, key: string): Promise<PostResponse> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body,
    });

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after') ?? '1');
      if (attempt === 3) return { ok: false, status: 429, results: [] };
      await sleep(Math.min(retryAfter, 10) * 1000);
      continue;
    }

    if (!response.ok) return { ok: false, status: response.status, results: [] };

    const parsed = (await response.json()) as { results?: ApiResult[] };
    return { ok: true, status: response.status, results: parsed.results ?? [] };
  }
  return { ok: false, status: 429, results: [] };
}

interface KeyGroup {
  serverSide: boolean;
  messages: SimMessage[];
}

/**
 * Splits the stream into consecutive runs that share a key, then chunks each run.
 * Order within a key is preserved, which matters: an identify() must reach us before
 * the events that depend on its traits.
 */
function groupByKey(messages: readonly SimMessage[], batchSize: number): KeyGroup[] {
  const groups: KeyGroup[] = [];
  let current: KeyGroup | null = null;

  for (const message of messages) {
    if (
      !current ||
      current.serverSide !== message.serverSide ||
      current.messages.length >= batchSize
    ) {
      current = { serverSide: message.serverSide, messages: [] };
      groups.push(current);
    }
    current.messages.push(message);
  }
  return groups;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
