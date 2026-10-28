/**
 * `dripmetric/server` — the Node library (brief section 6).
 *
 * The full implementation, the serverless flush helper and the identity-verification
 * helper land at M4. The entry point exists now so the package's `exports` map is
 * complete and the build produces both halves.
 */
export { Dripmetric } from './client.js';
export type { ServerOptions } from './client.js';
export { signUserId } from './signing.js';
