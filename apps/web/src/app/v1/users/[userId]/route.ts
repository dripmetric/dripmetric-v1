import type { NextRequest } from 'next/server';
import { IngestError, deleteUser } from '@dripmetric/ingest';
import { corsFor, preflight } from '@/lib/ingest-adapter';

/**
 * DELETE /v1/users/:userId — erases a person (brief section 10).
 *
 * Secret keys only, so a browser can never delete someone. A thin adapter, like the
 * ingest routes: the behaviour lives in @dripmetric/ingest.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  const origin = request.headers.get('origin') ?? undefined;

  const bearer = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '');

  try {
    const result = await deleteUser(bearer?.[1] ?? null, userId);
    return Response.json(result.body, { status: result.status, headers: corsFor(origin) });
  } catch (error) {
    if (error instanceof IngestError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status, headers: corsFor(origin) },
      );
    }
    throw error;
  }
}

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}
