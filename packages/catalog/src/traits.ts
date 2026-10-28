import type { CatalogTrait } from './types.js';

/**
 * Identity and account traits (brief Appendix A, section B).
 * `identify()` at signup and on each app load; traits are sent only when they change.
 * `group()` ties users to accounts for team products.
 */
export const CATALOG_TRAITS: readonly CatalogTrait[] = [
  { key: 'userId', expectation: 'always', scope: 'user', job: 'The stable key that joins anonymous visits to the person.' },
  {
    key: 'email',
    expectation: 'always',
    scope: 'user',
    job: 'Its type is derived (work, free, education, disposable); the address is stored encrypted. Intent: work +5 inside the fit cap, disposable -20.',
  },
  { key: 'createdAt', expectation: 'always', scope: 'user', job: 'Account age and trial day.' },
  { key: 'emailVerified', expectation: 'recommended', scope: 'user', job: 'Funnel step and filter.' },
  {
    key: 'signupMethod',
    expectation: 'recommended',
    scope: 'user',
    job: 'Splits; diagnosis. email | google | github | sso | magic link.',
  },
  { key: 'plan', expectation: 'conditional', scope: 'user', job: 'The trial clock and the paid state.' },
  { key: 'trialStartedAt', expectation: 'conditional', scope: 'user', job: 'The trial clock.' },
  { key: 'trialEndsAt', expectation: 'conditional', scope: 'user', job: 'The "trial ended unpaid" leak.' },
  { key: 'cardRequired', expectation: 'conditional', scope: 'user', job: 'Whether the trial began with a card: the Payment Method Added signal depends on it.' },
  {
    key: 'stripeCustomerId',
    expectation: 'conditional',
    scope: 'user',
    serverOnly: true,
    job: 'Joins billing events to the person, and the join key to the later Stripe layer. SERVER ONLY.',
  },
  { key: 'role', expectation: 'conditional', scope: 'user', job: 'Alert routing (invited members rarely buy); the account score. owner | admin | member.' },
  { key: 'joinedVia', expectation: 'conditional', scope: 'user', job: 'self | invite.' },
  { key: 'jobRole', expectation: 'optional', scope: 'user', job: 'Splits; intent once calibrated. Only if onboarding asks.' },
  { key: 'teamSize', expectation: 'optional', scope: 'user', job: 'Splits; intent once calibrated.' },
  { key: 'companySize', expectation: 'optional', scope: 'user', job: 'Splits; intent once calibrated.' },
  { key: 'useCase', expectation: 'optional', scope: 'user', job: 'Splits; intent once calibrated.' },
  { key: 'heardAboutUs', expectation: 'optional', scope: 'user', job: 'Splits; intent once calibrated.' },
  { key: 'internal', expectation: 'optional', scope: 'user', job: 'Keeps the founder’s own team out of every number.' },
  { key: 'optedOut', expectation: 'optional', scope: 'user', job: 'No alerts about this person (brief section 8.3).' },
  { key: 'name', expectation: 'conditional', scope: 'account', job: 'Account funnels and scores. From group().' },
  { key: 'domain', expectation: 'conditional', scope: 'account', job: 'Account funnels and scores. From group().' },
  { key: 'plan', expectation: 'conditional', scope: 'account', job: 'Value at risk.' },
  { key: 'seats', expectation: 'conditional', scope: 'account', job: 'Value at risk; seat growth.' },
  { key: 'monthlyRevenue', expectation: 'conditional', scope: 'account', job: 'Value at risk. Minor units plus a currency code.' },
  { key: 'createdAt', expectation: 'conditional', scope: 'account', job: 'Account age.' },
];

/**
 * Traits a publishable (browser) key may never set. Brief section 5.
 * A visitor must not be able to claim they are a Stripe customer.
 */
export const SERVER_ONLY_TRAITS: ReadonlySet<string> = new Set(
  CATALOG_TRAITS.filter((t) => t.serverOnly).map((t) => t.key),
);

/** Email types we derive from the address. The address itself is stored encrypted. */
export const EMAIL_TYPES = ['work', 'free', 'education', 'disposable'] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];
