import { createHmac } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseTlsError, connectionOptions, readCaCertificate } from '../tls.js';
import {
  automationBody,
  closeWaitlistPool,
  forwardToAutomation,
  joinWaitlist,
  markWaitlistForwarded,
  parseWaitlistEntry,
  signAutomationBody,
  waitlistSettings,
  WaitlistUnavailableError,
} from '../waitlist.js';
import {
  countPendingWaitlist,
  exportWaitlistCsv,
  forwardPendingWaitlist,
} from '../waitlist-admin.js';
import { adminClient, ensureMigrated } from './helpers.js';

const env = { SITE_DATABASE_URL: process.env['SITE_DATABASE_URL'] };
const target = { url: 'https://hooks.example.com/waitlist', secret: 's'.repeat(40) };
const NOW = new Date('2026-11-20T10:00:00Z');

async function connectAs(url: string | undefined): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}

/** The Postgres error code a statement fails with, or null when it succeeds. */
async function failsWith(client: pg.Client, sql: string): Promise<string | null> {
  try {
    await client.query(sql);
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown';
  }
}

describe('the waitlist in the database', () => {
  let admin: pg.Client;

  beforeAll(async () => {
    await ensureMigrated();
    admin = await adminClient();
  });
  beforeEach(async () => {
    await admin.query('DELETE FROM waitlist');
  });
  afterAll(async () => {
    await admin.query('DELETE FROM waitlist');
    await admin.end();
    await closeWaitlistPool();
  });

  it('adds an address once, whatever its case', async () => {
    const first = await joinWaitlist({ email: 'Ada@Example.com', source: 'hero' }, env);
    const again = await joinWaitlist({ email: 'ada@example.com', source: 'final' }, env);
    expect(first.id).toEqual(expect.any(Number));
    expect(again.id).toBeNull();
    const { rows } = await admin.query('SELECT email, source, forwarded_at FROM waitlist');
    expect(rows).toEqual([{ email: 'Ada@Example.com', source: 'hero', forwarded_at: null }]);
  });

  it('gives the site role no way to read or change the list', async () => {
    const site = await connectAs(process.env['SITE_DATABASE_URL']);
    try {
      // 42501 = insufficient_privilege.
      expect(await failsWith(site, 'SELECT * FROM waitlist')).toBe('42501');
      expect(
        await failsWith(site, "INSERT INTO waitlist (email, source) VALUES ('a@b.co', 'hero')"),
      ).toBe('42501');
      expect(await failsWith(site, 'UPDATE waitlist SET forwarded_at = now()')).toBe('42501');
      expect(await failsWith(site, 'DELETE FROM waitlist')).toBe('42501');
    } finally {
      await site.end();
    }
  });

  it('gives the site role nothing outside the waitlist', async () => {
    const site = await connectAs(process.env['SITE_DATABASE_URL']);
    try {
      for (const table of ['founder_users', 'projects', 'api_keys', 'plans', 'signup_attempts']) {
        expect(await failsWith(site, `SELECT 1 FROM ${table} LIMIT 1`), table).toBe('42501');
      }
    } finally {
      await site.end();
    }
  });

  it('keeps the founder app role out of the waitlist until the invite flow asks', async () => {
    const app = await connectAs(process.env['DATABASE_URL']);
    try {
      expect(await failsWith(app, 'SELECT * FROM waitlist')).toBe('42501');
      expect(await failsWith(app, "SELECT waitlist_join('a@b.co', 'hero')")).toBe('42501');
    } finally {
      await app.end();
    }
  });

  it('has row-level security on, as a backstop', async () => {
    const { rows } = await admin.query(
      "SELECT relrowsecurity FROM pg_class WHERE relname = 'waitlist'",
    );
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it('marks a fresh address as forwarded once, and never an old one', async () => {
    const { id } = await joinWaitlist({ email: 'grace@example.com', source: 'hero' }, env);
    expect(await markWaitlistForwarded(id!, env)).toBe(true);
    expect(await markWaitlistForwarded(id!, env)).toBe(false);

    const old = await joinWaitlist({ email: 'old@example.com', source: 'hero' }, env);
    await admin.query("UPDATE waitlist SET created_at = now() - interval '1 hour' WHERE id = $1", [
      old.id,
    ]);
    expect(await markWaitlistForwarded(old.id!, env)).toBe(false);
  });

  it('says plainly when the site has no database configured', async () => {
    await expect(joinWaitlist({ email: 'a@b.co', source: 'hero' }, {})).rejects.toBeInstanceOf(
      WaitlistUnavailableError,
    );
  });

  it('sends the backlog oldest first, marks what arrived, and keeps what failed', async () => {
    for (const email of ['one@example.com', 'two@example.com', 'three@example.com']) {
      await joinWaitlist({ email, source: 'hero' }, env);
    }
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const email = JSON.parse(String(init?.body)).email as string;
      seen.push(email);
      return new Response(null, { status: email === 'two@example.com' ? 500 : 202 });
    }) as unknown as typeof fetch;

    const result = await forwardPendingWaitlist(admin, target, {
      now: NOW,
      fetchImpl,
      batchSize: 2,
    });
    expect(result).toEqual({ sent: 2, failed: 1 });
    expect(seen).toEqual(['one@example.com', 'two@example.com', 'three@example.com']);
    expect(await countPendingWaitlist(admin)).toBe(1);
  });

  it('exports CSV a spreadsheet cannot be tricked by', async () => {
    await joinWaitlist({ email: 'plain@example.com', source: 'hero' }, env);
    await joinWaitlist({ email: '=cmd|x@example.com', source: 'final' }, env);
    const { csv, rows } = await exportWaitlistCsv(admin);
    expect(rows).toBe(2);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe('id,email,source,joined_at,forwarded_at');
    expect(lines[1]).toMatch(/^\d+,plain@example\.com,hero,\d{4}-\d\d-\d\dT[\d:.]+Z,$/);
    expect(lines[2]).toContain(",'=cmd|x@example.com,final,");
  });
});

