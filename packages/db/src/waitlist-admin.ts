import type pg from 'pg';
import { forwardToAutomation, type AutomationTarget, type WaitlistDelivery } from './waitlist.js';

/**
 * The waitlist as its owner sees it: export and backlog. Used by `pnpm waitlist:export`
 * and `pnpm waitlist:forward` over ADMIN_DATABASE_URL, and exported from
 * `@dripmetric/db/admin` only, because the site role cannot read the list and the
 * request path must not be able to.
 */

type Client = pg.Client | pg.PoolClient;

interface Row {
  id: string;
  email: string;
  source: string;
  created_at: Date;
  forwarded_at: Date | null;
}

/** Addresses not yet handed to the automation. */
export async function countPendingWaitlist(client: Client): Promise<number> {
  const { rows } = await client.query<{ n: string }>(
    'SELECT count(*) AS n FROM waitlist WHERE forwarded_at IS NULL',
  );
  return Number(rows[0]?.n ?? 0);
}

export interface ForwardResult {
  sent: number;
  failed: number;
}

/**
 * Sends every waiting address, oldest first, one at a time, and marks each one that
 * the automation accepted. A failure is counted and left waiting; the run carries on,
 * and the next run picks it up again.
 */
export async function forwardPendingWaitlist(
  client: Client,
  target: AutomationTarget,
  { now, fetchImpl, batchSize = 100 }: { now: Date; fetchImpl?: typeof fetch; batchSize?: number },
): Promise<ForwardResult> {
  const result: ForwardResult = { sent: 0, failed: 0 };
  let after = 0;
  for (;;) {
    const { rows } = await client.query<Row>(
      `SELECT id, email, source, created_at, forwarded_at
         FROM waitlist
        WHERE forwarded_at IS NULL AND id > $1
        ORDER BY id
        LIMIT $2`,
      [after, batchSize],
    );
    if (rows.length === 0) return result;
    for (const row of rows) {
      after = Number(row.id);
      const delivery: WaitlistDelivery = {
        id: after,
        email: row.email,
        source: row.source,
        joinedAt: row.created_at,
      };
      const ok = await forwardToAutomation(delivery, target, {
        now,
        ...(fetchImpl ? { fetchImpl } : {}),
      });
      if (!ok) {
        result.failed += 1;
        continue;
      }
      await client.query(
        'UPDATE waitlist SET forwarded_at = $2 WHERE id = $1 AND forwarded_at IS NULL',
        [after, now],
      );
      result.sent += 1;
    }
  }
}

/**
 * One CSV cell. Quoted when it must be, and a leading = + - @ is defused with an
 * apostrophe, because a spreadsheet would otherwise run it as a formula and an email
 * address is visitor-typed text (OWASP, "CSV injection").
 */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Every address, oldest first, as CSV with a header row. */
export async function exportWaitlistCsv(client: Client): Promise<{ csv: string; rows: number }> {
  const { rows } = await client.query<Row>(
    'SELECT id, email, source, created_at, forwarded_at FROM waitlist ORDER BY id',
  );
  const lines = ['id,email,source,joined_at,forwarded_at'];
  for (const row of rows) {
    lines.push(
      [
        String(row.id),
        cell(row.email),
        cell(row.source),
        row.created_at.toISOString(),
        row.forwarded_at ? row.forwarded_at.toISOString() : '',
      ].join(','),
    );
  }
  return { csv: `${lines.join('\r\n')}\r\n`, rows: rows.length };
}
