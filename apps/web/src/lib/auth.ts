import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { withoutProject } from '@dripmetric/db';
import { webEnv, isProduction } from './env';
import { sendEmail } from './mailer';

/**
 * Founder login is by magic link, no password (brief section 9).
 *
 * Both the link token and the session token are random 32-byte values; only their
 * SHA-256 hashes are stored, so a leaked database row cannot be replayed as a login.
 */

const SESSION_COOKIE = 'dm_session';
const SESSION_DAYS = 30;
const MAGIC_LINK_MINUTES = 15;

function hash(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface FounderUser {
  id: string;
  email: string;
}

/**
 * Starts a login. Always behaves the same way whether or not the address is known,
 * so the response cannot be used to find out who has an account.
 */
export async function requestMagicLink(email: string, projectId?: number): Promise<void> {
  const normalised = email.trim().toLowerCase();
  const token = newToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_MINUTES * 60_000);

  await withoutProject('founder-auth', (db) =>
    db.exec(
      `INSERT INTO magic_link_tokens (email, token_hash, project_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [normalised, hash(token), projectId ?? null, expiresAt],
    ),
  );

  const url = `${webEnv().APP_URL}/login/verify?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: normalised,
    subject: 'Your Dripmetric sign-in link',
    text: [
      'Here is your sign-in link. It works once and expires in 15 minutes.',
      '',
      url,
      '',
      'If you did not ask to sign in, you can ignore this email.',
    ].join('\n'),
  });
}

export type VerifyResult =
  | { ok: true; user: FounderUser; projectId: number | null }
  | { ok: false; reason: 'unknown' | 'expired' | 'used' };

/** Spends a magic link, creating the founder's account on first sign-in. */
export async function verifyMagicLink(token: string): Promise<VerifyResult> {
  return withoutProject('founder-auth', async (db) => {
    const row = await db.maybeOne<{
      id: string;
      email: string;
      project_id: number | null;
      expires_at: Date;
      used_at: Date | null;
    }>(
      `SELECT id, email, project_id, expires_at, used_at
         FROM magic_link_tokens WHERE token_hash = $1`,
      [hash(token)],
    );

    if (!row) return { ok: false, reason: 'unknown' } as const;
    if (row.used_at) return { ok: false, reason: 'used' } as const;
    if (row.expires_at.getTime() < Date.now()) return { ok: false, reason: 'expired' } as const;

    // One use only: mark it spent in the same transaction that reads it.
    await db.exec('UPDATE magic_link_tokens SET used_at = now() WHERE id = $1', [row.id]);

    const user = await db.one<{ id: string; email: string }>(
      `INSERT INTO founder_users (email) VALUES ($1)
       ON CONFLICT (lower(email)) DO UPDATE SET last_seen_at = now()
       RETURNING id, email`,
      [row.email],
    );

    return { ok: true, user, projectId: row.project_id } as const;
  });
}

/** Issues the session cookie after a successful verification. */
export async function startSession(userId: string): Promise<void> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await withoutProject('founder-auth', (db) =>
    db.exec('INSERT INTO founder_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [
      userId,
      hash(token),
      expiresAt,
    ]),
  );

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    expires: expiresAt,
  });
}

/** The signed-in founder, or null. Read on every page that needs one. */
export async function currentUser(): Promise<FounderUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  return withoutProject('founder-auth', async (db) => {
    const row = await db.maybeOne<{ id: string; email: string }>(
      `SELECT u.id, u.email
         FROM founder_sessions s
         JOIN founder_users u ON u.id = s.user_id
        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > now()`,
      [hash(token)],
    );
    return row ?? null;
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await withoutProject('founder-auth', (db) =>
      db.exec('UPDATE founder_sessions SET revoked_at = now() WHERE token_hash = $1', [
        hash(token),
      ]),
    );
  }
  store.delete(SESSION_COOKIE);
}

/** Whether this founder may see this project. */
export async function userOwnsProject(userId: string, projectId: number): Promise<boolean> {
  return withoutProject('founder-auth', async (db) => {
    const row = await db.maybeOne(
      'SELECT 1 FROM project_members WHERE user_id = $1 AND project_id = $2',
      [userId, projectId],
    );
    return row !== null;
  });
}

/** Every project this founder can see, newest first. */
export async function userProjects(
  userId: string,
): Promise<{ id: number; publicId: string; name: string; mode: string }[]> {
  return withoutProject('founder-auth', async (db) => {
    const rows = await db.query<{ id: number; public_id: string; name: string; mode: string }>(
      `SELECT p.id, p.public_id, p.name, p.mode
         FROM projects p
         JOIN project_members m ON m.project_id = p.id
        WHERE m.user_id = $1 AND p.deleted_at IS NULL AND p.mode = 'live'
        ORDER BY p.created_at DESC`,
      [userId],
    );
    return rows.map((r) => ({ id: r.id, publicId: r.public_id, name: r.name, mode: r.mode }));
  });
}
