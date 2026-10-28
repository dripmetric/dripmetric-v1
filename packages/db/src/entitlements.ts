import type { ScopedDb, UnscopedDb } from './scope.js';

/**
 * can(project, feature) — the single server-side gate (brief section 2).
 *
 * Masking is a commercial gate, not a privacy control: the founder owns the data.
 * That makes it OUR job to be airtight, so every serializer asks this one function
 * rather than reading a plan string. A free project's API responses never contain an
 * email, name, user id or trait for any person.
 */
export const FEATURES = [
  /** Names, emails, traits and the full timeline instead of a masked tag. */
  'reveal_identity',
  /** The signals behind each intent score. */
  'why_signals',
  /** A suggested action per leak (the nudges themselves are a later layer). */
  'suggested_actions',
  'full_timeline',
  'cohort_table',
  /** Free in the latest plan (brief section 2). */
  'segment_splits',
  'instant_alerts',
  'weekly_report',
  'tracking_health',
  'change_proof',
] as const;
export type Feature = (typeof FEATURES)[number];

export const LIMITS = [
  'retention_days',
  /** How many individual names a free project may reveal. Default 0. */
  'reveal_allowance',
  'change_window_days_max',
  'instant_alerts_per_day',
] as const;
export type Limit = (typeof LIMITS)[number];

export interface Entitlements {
  planCode: string;
  features: Readonly<Record<Feature, boolean>>;
  limits: Readonly<Record<Limit, number>>;
}

interface PlanRow {
  plan_code: string;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  settings: Record<string, unknown>;
}

const SQL = `
  SELECT p.plan_code, pl.features, pl.limits, p.settings
    FROM projects p
    JOIN plans pl ON pl.code = p.plan_code
   WHERE p.id = $1 AND p.deleted_at IS NULL
`;

/** Reads the project's plan and folds in any per-project override. */
export async function entitlements(db: ScopedDb): Promise<Entitlements> {
  const row = await db.one<PlanRow>(SQL, [db.projectId]);
  return foldEntitlements(row);
}

/** The same, for the worker sweeping a project it has already resolved. */
export async function entitlementsFor(db: UnscopedDb, projectId: number): Promise<Entitlements> {
  const row = await db.one<PlanRow>(SQL, [projectId]);
  return foldEntitlements(row);
}

function foldEntitlements(row: PlanRow): Entitlements {
  const features = Object.fromEntries(
    FEATURES.map((f) => [f, row.features[f] === true]),
  ) as Record<Feature, boolean>;

  const limits = Object.fromEntries(
    LIMITS.map((l) => [l, typeof row.limits[l] === 'number' ? row.limits[l] : 0]),
  ) as Record<Limit, number>;

  // A per-project reveal allowance overrides the plan's, which is how a free project
  // can be given a handful of names without changing its plan (brief section 2).
  const override = row.settings['revealAllowance'];
  if (typeof override === 'number' && limits.reveal_allowance !== -1) {
    limits.reveal_allowance = override;
  }
  return { planCode: row.plan_code, features, limits };
}

/** The gate itself. Everything that could leak identity asks this. */
export function can(e: Entitlements, feature: Feature): boolean {
  return e.features[feature];
}

/** -1 means no limit. */
export function limitOf(e: Entitlements, limit: Limit): number {
  return e.limits[limit];
}

export function isUnlimited(value: number): boolean {
  return value === -1;
}
