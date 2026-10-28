import { ANON_COOKIE, ANON_COOKIE_DAYS } from '../shared/constants.js';
import { rootDomain } from './paths.js';
import { uuid } from './ids.js';

/**
 * Device storage, and the rule that governs it (settled decision 13).
 *
 * Where consent is required, NOTHING is stored on the device until `consent(true)`.
 * So every function here is only ever called from behind the consent gate, and the
 * anonymous id lives in memory until then.
 *
 * Every read and write is wrapped: a private window, blocked cookies or a sandboxed
 * iframe must degrade to "no stored id", not an exception in the founder's app.
 */

let memoryAnonymousId: string | undefined;

function readCookie(name: string): string | undefined {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

function writeCookie(name: string, value: string, days: number): void {
  try {
    const expires = new Date(Date.now() + days * 86400 * 1000).toUTCString();
    const domain = rootDomain();
    // The root domain, so the marketing site and the app share one visitor
    // (brief section 6). SameSite=Lax, and Secure wherever we are on https.
    document.cookie =
      `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax` +
      (domain ? `;domain=.${domain}` : '') +
      (location.protocol === 'https:' ? ';Secure' : '');
  } catch {
    // Nothing to do: the id stays in memory for this page only.
  }
}

/** The anonymous id for this visitor. In memory only until `persist` is allowed. */
export function anonymousId(persist: boolean): string {
  if (persist) {
    const stored = readCookie(ANON_COOKIE);
    if (stored) {
      memoryAnonymousId = stored;
      return stored;
    }
  }
  memoryAnonymousId ??= uuid();
  if (persist) writeCookie(ANON_COOKIE, memoryAnonymousId, ANON_COOKIE_DAYS);
  return memoryAnonymousId;
}

/** Called by `consent(true)`: moves the in-memory id onto the device. */
export function persistAnonymousId(): void {
  if (memoryAnonymousId) writeCookie(ANON_COOKIE, memoryAnonymousId, ANON_COOKIE_DAYS);
}

/** `reset()` — a logout. A new visitor from here on. */
export function clearIdentity(): void {
  memoryAnonymousId = undefined;
  try {
    const domain = rootDomain();
    document.cookie =
      `${ANON_COOKIE}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/` +
      (domain ? `;domain=.${domain}` : '');
  } catch {
    // Already gone, or we were never allowed to write it.
  }
}

/** Session state is per-tab, so sessionStorage rather than a cookie. */
export function readSession(key: string): string | undefined {
  try {
    return sessionStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // A private window or blocked storage: the session lives in memory instead.
  }
}
