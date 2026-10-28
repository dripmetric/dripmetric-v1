import { SESSION_IDLE_MS } from '../shared/constants.js';
import { readSession, writeSession } from './storage.js';
import { uuid } from './ids.js';

/**
 * Sessions (brief section 6): a new one after 30 minutes idle. The id is generated
 * here; the session NUMBER is derived on the server, so two tabs cannot disagree
 * about it.
 */

const ID_KEY = 'dm_sid';
const SEEN_KEY = 'dm_seen';

let memoryId: string | undefined;
let memorySeen = 0;

export function sessionId(persist: boolean, now: number): string {
  const storedId = persist ? readSession(ID_KEY) : undefined;
  const storedSeen = persist ? Number(readSession(SEEN_KEY) ?? '0') : memorySeen;

  const id = storedId ?? memoryId;
  const seen = storedSeen || memorySeen;

  if (id && seen && now - seen < SESSION_IDLE_MS) {
    touch(persist, now);
    return id;
  }

  const fresh = uuid();
  memoryId = fresh;
  memorySeen = now;
  if (persist) {
    writeSession(ID_KEY, fresh);
    writeSession(SEEN_KEY, String(now));
  }
  return fresh;
}

export function touch(persist: boolean, now: number): void {
  memorySeen = now;
  if (persist) writeSession(SEEN_KEY, String(now));
}

/** `reset()` starts a new session along with a new visitor. */
export function clearSession(): void {
  memoryId = undefined;
  memorySeen = 0;
  try {
    sessionStorage.removeItem(ID_KEY);
    sessionStorage.removeItem(SEEN_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}
