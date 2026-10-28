import { after } from 'next/server';
import { flushAfterResponse, signUserId } from 'dripmetric/server';
import { dripmetric } from '@/lib/dripmetric';

/**
 * Signup, from the server (brief Appendix B: send these from the server where you
 * can — ad blockers and a declined consent banner cannot stop them).
 */
export async function POST(request: Request) {
  const { userId, email } = (await request.json()) as { userId: string; email: string };

  dripmetric.identify(userId, {
    email,
    createdAt: new Date().toISOString(),
    signupMethod: 'email',
  });
  dripmetric.track(userId, 'Signed Up', { method: 'email' });
  dripmetric.track(userId, 'Activated');

  // Delivery finishes AFTER the response, so analytics never delays it. `after`
  // takes a promise, and so does Vercel's waitUntil, so the same call serves both.
  flushAfterResponse(dripmetric, after);

  return Response.json({
    sent: ['Signed Up', 'Activated'],
    // What the browser would pass back as `userIdHmac` when identity verification
    // is switched on for a project.
    userIdHmac: signUserId(process.env['DRIPMETRIC_SECRET_KEY'] ?? 'sk_test_example', userId),
  });
}
