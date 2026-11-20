import { createHmac } from 'node:crypto';
import pg from 'pg';
import { classifyEmailDomain } from './signup-guards.js';
import { connectionOptions } from './tls.js';

/**
 * @dripmetric/db/waitlist: everything the landing page needs from the server side,
 * and nothing else (docs/decisions.md, 2026-11-20).
 *
 * It is its own entry point so the public site never loads the founder app's database
 * surface. It needs no encryption keys and no tenant scope, and it connects as
 * `dripmetric_site` (migration 0013). That role can only call `waitlist_join` and
 * `waitlist_mark_forwarded`; it cannot read the list.
 *
 * Two switches, both OFF unless set exactly, because the founder asked for the waitlist
 * to take nothing until told to:
 *   WAITLIST_INTAKE=open      store addresses. Anything else: answer "closed", store nothing.
 *   WAITLIST_AUTOMATION=on    hand each new address to the welcome-mail automation
 *                             (WAITLIST_AUTOMATION_URL + WAITLIST_AUTOMATION_SECRET).
 *                             Anything else: send nothing. Addresses wait in the table
 *                             with forwarded_at NULL until `pnpm waitlist:forward`.
 */

export type Env = Readonly<Record<string, string | undefined>>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** The secret must be long enough that a guessed signature is not a realistic attack. */
export const AUTOMATION_SECRET_MIN_LENGTH = 32;

export interface AutomationTarget {
  url: string;
  secret: string;
}

export interface WaitlistSettings {
  intake: 'open' | 'closed';
  /** Null means nothing is sent anywhere. */
  automation: AutomationTarget | null;
  /** Set when WAITLIST_AUTOMATION=on but the target is incomplete, so it stays off. */
  automationProblem: string | null;
}

export function waitlistSettings(env: Env): WaitlistSettings {
  const intake = env['WAITLIST_INTAKE']?.trim() === 'open' ? 'open' : 'closed';
  if (env['WAITLIST_AUTOMATION']?.trim() !== 'on') {
    return { intake, automation: null, automationProblem: null };
  }
  const url = env['WAITLIST_AUTOMATION_URL']?.trim() ?? '';
  const secret = env['WAITLIST_AUTOMATION_SECRET']?.trim() ?? '';
  let problem: string | null = null;
  if (!/^https:\/\/\S+$/i.test(url)) problem = 'WAITLIST_AUTOMATION_URL must be an https:// URL';
  else if (secret.length < AUTOMATION_SECRET_MIN_LENGTH)
    problem = `WAITLIST_AUTOMATION_SECRET must be at least ${AUTOMATION_SECRET_MIN_LENGTH} characters`;
  return problem
    ? { intake, automation: null, automationProblem: problem }
    : { intake, automation: { url, secret }, automationProblem: null };
}

// ---------------------------------------------------------------------------
// What a visitor sent
// ---------------------------------------------------------------------------

/** The site's two forms. Anything else is stored as 'other', never refused. */
export const WAITLIST_SOURCES = ['hero', 'final'] as const;
export type WaitlistSource = (typeof WAITLIST_SOURCES)[number] | 'other';

/** RFC 5321's limit on a forward path; the table's CHECK says the same. */
export const WAITLIST_EMAIL_MAX_LENGTH = 254;

export interface WaitlistEntry {
  email: string;
  source: WaitlistSource;
}

export type WaitlistProblem = 'email_invalid' | 'email_disposable';

export type ParsedEntry =
  { ok: true; entry: WaitlistEntry } | { ok: false; problem: WaitlistProblem };

/**
 * The same rules as the founder signup (signup-guards.ts): one `@`, a dotted domain,
 * no throwaway providers, because the invite goes to this address weeks from now.
 */
export function parseWaitlistEntry(input: { email?: unknown; source?: unknown }): ParsedEntry {
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  if (email.length === 0 || email.length > WAITLIST_EMAIL_MAX_LENGTH) {
    return { ok: false, problem: 'email_invalid' };
  }
  const kind = classifyEmailDomain(email);
  if (kind === 'invalid') return { ok: false, problem: 'email_invalid' };
  if (kind === 'disposable') return { ok: false, problem: 'email_disposable' };

  const source = (WAITLIST_SOURCES as readonly string[]).includes(String(input.source))
    ? (input.source as WaitlistSource)
    : 'other';
  return { ok: true, entry: { email, source } };
}

