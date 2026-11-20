import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type pg from 'pg';

/**
 * TLS for a Postgres connection string (docs/decisions.md, 2026-11-20).
 *
 * Two facts about `pg` 8 that make this module necessary, both checked against the
 * installed version rather than recalled:
 *
 *  - A connection string with no `sslmode` connects in PLAINTEXT. Supabase's URIs carry
 *    no `sslmode`, so pasting one as-is sends the password unencrypted.
 *  - Any `sslmode` in the string overrides an `ssl` option passed beside it, and
 *    `require` currently means verify-full against the system CAs. Supabase signs its
 *    servers with its own CA, so that fails with "self-signed certificate in
 *    certificate chain" — and the usual fix people reach for is turning verification
 *    off.
 *
 * So: when `DATABASE_CA_CERT` is set (Supabase → Database Settings → SSL Configuration →
 * download certificate), the server is verified against it, hostname included, and the
 * string's own TLS parameters are removed so they cannot override that. Without it a
 * connection string is passed through unchanged, except that `requireTls` refuses a
 * remote host with no TLS at all instead of quietly connecting in plaintext.
 */

/** Hosts where plaintext is fine: this machine, and Docker's own network names. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'postgres', 'db']);

/** Connection-string parameters that would override the `ssl` option. */
const TLS_PARAMS = [
  'ssl',
  'sslmode',
  'sslrootcert',
  'sslcert',
  'sslkey',
  'sslnegotiation',
  'uselibpqcompat',
];

/** True for a connection string that points at this machine or a Docker service name. */
export function isLocalDatabase(connectionString: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(connectionString).hostname);
  } catch {
    return false;
  }
}

export class DatabaseTlsError extends Error {
  override name = 'DatabaseTlsError';
}

/**
 * The CA certificate as PEM text. The variable holds either the PEM itself (how a
 * hosting dashboard takes it) or a path to the file (handier in a local `.env`). A
 * relative path is read from where the command was typed: pnpm runs package scripts
 * from the package's folder and records the original one in INIT_CWD.
 */
export function readCaCertificate(value: string | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (raw.startsWith('-----BEGIN')) return raw.replace(/\\n/g, '\n');
  const path = isAbsolute(raw) ? raw : resolve(process.env['INIT_CWD'] ?? process.cwd(), raw);
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new DatabaseTlsError(
      'DATABASE_CA_CERT is neither a PEM certificate nor a readable file path.',
    );
  }
}

export interface TlsOptions {
  /** PEM text or a path; see `readCaCertificate`. Usually `process.env.DATABASE_CA_CERT`. */
  caCert?: string | undefined;
  /** Refuse a remote host that would otherwise connect without TLS. */
  requireTls?: boolean;
}

/** `pg` pool or client options for a connection string, with TLS settled. */
export function connectionOptions(
  connectionString: string,
  { caCert, requireTls = false }: TlsOptions = {},
): Pick<pg.PoolConfig, 'connectionString' | 'ssl'> {
  const ca = readCaCertificate(caCert);
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    // Not a URL (a libpq keyword string, say): nothing here can be checked safely.
    return { connectionString };
  }

  if (ca) {
    for (const param of TLS_PARAMS) url.searchParams.delete(param);
    return { connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true } };
  }

  const local = isLocalDatabase(connectionString);
  const asksForTls = TLS_PARAMS.some((param) => url.searchParams.has(param));
  if (requireTls && !local && !asksForTls) {
    throw new DatabaseTlsError(
      `The connection to ${url.hostname} would not be encrypted. Set DATABASE_CA_CERT to ` +
        "your database's CA certificate (Supabase: Database Settings → SSL Configuration), " +
        'or add ?sslmode=verify-full if the server has a publicly trusted certificate.',
    );
  }
  return { connectionString };
}