describe('what a visitor sent', () => {
  it('accepts a real address and trims it', () => {
    expect(parseWaitlistEntry({ email: '  ada@example.com ', source: 'hero' })).toEqual({
      ok: true,
      entry: { email: 'ada@example.com', source: 'hero' },
    });
  });

  it('stores an unknown form as "other" rather than refusing the person', () => {
    const parsed = parseWaitlistEntry({ email: 'ada@example.com', source: '<script>' });
    expect(parsed).toEqual({ ok: true, entry: { email: 'ada@example.com', source: 'other' } });
  });

  it.each([
    ['', 'email_invalid'],
    ['not-an-email', 'email_invalid'],
    ['a@b', 'email_invalid'],
    [`${'a'.repeat(250)}@example.com`, 'email_invalid'],
    ['someone@mailinator.com', 'email_disposable'],
  ])('refuses %j', (email, problem) => {
    expect(parseWaitlistEntry({ email, source: 'hero' })).toEqual({ ok: false, problem });
  });

  it('refuses a missing or non-text address', () => {
    expect(parseWaitlistEntry({ source: 'hero' })).toEqual({ ok: false, problem: 'email_invalid' });
    expect(parseWaitlistEntry({ email: ['a@b.co'] })).toEqual({
      ok: false,
      problem: 'email_invalid',
    });
  });
});

describe('the switches', () => {
  it('is closed and sends nothing unless told otherwise', () => {
    expect(waitlistSettings({})).toEqual({
      intake: 'closed',
      automation: null,
      automationProblem: null,
    });
    expect(waitlistSettings({ WAITLIST_INTAKE: 'yes', WAITLIST_AUTOMATION: 'true' }).intake).toBe(
      'closed',
    );
  });

  it('opens on exactly "open"', () => {
    expect(waitlistSettings({ WAITLIST_INTAKE: 'open' }).intake).toBe('open');
  });

  it('turns automation on only with an https URL and a long secret', () => {
    const on = { WAITLIST_AUTOMATION: 'on', WAITLIST_AUTOMATION_URL: target.url };
    expect(
      waitlistSettings({ ...on, WAITLIST_AUTOMATION_SECRET: target.secret }).automation,
    ).toEqual(target);
    expect(waitlistSettings({ ...on, WAITLIST_AUTOMATION_SECRET: 'short' })).toMatchObject({
      automation: null,
      automationProblem: expect.stringContaining('at least 32'),
    });
    expect(
      waitlistSettings({
        ...on,
        WAITLIST_AUTOMATION_URL: 'http://hooks.example.com',
        WAITLIST_AUTOMATION_SECRET: target.secret,
      }),
    ).toMatchObject({ automation: null, automationProblem: expect.stringContaining('https://') });
    // A complete target is still off without the switch.
    expect(
      waitlistSettings({
        WAITLIST_AUTOMATION_URL: target.url,
        WAITLIST_AUTOMATION_SECRET: target.secret,
      }).automation,
    ).toBeNull();
  });
});

