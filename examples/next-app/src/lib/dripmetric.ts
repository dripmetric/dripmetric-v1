import { Dripmetric } from 'dripmetric/server';

/**
 * One client for the whole app.
 *
 * A module-level instance is right here: it holds an in-memory queue and a 2-second
 * timer, and making a new one per request would mean a queue that is thrown away
 * before it ever flushes.
 */
export const dripmetric = new Dripmetric({
  secretKey: process.env['DRIPMETRIC_SECRET_KEY'] ?? 'sk_test_example',
  host: process.env['DRIPMETRIC_HOST'] ?? 'http://localhost:3000',
  // Without this, a delivery problem is silent. In production this would go to
  // whatever you already use for logs.
  onError: (error) => console.warn('[dripmetric]', error.message),
});
