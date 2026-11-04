import { createHmac } from 'node:crypto';

/**
 * Optional identity verification (brief section 5).
 *
 * A browser can claim to be any `userId` it likes. With verification switched on for
 * a project, a browser `identify` must carry an HMAC of the user id made with the
 * SECRET key — which only the founder's server has. This is the helper their backend
 * calls to produce it, and hands to the browser alongside the user id.
 *
 * ```js
 * const hmac = signUserId(process.env.DRIPMETRIC_SECRET_KEY, user.id);
 * // then, in the browser:
 * dripmetric.identify(user.id, { email: user.email, userIdHmac: hmac });
 * ```
 */
export function signUserId(secretKey: string, userId: string): string {
  if (!secretKey.startsWith('sk_')) {
    throw new Error(
      'signUserId needs your SECRET key (sk_live_… or sk_test_…), not a publishable one.',
    );
  }
  return createHmac('sha256', secretKey).update(userId, 'utf8').digest('hex');
}
