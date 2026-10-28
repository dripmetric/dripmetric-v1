import { parseKey, keyLookupHash, withoutProject, type ProjectMode } from '@dripmetric/db';
import { unauthorised } from './errors.js';
import type { IngestRequest } from './types.js';

/**
 * Key handling (brief section 5).
 *
 * A key may arrive three ways, because each is the only one some client can manage:
 *   - `Authorization: Bearer <key>`      — our SDKs and plain HTTP
 *   - `Authorization: Basic <key>:`      — how Segment's own libraries send it
 *   - a `writeKey` field in the body     — `sendBeacon` cannot set headers at all
 */

export interface ResolvedKey {
  apiKeyId: string;
  projectId: number;
  kind: 'publishable' | 'secret';
  mode: ProjectMode;
}

export function extractKey(
  request: IngestRequest,
  bodyWriteKey: string | undefined,
): string | null {
  const header = request.headers['authorization'];
  if (header) {
    const bearer = /^Bearer\s+(\S+)$/i.exec(header);
    if (bearer?.[1]) return bearer[1];

    const basic = /^Basic\s+(\S+)$/i.exec(header);
    if (basic?.[1]) {
      // Segment sends the write key as the username with an empty password.
      const decoded = Buffer.from(basic[1], 'base64').toString('utf8');
      const username = decoded.split(':')[0];
      if (username) return username;
    }
  }
  return bodyWriteKey ?? null;
}

/**
 * Resolves a key to its project.
 *
 * This genuinely starts outside any project — the key is what tells us which project
 * it is — so it uses the named escape hatch.
 */
export async function resolveKey(token: string): Promise<ResolvedKey> {
  // Check the shape first, so a malformed key costs no query.
  const shape = parseKey(token);
  if (!shape) throw unauthorised('That key is not in the right shape.');

  const row = await withoutProject('resolve-api-key', (db) =>
    db.maybeOne<{
      id: string;
      project_id: number;
      kind: 'publishable' | 'secret';
      mode: ProjectMode;
    }>(
      `SELECT k.id, k.project_id, k.kind, k.mode
         FROM api_keys k
         JOIN projects p ON p.id = k.project_id
        WHERE k.lookup_hash = $1
          AND k.revoked_at IS NULL
          AND p.deleted_at IS NULL`,
      [keyLookupHash(token)],
    ),
  );

  if (!row) throw unauthorised('That key is not valid, or it has been revoked.');
  return { apiKeyId: row.id, projectId: row.project_id, kind: row.kind, mode: row.mode };
}

/**
 * Publishable keys are origin-restricted (brief section 5). A secret key has no
 * origin: it is used from a server, where there is no browser to send one.
 *
 * An empty allow-list means the founder has not set one yet, so we accept any origin
 * rather than silently dropping their first events. Setup asks for it.
 */
export function originAllowed(
  kind: 'publishable' | 'secret',
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  if (kind === 'secret') return true;
  if (allowedOrigins.length === 0) return true;
  if (!origin) return true; // no Origin header at all: not a cross-site browser request
  return allowedOrigins.some((allowed) => matchesOrigin(origin, allowed));
}

function matchesOrigin(origin: string, allowed: string): boolean {
  const normalise = (value: string) => value.trim().replace(/\/+$/, '').toLowerCase();
  const a = normalise(origin);
  const b = normalise(allowed);
  if (a === b) return true;
  // `https://*.acme.com` covers every subdomain.
  if (b.includes('*')) {
    const pattern = new RegExp(
      '^' +
        b
          .split('*')
          .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
          .join('[^.]+') +
        '$',
    );
    return pattern.test(a);
  }
  return false;
}
