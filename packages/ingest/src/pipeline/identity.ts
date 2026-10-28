import type { ScopedDb } from '@dripmetric/db';
import { encrypt } from '@dripmetric/db';
import { classifyEmail, looksLikeEmail } from '../enrich/email.js';

/**
 * Identity: an anonymous visitor becomes a known user at identify(), and group()
 * builds accounts (brief sections 4 and 7).
 *
 * The rule that matters: identify() NEVER rewrites an old event row. Events keep the
 * anonymous key they were written with, and the person's timeline is assembled
 * through `anonymous_links` by time. A second person identifying on the same
 * anonymous id (a shared computer) starts a new link from that moment, so two people
 * are never merged.
 */

/** Traits that identify a person. Stored encrypted, apart from the rest. */
const NAME_LIKE_TRAITS = new Set([
  'name',
  'firstName',
  'lastName',
  'first_name',
  'last_name',
  'company',
  'fullName',
]);

export async function resolveAnonKey(
  db: ScopedDb,
  anonymousId: string,
  seenAt: Date,
): Promise<number> {
  const row = await db.one<{ anon_key: number }>(
    `INSERT INTO anonymous_visitors (project_id, anonymous_id, first_seen_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, anonymous_id)
       DO UPDATE SET anonymous_id = EXCLUDED.anonymous_id
     RETURNING anon_key`,
    [db.projectId, anonymousId, seenAt],
  );
  return row.anon_key;
}

export interface ResolvedUser {
  userKey: number;
  internal: boolean;
  optedOut: boolean;
  deleted: boolean;
}

export async function resolveUserKey(
  db: ScopedDb,
  externalId: string,
  seenAt: Date,
): Promise<ResolvedUser> {
  const row = await db.one<{
    user_key: number;
    internal: boolean;
    opted_out: boolean;
    deleted_at: Date | null;
  }>(
    `INSERT INTO end_users (project_id, external_id, first_seen_at, last_event_at)
     VALUES ($1, $2, $3, $3)
     ON CONFLICT (project_id, external_id)
       DO UPDATE SET last_event_at = GREATEST(end_users.last_event_at, EXCLUDED.last_event_at)
     RETURNING user_key, internal, opted_out, deleted_at`,
    [db.projectId, externalId, seenAt],
  );
  return {
    userKey: row.user_key,
    internal: row.internal,
    optedOut: row.opted_out,
    deleted: row.deleted_at !== null,
  };
}

/**
 * Links an anonymous key to a user from this moment on.
 *
 * The FIRST link for an anonymous id also claims everything before it, which is how
 * the visits someone made before signing up join their timeline. A later link for a
 * DIFFERENT user closes the previous one instead of rewriting it.
 */
export async function linkAnonymousToUser(
  db: ScopedDb,
  anonKey: number,
  userKey: number,
  at: Date,
): Promise<void> {
  const latest = await db.maybeOne<{ user_key: number; linked_at: Date }>(
    `SELECT user_key, linked_at
       FROM anonymous_links
      WHERE project_id = $1 AND anon_key = $2
      ORDER BY linked_at DESC
      LIMIT 1`,
    [db.projectId, anonKey],
  );

  if (latest?.user_key === userKey) return; // already this person

  if (latest) {
    // A different person on the same device. Close the old window; never merge them.
    await db.exec(
      `UPDATE anonymous_links SET claims_to = $4
        WHERE project_id = $1 AND anon_key = $2 AND linked_at = $3`,
      [db.projectId, anonKey, latest.linked_at, at],
    );
  }

  await db.exec(
    `INSERT INTO anonymous_links (project_id, anon_key, user_key, linked_at, claims_from, claims_to)
     VALUES ($1, $2, $3, $4, $5, 'infinity')
     ON CONFLICT (project_id, anon_key, linked_at) DO NOTHING`,
    // '-infinity' is Postgres's own value for "since forever". JavaScript's minimum
    // Date is year -271821, which a timestamptz cannot hold.
    [db.projectId, anonKey, userKey, at, latest ? at : '-infinity'],
  );
}

export interface TraitWrite {
  email?: string | undefined;
  nameTraits: Record<string, unknown>;
  otherTraits: Record<string, unknown>;
}

/** Splits an identify()'s traits into the three places they are stored. */
export function splitTraits(traits: Record<string, unknown>): TraitWrite {
  const nameTraits: Record<string, unknown> = {};
  const otherTraits: Record<string, unknown> = {};
  let email: string | undefined;

  for (const [key, value] of Object.entries(traits)) {
    if (key === 'email' && looksLikeEmail(value)) {
      email = value;
    } else if (NAME_LIKE_TRAITS.has(key)) {
      nameTraits[key] = value;
    } else {
      otherTraits[key] = value;
    }
  }
  return { email, nameTraits, otherTraits };
}

/**
 * Marks a person as the founder's own team and removes what we already stored for
 * them.
 *
 * The cleanup is not tidiness. An `identify` can arrive AFTER an event from the same
 * person — the simulator found a case where a step event and the identify shared a
 * millisecond and the id tiebreak put the event first — so by the time we learn the
 * address is internal, rows may exist. Leaving them means any query that forgets to
 * filter on `internal` counts the founder's own team. Deleting them makes
 * "internal users leave no trace" true rather than nearly true.
 *
 * It is a handful of rows, once per internal person, inside the transaction that
 * sets the flag.
 */
