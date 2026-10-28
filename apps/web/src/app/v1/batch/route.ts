import type { NextRequest } from 'next/server';
import { ingestRoute, preflight } from '@/lib/ingest-adapter';

/** POST /v1/batch — the ingest endpoint (brief section 5). */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return ingestRoute(request);
}

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}
