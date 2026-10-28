import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { adminClient, ensureMigrated, truncateAll } from './helpers.js';
import { createProject } from '../projects.js';
import { withProject, withoutProject } from '../scope.js';
import { closePools } from '../pool.js';
import * as publicSurface from '../index.js';

/**
 * M0 exit check: "a test proves a query without a project cannot be written."
 *
 * Two layers, and both are tested, because each catches what the other misses:
 *
 *   1. The API. @dripmetric/db exports no bare `query` and no pool. The only way to
 *      a ScopedDb is inside withProject(), which has already set the scope. A
 *      developer cannot write an unscoped query without going through the named,
 *      logged escape hatch.
 *   2. Row-level security, FORCED, as the backstop. If a query somehow escapes the
 *      helper, it sees nothing rather than another tenant's rows.
 */
describe('tenant scoping (CLAUDE.md invariant 1)', () => {
  beforeAll(ensureMigrated);
  beforeEach(truncateAll);
  afterAll(closePools);

  it('exports no way to run an unscoped query', () => {
    // The package surface is the first line of defence: there is nothing to misuse.
    const exported = Object.keys(publicSurface);
    expect(exported).not.toContain('query');
    expect(exported).not.toContain('pool');
    expect(exported).not.toContain('workerDbPool');

    // withoutProject exists, but it is a named escape hatch with a fixed list of
    // reasons, so each use is a deliberate, reviewable decision.
    expect(exported).toContain('withoutProject');
    expect(publicSurface.CROSS_PROJECT_REASONS).toContain('create-project');
  });

  it('refuses a project id that is not a positive integer', async () => {
    await expect(withProject(0, async () => 1)).rejects.toThrow(/positive integer/);
    await expect(withProject(-5, async () => 1)).rejects.toThrow(/positive integer/);
    await expect(withProject(1.5, async () => 1)).rejects.toThrow(/positive integer/);
  });

  it('shows one project only its own rows, even for a query that forgot the WHERE', async () => {
    const a = await createProject({ name: 'Project A' });
    const b = await createProject({ name: 'Project B' });

    // A deliberately careless query: no project_id filter at all.
    const seenByA = await withProject(a.live.id, (db) =>
      db.query<{ id: number }>('SELECT id FROM projects'),
    );
    const seenByB = await withProject(b.live.id, (db) =>
      db.query<{ id: number }>('SELECT id FROM projects'),
    );

    expect(seenByA.map((r) => r.id)).toEqual([a.live.id]);
    expect(seenByB.map((r) => r.id)).toEqual([b.live.id]);
  });

  it('hides another project’s api_keys and audit_log from a careless query', async () => {
    const a = await createProject({ name: 'Project A' });
    await createProject({ name: 'Project B' });

    const keys = await withProject(a.live.id, (db) =>
      db.query<{ project_id: number }>('SELECT project_id FROM api_keys'),
    );
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys.map((r) => r.project_id))).toEqual(new Set([a.live.id]));

    const audit = await withProject(a.live.id, (db) =>
      db.query<{ project_id: number }>('SELECT project_id FROM audit_log'),
    );
    expect(audit.every((r) => r.project_id === a.live.id)).toBe(true);
  });

  it('refuses to write a row belonging to another project', async () => {
    const a = await createProject({ name: 'Project A' });
    const b = await createProject({ name: 'Project B' });

    await expect(
      withProject(a.live.id, (db) =>
        db.exec(`INSERT INTO audit_log (project_id, action) VALUES ($1, 'forged')`, [b.live.id]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('sees nothing at all on a raw connection with no scope set: deny by default', async () => {
    await createProject({ name: 'Project A' });

    // Straight past the helper, as the application role. This is the backstop.
    const raw = new pg.Client({ connectionString: process.env['DATABASE_URL'] });
    await raw.connect();
    try {
      const projects = await raw.query('SELECT id FROM projects');
      const keys = await raw.query('SELECT id FROM api_keys');
      expect(projects.rows).toHaveLength(0);
      expect(keys.rows).toHaveLength(0);
    } finally {
      await raw.end();
    }
  });

  it('rolls the whole transaction back when the scoped work throws', async () => {
    const a = await createProject({ name: 'Project A' });

    await expect(
      withProject(a.live.id, async (db) => {
        await db.exec(`INSERT INTO audit_log (project_id, action) VALUES ($1, 'half-done')`, [
          a.live.id,
        ]);
        throw new Error('something went wrong halfway');
      }),
    ).rejects.toThrow('something went wrong halfway');

    const rows = await withProject(a.live.id, (db) =>
      db.query(`SELECT id FROM audit_log WHERE action = 'half-done'`),
    );
    expect(rows).toHaveLength(0);
  });

  it('lets the named escape hatch cross projects, which is why it is named', async () => {
    await createProject({ name: 'Project A' });
    await createProject({ name: 'Project B' });

    const all = await withoutProject('worker-sweep', (db) =>
      db.query<{ id: number }>('SELECT id FROM projects WHERE mode = $1', ['live']),
    );
    expect(all).toHaveLength(2);
  });

  it('keeps the application role out of the owner’s seat', async () => {
    const client = await adminClient();
    try {
      const { rows } = await client.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
        'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1',
        ['dripmetric_app'],
      );
      // A superuser, or a role with BYPASSRLS, would walk straight through the policies.
      expect(rows[0]?.rolsuper).toBe(false);
      expect(rows[0]?.rolbypassrls).toBe(false);
    } finally {
      await client.end();
    }
  });
});
