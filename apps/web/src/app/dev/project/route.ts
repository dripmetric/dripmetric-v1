import { notFound } from 'next/navigation';
import { createProject } from '@dripmetric/db';
import { currentUser } from '@/lib/auth';
import { mailboxEnabled } from '@/lib/mailer';

/**
 * Dev-only: creates a project and returns its four keys, so a script can walk the
 * flow the new-project form drives in a browser. Gated the same way as /dev/login.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!mailboxEnabled()) notFound();

  const user = await currentUser();
  if (!user) return Response.json({ error: 'not signed in' }, { status: 401 });

  const name = new URL(request.url).searchParams.get('name') ?? 'Dev project';
  const created = await createProject({ name, ownerUserId: user.id });

  return Response.json({
    publicId: created.live.publicId,
    keys: created.keys.map((k) => ({ kind: k.kind, mode: k.mode, token: k.token })),
  });
}
