/**
 * The script-tag build (brief section 6): exposes a global `dripmetric` for founders
 * who are not using a bundler.
 *
 * ```html
 * <script src="https://cdn.dripmetric.com/v2/dripmetric.js"></script>
 * <script>dripmetric.init('pk_live_…')</script>
 * ```
 *
 * Calls made before the script loads are replayed: a founder can push onto
 * `window.dripmetric.q` from an inline snippet and nothing is lost.
 */
import * as api from './index.js';

interface Queued {
  q?: [keyof typeof api, unknown[]][];
}

const existing = (globalThis as { dripmetric?: Queued }).dripmetric;
(globalThis as { dripmetric?: typeof api }).dripmetric = api;

// Replay anything the inline snippet queued before this file arrived.
for (const [method, args] of existing?.q ?? []) {
  try {
    (api[method] as (...a: unknown[]) => unknown)(...args);
  } catch {
    // One bad queued call must not stop the rest.
  }
}
