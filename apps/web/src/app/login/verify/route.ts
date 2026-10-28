import { startSession, verifyMagicLink } from '@/lib/auth';

/**
 * GET /login/verify?token=… — spends the magic link and signs the founder in.
 *
 * This is a route handler, not a page, because Next.js only allows a cookie to be
 * set from a route handler or a server action. A failed link redirects back to
 * /login with a reason, so the founder reads one plain sentence rather than an error
 * page.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  const base = new URL(request.url).origin;

  if (!token) return Response.redirect(`${base}/login`, 307);

  const result = await verifyMagicLink(token);
  if (!result.ok) {
    return Response.redirect(`${base}/login?problem=${result.reason}`, 307);
  }

  await startSession(result.user.id);
  // An unclaimed project from the email-only signup flow is claimed by the link (M12).
  const destination = result.projectId ? `${base}/` : `${base}/`;
  return Response.redirect(destination, 307);
}
