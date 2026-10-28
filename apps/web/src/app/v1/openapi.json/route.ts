import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';

/**
 * GET /v1/openapi.json — the spec, so any team can generate a client (brief
 * section 5). It is served from `docs/openapi.yaml`, which is the one copy: the
 * conformance test in packages/ingest reads the same file, so the spec and the
 * implementation cannot drift apart silently.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const path = join(process.cwd(), '..', '..', 'docs', 'openapi.yaml');
  const spec = parse(await readFile(path, 'utf8'));
  return Response.json(spec, {
    headers: { 'cache-control': 'public, max-age=300' },
  });
}
