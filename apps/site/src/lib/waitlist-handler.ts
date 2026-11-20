import {
  WaitlistUnavailableError,
  parseWaitlistEntry,
  waitlistSettings,
  type Env,
  type forwardToAutomation,
  type joinWaitlist,
  type markWaitlistForwarded,
} from '@dripmetric/db/waitlist';
import { waitlistMessage, type WaitlistOutcome } from '../content/waitlist-messages';

/**
 * POST /api/waitlist, as a plain Request → Response function so it can be tested
 * without Next.js; src/app/api/waitlist/route.server.ts only wires it up
 * (docs/decisions.md, 2026-11-20).
 *
 * Order matters. The intake switch is checked first, before the body is read: closed
 * means closed, with nothing parsed, counted or stored. Then the cheap refusals, then
 * one database call. The automation hand-off runs after the response is sent, so a
 * slow automation never slows the form.
 */

/** A form post is a few dozen bytes; anything near this is not a person. */
export const MAX_BODY_BYTES = 4_096;

/**
 * Five tries per address per ten minutes, per server instance. A person needs one or
 * two. It lives in memory only, so no IP address is ever written down (the privacy
 * page promises that); Vercel's firewall is the layer for anything bigger.
 */
export const RATE_LIMIT = { max: 5, windowMs: 10 * 60_000 } as const;

export interface RateLimiter {
  /** Counts a try. Null when allowed, else the seconds until the next one is. */
  hit(key: string, now: number): number | null;
}

export function createRateLimiter(
  limit: { max: number; windowMs: number } = RATE_LIMIT,
  maxKeys = 5_000,
): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    hit(key, now) {
      const current = windows.get(key);
      if (!current || current.resetAt <= now) {
        // Bounded memory: past the cap, forget everyone rather than grow.
        if (windows.size >= maxKeys) windows.clear();
        windows.set(key, { count: 1, resetAt: now + limit.windowMs });
        return null;
      }
      current.count += 1;
      return current.count > limit.max ? Math.ceil((current.resetAt - now) / 1000) : null;
    },
  };
}

export interface WaitlistDeps {
  env: Env;
  now: () => Date;
  join: typeof joinWaitlist;
  markForwarded: typeof markWaitlistForwarded;
  forward: typeof forwardToAutomation;
  /** Runs work after the response is sent: next/server's after(). */
  later: (task: () => Promise<void>) => void;
  limiter: RateLimiter;
  contactEmail: string;
  homeUrl: string;
  log: (line: Record<string, unknown>) => void;
}

const STATUS: Record<WaitlistOutcome, number> = {
  joined: 200,
  waitlist_closed: 503,
  waitlist_unavailable: 503,
  email_invalid: 422,
  email_disposable: 422,
  rate_limited: 429,
  request_refused: 400,
};

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * JSON for the form's fetch; a small page for a browser posting without JavaScript.
 * Never cached, never indexed.
 */
function respond(
  outcome: WaitlistOutcome,
  request: Request,
  deps: WaitlistDeps,
  extra: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const status = extra.status ?? STATUS[outcome];
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
    ...extra.headers,
  };
  if ((request.headers.get('accept') ?? '').includes('application/json')) {
    const body = outcome === 'joined' ? { ok: true } : { ok: false, error: outcome };
    return Response.json(body, { status, headers });
  }
  const message = waitlistMessage(outcome, deps.contactEmail);
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(message.title)} · Dripmetric</title>
<style>body{font:17px/1.6 system-ui,sans-serif;max-width:34rem;margin:15vh auto;padding:0 16px;color:#0b1820;background:#fff}a{color:#0b6e7c}@media (prefers-color-scheme:dark){body{color:#e8eef0;background:#0b1820}a{color:#5bd2e3}}</style>
</head>
<body>
<h1>${escapeHtml(message.title)}</h1>
<p>${escapeHtml(message.body)}</p>
<p><a href="${escapeHtml(deps.homeUrl)}">Back to Dripmetric</a></p>
</body>
</html>
`;
  return new Response(page, {
    status,
    headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/** The visitor's address as Vercel reports it, for the in-memory limit only. */
function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** A browser always says where a POST came from; another site's form is refused. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return origin === null;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function readFields(request: Request): Promise<Record<string, unknown> | null> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  const type = (request.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase();
  if (type === 'application/x-www-form-urlencoded') {
    return Object.fromEntries(new URLSearchParams(text));
  }
  if (type === 'application/json') {
    try {
      const parsed: unknown = JSON.parse(text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function handleWaitlistPost(request: Request, deps: WaitlistDeps): Promise<Response> {
  const settings = waitlistSettings(deps.env);
  if (settings.intake === 'closed') return respond('waitlist_closed', request, deps);

  if (!sameOrigin(request)) return respond('request_refused', request, deps, { status: 403 });

  const fields = await readFields(request);
  if (!fields) return respond('request_refused', request, deps);

  // The honeypot: a person never fills it in, so pretend it worked and store nothing.
  if (typeof fields['_gotcha'] === 'string' && fields['_gotcha'] !== '') {
    return respond('joined', request, deps);
  }

  const retryAfter = deps.limiter.hit(clientKey(request), deps.now().getTime());
  if (retryAfter !== null) {
    return respond('rate_limited', request, deps, {
      headers: { 'Retry-After': String(retryAfter) },
    });
  }

  const parsed = parseWaitlistEntry(fields);
  if (!parsed.ok) return respond(parsed.problem, request, deps);
  const { entry } = parsed;

  let id: number | null;
  try {
    ({ id } = await deps.join(entry, deps.env));
  } catch (error) {
    deps.log({
      level: 'error',
      msg:
        error instanceof WaitlistUnavailableError
          ? 'waitlist not configured'
          : 'waitlist store failed',
      err: String(error),
    });
    return respond('waitlist_unavailable', request, deps);
  }

  // Never the address itself in a log line.
  deps.log({ level: 'info', msg: 'waitlist joined', source: entry.source, new: id !== null });

  if (settings.automationProblem) {
    deps.log({
      level: 'warn',
      msg: 'waitlist automation is on but incomplete',
      problem: settings.automationProblem,
    });
  }
  const target = settings.automation;
  if (id !== null && target) {
    const delivery = { id, email: entry.email, source: entry.source, joinedAt: deps.now() };
    deps.later(async () => {
      const sent = await deps.forward(delivery, target, { now: deps.now() });
      if (!sent) {
        deps.log({
          level: 'warn',
          msg: 'waitlist hand-off failed; pnpm waitlist:forward will retry',
          id,
        });
        return;
      }
      try {
        await deps.markForwarded(id, deps.env);
      } catch (error) {
        // Delivered but not stamped: a later `waitlist:forward` may send it once more,
        // which the idempotency key lets the automation ignore.
        deps.log({ level: 'error', msg: 'waitlist hand-off not recorded', id, err: String(error) });
      }
    });
  }

  // Already on the list answers exactly like new: the form cannot be used to test addresses.
  return respond('joined', request, deps);
}
