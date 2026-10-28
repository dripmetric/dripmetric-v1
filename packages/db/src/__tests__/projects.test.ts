import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { adminClient, ensureMigrated, truncateAll } from './helpers.js';
import { createProject, currentProject, listKeys, maskingSecret } from '../projects.js';
import { withProject } from '../scope.js';
import { closePools } from '../pool.js';
import { keyLookupHash } from '../keys.js';
import { defaultSettings } from '../settings.js';

describe('project creation (brief sections 4 and 9)', () => {
  beforeAll(ensureMigrated);
  beforeEach(truncateAll);
  afterAll(closePools);

  it('creates a live project, a test sibling and four keys', async () => {
    const created = await createProject({ name: 'Acme' });

    expect(created.live.mode).toBe('live');
    expect(created.test.mode).toBe('test');
    expect(created.test.liveProjectId).toBe(created.live.id);
    expect(created.test.name).toBe('Acme (test)');

    // Test traffic feeds the sibling, so staging never lands in production numbers.
    expect(created.keys.map((k) => `${k.kind}/${k.mode}`).sort()).toEqual([
      'publishable/live',
      'publishable/test',
      'secret/live',
      'secret/test',
    ]);
  });

  it('shows a secret key once and keeps only its hash', async () => {
    const created = await createProject({ name: 'Acme' });
    const secret = created.keys.find((k) => k.kind === 'secret' && k.mode === 'live');
    expect(secret?.token).toMatch(/^sk_live_/);

    const stored = await withProject(created.live.id, listKeys);
    const storedSecret = stored.find((k) => k.kind === 'secret' && k.mode === 'live');
    // Never retrievable again: the dashboard can only offer to rotate it.
    expect(storedSecret?.token).toBeNull();
    expect(storedSecret?.lastFour).toBe(secret?.token.slice(-4));

    // The hash is what ingest looks up.
    const client = await adminClient();
    try {
      const { rows } = await client.query<{ lookup_hash: Buffer }>(
        `SELECT lookup_hash FROM api_keys WHERE id = $1`,
        [storedSecret?.id],
      );
      expect(rows[0]?.lookup_hash.equals(keyLookupHash(secret!.token))).toBe(true);
    } finally {
      await client.end();
    }
  });

  it('keeps a publishable key readable, because it is public by design', async () => {
    const created = await createProject({ name: 'Acme' });
    const stored = await withProject(created.live.id, listKeys);
    const publishable = stored.find((k) => k.kind === 'publishable' && k.mode === 'live');
    // It sits in the founder's HTML, so we keep it to show the snippet again.
    expect(publishable?.token).toMatch(/^pk_live_/);
  });

  it('gives every project its own masking secret', async () => {
    const a = await createProject({ name: 'A' });
    const b = await createProject({ name: 'B' });

    const secretA = await withProject(a.live.id, maskingSecret);
    const secretB = await withProject(b.live.id, maskingSecret);
    expect(secretA).toHaveLength(32);
    expect(secretA.equals(secretB)).toBe(false);
  });

  it('starts with the settled defaults from brief section 12', async () => {
    const created = await createProject({ name: 'Acme' });
    const project = await withProject(created.live.id, currentProject);

    expect(project.settings).toEqual(defaultSettings());
    expect(project.settings.didntPayWindowDays).toBe(14); // settled decision 7
    expect(project.settings.consentRequired).toBe(true); // settled decision 13
    expect(project.settings.revealAllowance).toBe(0);
    expect(project.settings.workingHours).toEqual({ startHour: 9, endHour: 18, days: [1, 2, 3, 4, 5] });
    expect(project.settings.quietHours).toEqual({ startHour: 22, endHour: 8 });
    expect(project.settings.dailyRowsPerUserPerEvent).toBe(200);
  });

  it('starts on the free plan', async () => {
    const created = await createProject({ name: 'Acme' });
    expect(created.live.planCode).toBe('free');
  });
});
