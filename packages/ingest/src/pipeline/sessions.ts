import type { ScopedDb } from '@dripmetric/db';
import { parseUserAgent, visitorUserAgent } from '../enrich/user-agent.js';
import { normalisePath, referrerDomain, screenBucket } from '../enrich/paths.js';
import type { MessageContextInput } from '@dripmetric/catalog';

/**
 * Sessions carry the context, once (brief section 4). An event row stores a session
 * id, not 18 fields, and that is the difference between ~215 and ~575 bytes per event.
 */

export interface SessionContext {
  /** The country comes from the platform's IP header; the IP is then discarded. */
  country: string | null;
  userAgent: string | undefined;
}

export interface EnsureSessionArgs {
  clientSessionId: string;
  anonKey: number | null;
  userKey: number | null;
  startedAt: Date;
  context: MessageContextInput;
  request: SessionContext;
}

/**
 * Finds or creates the session this message belongs to.
 *
 * A server event has no session of its own. It BORROWS the user's latest browser
 * session, so the founder's server never becomes the user's device or country
 * (brief section 5).
 */
export async function ensureSession(db: ScopedDb, args: EnsureSessionArgs): Promise<number> {
  const context = args.context ?? {};
  const page = context.page ?? {};
  const landing = page.path ?? page.url;
  const normalised = landing ? normalisePath(landing + (page.search ?? '')) : null;

  const ua = parseUserAgent(
    visitorUserAgent(context.userAgent, args.request.userAgent),
    context.userAgentData,
  );
  const campaign = context.campaign ?? {};

  const row = await db.one<{ id: number }>(
    `INSERT INTO sessions (
       project_id, client_session_id, anon_key, user_key, session_number, started_at,
       device_type, os, browser, browser_major, screen_bucket, language, timezone, country,
       referrer_domain, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
       paid_click, paid_network, consent_granted, global_privacy_control,
       library_name, library_version
     ) VALUES (
       $1, $2, $3, $4,
       -- The session NUMBER is derived here, never trusted from the client.
       COALESCE((SELECT max(session_number) + 1 FROM sessions s
                  WHERE s.project_id = $1
                    AND ($3::integer IS NOT NULL AND s.anon_key = $3
                         OR $4::integer IS NOT NULL AND s.user_key = $4)), 1),
       $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
     )
     ON CONFLICT (project_id, client_session_id) DO UPDATE SET
       -- A session that started anonymous and then identified keeps both keys.
       user_key = COALESCE(sessions.user_key, EXCLUDED.user_key),
       anon_key = COALESCE(sessions.anon_key, EXCLUDED.anon_key)
     RETURNING id`,
    [
      db.projectId,
      args.clientSessionId,
      args.anonKey,
      args.userKey,
      args.startedAt,
      ua.deviceType,
      ua.os,
      ua.browser,
      ua.browserMajor,
      screenBucket(context.screen?.width),
      context.locale ?? null,
      context.timezone ?? null,
      args.request.country,
      referrerDomain(page.referrer),
      campaign.source ?? normalised?.campaign.utm_source ?? null,
      campaign.medium ?? normalised?.campaign.utm_medium ?? null,
      campaign.name ?? normalised?.campaign.utm_campaign ?? null,
      campaign.term ?? normalised?.campaign.utm_term ?? null,
      campaign.content ?? normalised?.campaign.utm_content ?? null,
      normalised?.paidClick ?? false,
      normalised?.paidNetwork ?? null,
      context.consent?.granted ?? null,
      context.consent?.globalPrivacyControl ?? null,
      context.library?.name ?? null,
      context.library?.version ?? null,
    ],
  );
  return row.id;
}

/**
 * A server event borrows the user's latest browser session, so its context describes
 * the person's device rather than the founder's data centre.
 */
export async function latestBrowserSession(db: ScopedDb, userKey: number): Promise<number | null> {
  const row = await db.maybeOne<{ id: number }>(
    `SELECT id FROM sessions
      WHERE project_id = $1 AND user_key = $2
      ORDER BY started_at DESC
      LIMIT 1`,
    [db.projectId, userKey],
  );
  return row?.id ?? null;
}
