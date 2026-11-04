/**
 * Id generation.
 *
 * `crypto.randomUUID` where it is available. It needs a SECURE context, so a
 * founder testing on a plain-http staging site does not get it, and the fallback
 * matters — but it does not have to produce a real UUID. A message id only has to
 * be unique, because the server dedupes on it and never parses it. Hand-building a
 * v4 UUID from `getRandomValues` cost ~200 bytes of a 5 KB budget to buy a shape
 * nothing reads.
 */
export function uuid(): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    // Not a secure context, or a browser without it. Unique is all that is needed.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