export async function markInternal(db: ScopedDb, userKey: number): Promise<number> {
  await db.exec('UPDATE end_users SET internal = true WHERE project_id = $1 AND user_key = $2', [
    db.projectId,
    userKey,
  ]);

  // Derived state first, then the events themselves.
  await db.exec('DELETE FROM user_step_state WHERE project_id = $1 AND user_key = $2', [
    db.projectId,
    userKey,
  ]);
  await db.exec('DELETE FROM daily_event_counts WHERE project_id = $1 AND user_key = $2', [
    db.projectId,
    userKey,
  ]);
  await db.exec('DELETE FROM monthly_active_users WHERE project_id = $1 AND user_key = $2', [
    db.projectId,
    userKey,
  ]);
  return db.exec('DELETE FROM events WHERE project_id = $1 AND user_key = $2', [
    db.projectId,
    userKey,
  ]);
}

export interface ApplyTraitsOptions {
  /** Server-only traits are dropped from a publishable key (brief section 5). */
  allowServerOnly: boolean;
}

/** Writes an identify()'s traits onto the person. */
export async function applyTraits(
  db: ScopedDb,
  userKey: number,
  traits: Record<string, unknown>,
  at: Date,
  options: ApplyTraitsOptions,
): Promise<void> {
  const { email, nameTraits, otherTraits } = splitTraits(traits);

  const emailCipher = email ? encrypt(email) : null;
  const nameCipher =
    Object.keys(nameTraits).length > 0 ? encrypt(JSON.stringify(nameTraits)) : null;

  const stripeCustomerId = options.allowServerOnly
    ? pickString(otherTraits['stripeCustomerId'])
    : null;

  await db.exec(
    `UPDATE end_users SET
       email_ciphertext = COALESCE($3, email_ciphertext),
       email_key_id     = COALESCE($4, email_key_id),
       email_type       = COALESCE($5, email_type),
       name_traits_ciphertext = COALESCE($6, name_traits_ciphertext),
       name_traits_key_id     = COALESCE($7, name_traits_key_id),
       traits           = end_users.traits || $8::jsonb,
       created_at       = COALESCE($9, end_users.created_at),
       trial_started_at = COALESCE($10, end_users.trial_started_at),
       trial_ends_at    = COALESCE($11, end_users.trial_ends_at),
       card_required    = COALESCE($12, end_users.card_required),
       stripe_customer_id = COALESCE($13, end_users.stripe_customer_id),
       internal  = end_users.internal  OR COALESCE($14, false),
       opted_out = end_users.opted_out OR COALESCE($15, false),
       last_event_at = GREATEST(end_users.last_event_at, $16)
     WHERE project_id = $1 AND user_key = $2`,
    [
      db.projectId,
      userKey,
      emailCipher?.bytes ?? null,
      emailCipher?.keyId ?? null,
      email ? classifyEmail(email) : null,
      nameCipher?.bytes ?? null,
      nameCipher?.keyId ?? null,
      JSON.stringify(stripOwn(otherTraits)),
      pickDate(otherTraits['createdAt']),
      pickDate(otherTraits['trialStartedAt']),
      pickDate(otherTraits['trialEndsAt']),
      pickBoolean(otherTraits['cardRequired']),
      stripeCustomerId,
      pickBoolean(otherTraits['internal']),
      pickBoolean(otherTraits['optedOut']),
      at,
    ],
  );
}

/** Traits lifted into their own columns are not duplicated in the JSONB bag. */
function stripOwn(traits: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...traits };
  for (const key of [
    'createdAt',
    'trialStartedAt',
    'trialEndsAt',
    'cardRequired',
    'stripeCustomerId',
    'internal',
    'optedOut',
  ]) {
    delete copy[key];
  }
  return copy;
}

export async function resolveAccount(
  db: ScopedDb,
  groupId: string,
  traits: Record<string, unknown>,
  at: Date,
): Promise<number> {
  const row = await db.one<{ id: number }>(
    `INSERT INTO accounts (project_id, external_id, name, domain, plan, seats, traits, first_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (project_id, external_id) DO UPDATE SET
       name   = COALESCE(EXCLUDED.name, accounts.name),
       domain = COALESCE(EXCLUDED.domain, accounts.domain),
       plan   = COALESCE(EXCLUDED.plan, accounts.plan),
       seats  = COALESCE(EXCLUDED.seats, accounts.seats),
       traits = accounts.traits || EXCLUDED.traits
     RETURNING id`,
    [
      db.projectId,
      groupId,
      pickString(traits['name']),
      pickString(traits['domain']),
      pickString(traits['plan']),
      pickInteger(traits['seats']),
      JSON.stringify(traits),
      at,
    ],
  );
  return row.id;
}

export async function addAccountMember(
  db: ScopedDb,
  accountId: number,
  userKey: number,
  traits: Record<string, unknown>,
  at: Date,
): Promise<void> {
  await db.exec(
    `INSERT INTO account_members (project_id, account_id, user_key, role, joined_via, joined_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (project_id, account_id, user_key) DO UPDATE SET
       role       = COALESCE(EXCLUDED.role, account_members.role),
       joined_via = COALESCE(EXCLUDED.joined_via, account_members.joined_via)`,
    [
      db.projectId,
      accountId,
      userKey,
      pickString(traits['role']),
      pickString(traits['joinedVia']),
      at,
    ],
  );
  await db.exec(
    `UPDATE end_users SET account_id = $3 WHERE project_id = $1 AND user_key = $2 AND account_id IS NULL`,
    [db.projectId, userKey, accountId],
  );
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, 512) : null;
}
function pickInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}
function pickBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
function pickDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
