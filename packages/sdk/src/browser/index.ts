/**
 * `dripmetric/browser` — the browser library (brief section 6).
 *
 * ```js
 * import * as dripmetric from 'dripmetric/browser';
 *
 * dripmetric.init('pk_live_…');
 * dripmetric.identify(user.id, { email: user.email, createdAt: user.createdAt });
 * dripmetric.track('Activated');
 * ```
 *
 * Three promises this library keeps:
 *
 *  - **It never blocks your app.** Sending happens off the rendering path.
 *  - **It never throws.** Every call is wrapped; turn on `debug` to see problems.
 *  - **It stores and sends nothing until your visitor consents**, unless you tell it
 *    consent is not required for your audience.
 */
import { Client, type InitOptions } from './client.js';

const client = new Client();

/** Start tracking. Call once, in your page shell. */
export function init(publishableKey: string, options?: InitOptions): void {
  client.init(publishableKey, options);
}

/**
 * Who this person is. Call it at signup and on every app load with the id you
 * already hold; traits are only sent when they change.
 */
export function identify(userId: string, traits?: Record<string, unknown>): void {
  client.identify(userId, traits);
}

/** The account or workspace this person belongs to. For team products. */
export function group(groupId: string, traits?: Record<string, unknown>): void {
  client.group(groupId, traits);
}

/** Something happened. Use a name from the catalog where one fits, or your own. */
export function track(event: string, properties?: Record<string, unknown>): void {
  client.track(event, properties);
}

/** A page view. Sent automatically on load and on every route change. */
export function page(properties?: Record<string, unknown>): void {
  client.page(properties);
}

/**
 * Your visitor's answer to your cookie banner.
 *
 * Until `consent(true)`, nothing is stored on their device and nothing is sent.
 * Events wait in memory with their original timestamps and go out when consent
 * arrives; if it never arrives they are discarded.
 */
export function consent(granted: boolean): void {
  client.consent(granted);
}

/** A logout: a new visitor and a new session from here on. */
export function reset(): void {
  client.reset();
}

/** Sends whatever is queued. Resolves when the attempt is over, and never rejects. */
export function flush(): Promise<void> {
  return client.flush();
}

/** Stops every listener and timer. For tests and hot reloads. */
export function stop(): void {
  client.stop();
}

export type { InitOptions };
