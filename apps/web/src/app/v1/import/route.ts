import type { NextRequest } from 'next/server';
import { ingestRoute, preflight } from '@/lib/ingest-adapter';

/**
 * POST /v1/import — the same endpoint under the path Segment's Ruby library posts to
 * (brief section 5). Accepting it means a Ruby founder only changes the host.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return ingestRoute(request);
}

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}
