import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ensureMigrated, truncateAll } from './helpers.js';
import { createProject, updateSettings } from '../projects.js';
import { withProject, withoutProject } from '../scope.js';
import { closePools } from '../pool.js';
import { can, entitlements, isUnlimited, limitOf } from '../entitlements.js';

/**
 * can(project, feature) is the commercial gate for masking (brief section 2). It is
 * the one function every serializer asks, so these tests matter more than their size
 * suggests: a wrong answer here leaks a name.
 */
describe('entitlements', () => {
  beforeAll(ensureMigrated);
  beforeEach(truncateAll);
  afterAll(closePools);

  it('gives a free project everything except who, why and what to do', async () => {
    const { live } = await createProject({ name: 'Free project' });
    const e = await withProject(live.id, entitlements);

    expect(e.planCode).toBe('free');
    expect(can(e, 'reveal_identity')).toBe(false);
    expect(can(e, 'why_signals')).toBe(false);
    expect(can(e, 'suggested_actions')).toBe(false);
    expect(can(e, 'full_timeline')).toBe(false);
    expect(can(e, 'cohort_table')).toBe(false);

    // Free must be useful on its own, or founders remove the SDK (brief section 2).
    expect(can(e, 'segment_splits')).toBe(true);
    expect(can(e, 'instant_alerts')).toBe(true);
    expect(can(e, 'weekly_report')).toBe(true);
    expect(can(e, 'tracking_health')).toBe(true);
    expect(can(e, 'change_proof')).toBe(true);
  });

  it('keeps free retention at 90 days and paid at 13 months (settled decision 4)', async () => {
    const { live } = await createProject({ name: 'Free project' });
    const free = await withProject(live.id, entitlements);
    expect(limitOf(free, 'retention_days')).toBe(90);

    await withoutProject('admin-script', (db) =>
      db.exec(`UPDATE projects SET plan_code = 'starter' WHERE id = $1`, [live.id]),
    );
    const paid = await withProject(live.id, entitlements);
    expect(limitOf(paid, 'retention_days')).toBe(390);
    expect(can(paid, 'reveal_identity')).toBe(true);
  });

  it('starts the reveal allowance at 0 and lets a per-project override raise it', async () => {
    const { live } = await createProject({ name: 'Free project' });

    const before = await withProject(live.id, entitlements);
    expect(limitOf(before, 'reveal_allowance')).toBe(0);

    // The switch for a later "100 free names" offer. We build the switch, not the offer.
    await withProject(live.id, (db) => updateSettings(db, null, { revealAllowance: 100 }));
    const after = await withProject(live.id, entitlements);
    expect(limitOf(after, 'reveal_allowance')).toBe(100);
  });

  it('does not let a per-project override cap an unlimited paid plan', async () => {
    const { live } = await createProject({ name: 'Paid project' });
    await withoutProject('admin-script', (db) =>
      db.exec(`UPDATE projects SET plan_code = 'starter' WHERE id = $1`, [live.id]),
    );
    await withProject(live.id, (db) => updateSettings(db, null, { revealAllowance: 5 }));

    const e = await withProject(live.id, entitlements);
    expect(isUnlimited(limitOf(e, 'reveal_allowance'))).toBe(true);
  });

  it('writes every settings change to the audit log (brief section 10)', async () => {
    const { live } = await createProject({ name: 'Project' });
    await withProject(live.id, (db) => updateSettings(db, null, { didntPayWindowDays: 21 }));

    const rows = await withProject(live.id, (db) =>
      db.query<{ action: string; details: { changed: string[] } }>(
        `SELECT action, details FROM audit_log WHERE action = 'settings.changed'`,
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.details.changed).toEqual(['didntPayWindowDays']);
  });
});
