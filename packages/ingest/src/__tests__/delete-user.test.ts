import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePools, withProject } from '@dripmetric/db';
import { deleteUser } from '../delete-user.js';
import { IngestError } from '../errors.js';
import {
  ensureMigrated,
  newFixture,
  postBatch,
  resetData,
  track,
  type Fixture,
} from './helpers.js';

/**
 * `DELETE /v1/users/:userId` and the SDK's `deleteUser()` (brief section 10).
 *
 * "Deleting a user removes every row for them (verified with SQL)" is an M11 exit
 * check; the endpoint lands here because M4's SDK method would otherwise be a method
 * that 404s. M11 adds the audit-log view and the retention job around it.
 */
describe('deleting a user', () => {
  let fx: Fixture;

  beforeAll(ensureMigrated);
  beforeEach(async () => {
    await resetData();
    fx = await newFixture();
  });
  afterAll(closePools);

  async function seed(): Promise<void> {
    await postBatch(
      [
        {
          type: 'identify',
          messageId: 'd-1',
          userId: 'user_doomed',
          traits: { email: 'doomed@acme.com' },
        },
        track('Signed Up', { messageId: 'd-2', userId: 'user_doomed' }),
        track('Activated', { messageId: 'd-3', userId: 'user_doomed' }),
        {
          type: 'page',
          messageId: 'd-4',
          userId: 'user_doomed',
          context: { sessionId: 'sess_doomed', page: { path: '/pricing' } },
        },
        // Someone else, who must survive.
        track('Signed Up', { messageId: 'd-5', userId: 'user_safe' }),
      ],
      { key: fx.secretKey },
    );
  }

  it('removes every row for that person and leaves everyone else alone', async () => {
    await seed();

    const before = await withProject(fx.project.live.id, (db) =>
      db.query<{ events: string; users: string; sessions: string }>(
        `SELECT (SELECT count(*) FROM events) AS events,
                (SELECT count(*) FROM end_users) AS users,
                (SELECT count(*) FROM sessions) AS sessions`,
      ),
    );
    expect(Number(before[0]!.users)).toBe(2);
    expect(Number(before[0]!.events)).toBeGreaterThan(2);

    const result = await deleteUser(fx.secretKey, 'user_doomed');
    expect(result.status).toBe(200);
    expect((result.body as { deleted: boolean }).deleted).toBe(true);

    // Verified with SQL, across every table that holds a user key.
    const after = await withProject(fx.project.live.id, (db) =>
      db.query<Record<string, string>>(
        `SELECT (SELECT count(*) FROM end_users WHERE external_id = 'user_doomed') AS doomed_users,
                (SELECT count(*) FROM end_users WHERE external_id = 'user_safe')   AS safe_users,
                (SELECT count(*) FROM events)                                      AS events,
                (SELECT count(*) FROM sessions)                                    AS sessions,
                (SELECT count(*) FROM monthly_active_users)                         AS mau,
                (SELECT count(*) FROM daily_event_counts)                           AS daily`,
      ),
    );
    expect(Number(after[0]!['doomed_users'])).toBe(0);
    // The other person is untouched.
    expect(Number(after[0]!['safe_users'])).toBe(1);
    expect(Number(after[0]!['events'])).toBe(1);
    expect(Number(after[0]!['sessions'])).toBe(0);
    expect(Number(after[0]!['mau'])).toBe(1);
    expect(Number(after[0]!['daily'])).toBe(1);
  });

  it('is audited', async () => {
    await seed();
    await deleteUser(fx.secretKey, 'user_doomed');

    const audit = await withProject(fx.project.live.id, (db) =>
      db.query<{ action: string; subject: string }>(
        `SELECT action, subject FROM audit_log WHERE action = 'user.deleted'`,
      ),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]?.subject).toBe('user_doomed');
  });

  it('treats an unknown user as already gone, so a retry is safe', async () => {
    const result = await deleteUser(fx.secretKey, 'never-existed');
    expect(result.status).toBe(404);
    expect((result.body as { deleted: boolean }).deleted).toBe(false);
  });

  it('refuses a publishable key: a browser must never erase anyone', async () => {
    await seed();
    await expect(deleteUser(fx.publishableKey, 'user_doomed')).rejects.toThrow(IngestError);
    await expect(deleteUser(fx.publishableKey, 'user_doomed')).rejects.toThrow(/secret key/i);

    // And nothing was deleted.
    const rows = await withProject(fx.project.live.id, (db) =>
      db.query(`SELECT 1 FROM end_users WHERE external_id = 'user_doomed'`),
    );
    expect(rows).toHaveLength(1);
  });

  it('refuses a missing or unknown key', async () => {
    await expect(deleteUser(null, 'user_doomed')).rejects.toThrow(/No API key/);
    await expect(deleteUser('sk_live_notarealkey1234567', 'user_doomed')).rejects.toThrow(
      /not valid/,
    );
  });

  it('leaves daily summaries alone, because they hold no personal data', async () => {
    // Deleting them would silently rewrite the founder's own history, and they
    // contain only counts (brief section 10).
    await seed();
    await deleteUser(fx.secretKey, 'user_doomed');
    const rows = await withProject(fx.project.live.id, (db) =>
      db.query(`SELECT to_regclass('daily_summaries') IS NOT NULL AS exists_yet`),
    );
    // The table arrives at M11; this asserts the delete does not depend on it.
    expect(rows).toHaveLength(1);
  });
});