// ---------------------------------------------------------------------------
// The database, as dripmetric_site
// ---------------------------------------------------------------------------

export class WaitlistUnavailableError extends Error {
  override name = 'WaitlistUnavailableError';
}

let sitePool: pg.Pool | undefined;
let sitePoolKey: string | undefined;

/**
 * A small pool: a serverless function handles one request at a time, and the
 * transaction pooler (port 6543) does the real pooling. Like every pool here it never
 * names a query, so `pg` never prepares one (docs/decisions.md, 2026-10-28).
 */
function poolFor(env: Env): pg.Pool {
  const url = env['SITE_DATABASE_URL']?.trim();
  if (!url) throw new WaitlistUnavailableError('SITE_DATABASE_URL is not set.');
  const key = `${url}\n${env['DATABASE_CA_CERT'] ?? ''}`;
  if (sitePool && sitePoolKey !== key) {
    void sitePool.end().catch(() => {});
    sitePool = undefined;
  }
  sitePoolKey = key;
  sitePool ??= (() => {
    const made = new pg.Pool({
      ...connectionOptions(url, { caCert: env['DATABASE_CA_CERT'], requireTls: true }),
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      application_name: 'dripmetric-site',
    });
    made.on('error', (error) => {
      console.error(
        JSON.stringify({ level: 'error', msg: 'waitlist pg client error', err: String(error) }),
      );
    });
    return made;
  })();
  return sitePool;
}

/**
 * Adds an address. `id` is the new row, or null when the address was already on the
 * list. Callers answer both the same way, so nobody can test whether someone signed up.
 */
export async function joinWaitlist(entry: WaitlistEntry, env: Env): Promise<{ id: number | null }> {
  const { rows } = await poolFor(env).query<{ id: string | null }>(
    'SELECT waitlist_join($1, $2) AS id',
    [entry.email, entry.source],
  );
  const id = rows[0]?.id;
  return { id: id === null || id === undefined ? null : Number(id) };
}

/** Records that a new address reached the automation. False when there was nothing to mark. */
export async function markWaitlistForwarded(id: number, env: Env): Promise<boolean> {
  const { rows } = await poolFor(env).query<{ marked: boolean }>(
    'SELECT waitlist_mark_forwarded($1) AS marked',
    [id],
  );
  return rows[0]?.marked === true;
}

export async function closeWaitlistPool(): Promise<void> {
  const current = sitePool;
  sitePool = undefined;
  sitePoolKey = undefined;
  await current?.end();
}

// ---------------------------------------------------------------------------
// The hand-off to the welcome-mail automation
// ---------------------------------------------------------------------------

export const WAITLIST_EVENT = 'waitlist.joined';
export const SIGNATURE_HEADER = 'Dripmetric-Signature';
/** The automation is someone else's server; a slow one must not hold a function open. */
export const AUTOMATION_TIMEOUT_MS = 3_000;

export interface WaitlistDelivery {
  id: number;
  email: string;
  source: string;
  joinedAt: Date;
}

/** The JSON body. Field names are snake_case, as most automation tools expect. */
export function automationBody(delivery: WaitlistDelivery): string {
  return JSON.stringify({
    type: WAITLIST_EVENT,
    id: delivery.id,
    email: delivery.email,
    source: delivery.source,
    joined_at: delivery.joinedAt.toISOString(),
  });
}

/**
 * `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`, the scheme Stripe uses, so
 * any receiver can check the request came from us and is not a replay.
 */
export function signAutomationBody(body: string, secret: string, now: Date): string {
  const timestamp = Math.floor(now.getTime() / 1000);
  const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

/**
 * Sends one address. True on a 2xx. Never throws: a failed hand-off leaves the row
 * unmarked, and `pnpm waitlist:forward` sends it later. The idempotency key is the row
 * id, so a receiver that honours it can take a resend safely.
 */
export async function forwardToAutomation(
  delivery: WaitlistDelivery,
  target: AutomationTarget,
  { now, fetchImpl = fetch }: { now: Date; fetchImpl?: typeof fetch },
): Promise<boolean> {
  const body = automationBody(delivery);
  try {
    const response = await fetchImpl(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Dripmetric-Waitlist/1',
        'Idempotency-Key': `waitlist-${delivery.id}`,
        [SIGNATURE_HEADER]: signAutomationBody(body, target.secret, now),
      },
      body,
      signal: AbortSignal.timeout(AUTOMATION_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
