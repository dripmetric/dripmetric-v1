import { randomBytes } from 'node:crypto';
import { lookupHash } from './crypto.js';

/**
 * API keys (brief section 5).
 *
 *  - Publishable `pk_live_…` / `pk_test_…`: write-only and origin-restricted. They
 *    sit in the founder's HTML, so they are public by design and we keep the token
 *    so the snippet can be shown again.
 *  - Secret `sk_live_…` / `sk_test_…`: stored hashed, shown once, rotatable.
 */
export type KeyKind = 'publishable' | 'secret';
export type ProjectMode = 'live' | 'test';

export function keyPrefix(kind: KeyKind, mode: ProjectMode): string {
  return `${kind === 'publishable' ? 'pk' : 'sk'}_${mode}_`;
}

/** 32 bytes of randomness in base64url: no padding, URL-safe, no ambiguous characters. */
export function generateKey(kind: KeyKind, mode: ProjectMode): string {
  return keyPrefix(kind, mode) + randomBytes(24).toString('base64url');
}

export interface ParsedKey {
  kind: KeyKind;
  mode: ProjectMode;
}

/** Reads the shape of a key without touching the database, so a malformed key is
 *  rejected before it costs a query. */
export function parseKey(token: string): ParsedKey | null {
  const match = /^(pk|sk)_(live|test)_[A-Za-z0-9_-]{16,}$/.exec(token);
  if (!match) return null;
  return {
    kind: match[1] === 'pk' ? 'publishable' : 'secret',
    mode: match[2] as ProjectMode,
  };
}

export function keyLookupHash(token: string): Buffer {
  return lookupHash(token);
}

export function lastFour(token: string): string {
  return token.slice(-4);
}

/** "sk_live_…a1b2" — what the dashboard shows for a key it cannot show in full. */
export function displayKey(prefixed: string): string {
  const parsed = parseKey(prefixed);
  if (!parsed) return '…';
  return `${keyPrefix(parsed.kind, parsed.mode)}…${lastFour(prefixed)}`;
}
