/**
 * `dripmetric/server` — the Node library (brief section 6).
 *
 * ```js
 * import { Dripmetric } from 'dripmetric/server';
 *
 * const dm = new Dripmetric({ secretKey: process.env.DRIPMETRIC_SECRET_KEY });
 * dm.track(user.id, 'Signed Up', { method: 'google' });
 * ```
 *
 * Send `Signed Up`, `Activated`, `Checkout Started` and billing events from here
 * rather than the browser: ad blockers and a declined consent banner cannot stop
 * them, and they are the events every number depends on.
 */
export { Dripmetric, flushAfterResponse } from './client.js';
export type { ServerOptions } from './client.js';
export { signUserId } from './signing.js';