describe('the hand-off to the automation', () => {
  const delivery = { id: 7, email: 'ada@example.com', source: 'hero', joinedAt: NOW };

  it('signs the body the way a receiver can check', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(null, { status: 200 }),
    ) as unknown as typeof fetch;
    expect(await forwardToAutomation(delivery, target, { now: NOW, fetchImpl })).toBe(true);

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(target.url);
    const headers = init.headers as Record<string, string>;
    const body = String(init.body);
    expect(JSON.parse(body)).toEqual({
      type: 'waitlist.joined',
      id: 7,
      email: 'ada@example.com',
      source: 'hero',
      joined_at: '2026-11-20T10:00:00.000Z',
    });
    expect(headers['Idempotency-Key']).toBe('waitlist-7');

    // What a receiver does: recompute the HMAC over "<t>.<body>" with the shared secret.
    const [t, v1] = headers['Dripmetric-Signature']!.split(',').map((part) => part.split('=')[1]);
    expect(t).toBe(String(NOW.getTime() / 1000));
    expect(v1).toBe(createHmac('sha256', target.secret).update(`${t}.${body}`).digest('hex'));
    expect(signAutomationBody(automationBody(delivery), target.secret, NOW)).toBe(
      headers['Dripmetric-Signature'],
    );
  });

  it('never throws: a refusal or an outage is just "not sent"', async () => {
    const refused = vi.fn(
      async () => new Response(null, { status: 500 }),
    ) as unknown as typeof fetch;
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect(await forwardToAutomation(delivery, target, { now: NOW, fetchImpl: refused })).toBe(
      false,
    );
    expect(await forwardToAutomation(delivery, target, { now: NOW, fetchImpl: down })).toBe(false);
  });
});

describe('TLS for a connection string', () => {
  const PEM = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
  const remote = 'postgres://u:p@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

  it('verifies against the CA and drops the URL settings that would override it', () => {
    const options = connectionOptions(`${remote}?sslmode=require&uselibpqcompat=true`, {
      caCert: PEM,
    });
    expect(options).toEqual({
      connectionString: remote,
      ssl: { ca: PEM, rejectUnauthorized: true },
    });
  });

  it('refuses a remote database that would connect in plaintext', () => {
    expect(() => connectionOptions(remote, { requireTls: true })).toThrow(DatabaseTlsError);
  });

  it('leaves local and explicitly encrypted connections alone', () => {
    const local = 'postgres://u:p@localhost:54329/dripmetric';
    expect(connectionOptions(local, { requireTls: true })).toEqual({ connectionString: local });
    const explicit = `${remote}?sslmode=verify-full`;
    expect(connectionOptions(explicit, { requireTls: true })).toEqual({
      connectionString: explicit,
    });
  });

  it('reads the certificate as PEM text, escaped newlines, or a file path', () => {
    expect(readCaCertificate(PEM)).toBe(PEM);
    expect(readCaCertificate(PEM.replace(/\n/g, '\\n'))).toBe(PEM);
    const dir = mkdtempSync(join(tmpdir(), 'dm-ca-'));
    const file = join(dir, 'ca.crt');
    writeFileSync(file, PEM);
    expect(readCaCertificate(file)).toBe(PEM);
    expect(() => readCaCertificate(join(dir, 'missing.crt'))).toThrow(DatabaseTlsError);
    // Relative to where the command was typed, not the package folder pnpm runs in.
    const before = process.env['INIT_CWD'];
    process.env['INIT_CWD'] = dir;
    try {
      expect(readCaCertificate('./ca.crt')).toBe(PEM);
    } finally {
      if (before === undefined) delete process.env['INIT_CWD'];
      else process.env['INIT_CWD'] = before;
    }
    expect(readCaCertificate('  ')).toBeUndefined();
  });
});

describe('which databases get development passwords', () => {
  it('only this machine and Docker service names count as local', async () => {
    const { isLocalDatabase } = await import('../tls.js');
    expect(isLocalDatabase('postgres://u:p@localhost:54329/dripmetric')).toBe(true);
    expect(isLocalDatabase('postgres://u:p@127.0.0.1/dripmetric')).toBe(true);
    expect(isLocalDatabase('postgres://u:p@postgres:5432/dripmetric')).toBe(true);
    expect(
      isLocalDatabase(
        'postgresql://postgres.abc:p@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
      ),
    ).toBe(false);
    expect(isLocalDatabase('host=localhost dbname=x')).toBe(false);
  });
});
