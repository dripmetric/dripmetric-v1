import { notFound } from 'next/navigation';
import { requestMagicLink } from '@/lib/auth';
import { mailbox, mailboxEnabled } from '@/lib/mailer';

/**
 * Dev-only: asks for a magic link and hands back the link itself.
 *
 * It exists so the whole signup-to-first-event flow can be walked by a script
 * without driving a browser, which is how the M0 exit checks are shown to be true.
 * It is gated on there being NO email provider configured, so it cannot exist in
 * production, where RESEND_API_KEY is set.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!mailboxEnabled()) notFound();

  const email = new URL(request.url).searchParams.get('email');
  if (!email) return Response.json({ error: 'pass ?email=' }, { status: 400 });

  await requestMagicLink(email);
  const link = mailbox()
    .find((m) => m.to === email.toLowerCase())
    ?.text.match(/https?:\/\/\S+/)?.[0];

  return Response.json({ email, link: link ?? null });
}
