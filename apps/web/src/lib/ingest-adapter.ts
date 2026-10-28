import { handleBatch, type IngestRequest } from '@dripmetric/ingest';
import type { NextRequest } from 'next/server';
import { enqueueFollowUps } from './queue';

/**
 * The adapter between Next.js and `@dripmetric/ingest`.
 *
 * It does three things and nothing else: flatten the request, call the pipeline,
 * shape the reply. All the behaviour lives in the package, so moving ingest to its
 * own service later is a new adapter, not a rewrite (brief section 4).
 */
export async function ingestRoute(request: NextRequest, source?: IngestRequest['source']) {
  // Read the body as TEXT. Beacons send `text/plain` to avoid a CORS preflight, so
  // the content type says nothing useful (brief section 5).
  const body = await request.text();

  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const response = await handleBatch(
    { body, headers, receivedAt: new Date(), ...(source ? { source } : {}) },
    { enqueue: enqueueFollowUps },
  );

  return Response.json(response.body, {
    status: response.status,
    headers: {
      ...corsFor(headers['origin']),
      ...(response.headers ?? {}),
    },
  });
}

/** The browser SDK posts cross-origin, so every reply carries CORS headers. */
export function corsFor(origin: string | undefined): Record<string, string> {
  return {
    'access-control-allow-origin': origin ?? '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

export function preflight(request: NextRequest): Response {
  return new Response(null, {
    status: 204,
    headers: corsFor(request.headers.get('origin') ?? undefined),
  });
}
