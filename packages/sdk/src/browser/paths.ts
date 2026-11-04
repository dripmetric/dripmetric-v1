import { CAMPAIGN_KEYS } from '../shared/constants.js';

/**
 * Path normalisation, in the browser, BEFORE sending (brief section 6).
 *
 * Doing it here rather than only at ingest matters for two reasons: the `paths`
 * dictionary would otherwise get a row per customer id, and a raw URL containing a
 * password-reset token or an email address would leave the device at all.
 *
 * Ingest normalises again — the same rules, in packages/ingest — because a server
 * call or a Segment feed may not have.
 */

const NUMERIC = /^\d+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_ID = /^[0-9a-f]{16,}$/i;
const PREFIXED_ID = /^[a-z]{2,8}_[A-Za-z0-9]{6,}$/;
const LONG_TOKEN = /^[A-Za-z0-9_-]{21,}$/;

function normaliseSegment(segment: string): string {
  if (!segment) return segment;
  if (
    NUMERIC.test(segment) ||
    UUID_RE.test(segment) ||
    HEX_ID.test(segment) ||
    PREFIXED_ID.test(segment) ||
    LONG_TOKEN.test(segment)
  ) {
    return ':id';
  }
  return segment;
}

export function normalisePath(pathname: string, hash: string): string {
  let path = pathname.split('/').map(normaliseSegment).join('/') || '/';
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

  // Fragments are dropped, except a hash route, which IS the path in such an app.
  if (hash.startsWith('#/')) {
    path += '#' + hash.slice(2).split('/').map(normaliseSegment).join('/');
  }
  return path.slice(0, 1024);
}

/** Campaign tags only. Every other query parameter is dropped (brief section 10). */
export function campaignFrom(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!search) return out;
  const params = new URLSearchParams(search);
  for (const key of CAMPAIGN_KEYS) {
    const value = params.get(key);
    if (value) out[key.slice(4)] = value.slice(0, 256);
  }
  return out;
}

/** The referrer, reduced to a domain. A full referrer URL is never sent. */
export function referrerDomain(referrer: string): string | undefined {
  if (!referrer) return undefined;
  try {
    return new URL(referrer).hostname.replace(/^www\./, '') || undefined;
  } catch {
    return undefined;
  }
}

/**
 * The registrable domain, found by setting a test cookie on progressively shorter
 * domains (brief section 12). No public-suffix list, which would be larger than the
 * whole SDK.
 */
export function rootDomain(): string | undefined {
  try {
    const parts = location.hostname.split('.');
    if (parts.length < 2) return undefined; // localhost
    for (let i = parts.length - 2; i >= 0; i--) {
      const candidate = parts.slice(i).join('.');
      const probe = `__dm_probe=1;domain=.${candidate};path=/;SameSite=Lax`;
      document.cookie = probe;
      if (document.cookie.includes('__dm_probe=1')) {
        document.cookie = `__dm_probe=;domain=.${candidate};path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        return candidate;
      }
    }
  } catch {
    // A sandboxed iframe or a blocked cookie jar: fall back to a host-only cookie.
  }
  return undefined;
}
