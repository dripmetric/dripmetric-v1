/**
 * The landing page's facts, as data.
 *
 * One source for everything that appears in more than one place — the page, the
 * JSON-LD and the checks — so they cannot drift apart. Every product fact here comes
 * from the Ground Truth (v2, 3 Nov 2026) and is checked against the code on
 * `v2-observe`; the file that proves each group is named beside it. When the product
 * changes, change it here, then update content/index.body.md and run
 * `pnpm site:markdown`.
 */
import inventory from '../../content/inventory.json';

const pages = inventory.pages.filter((page) => page.disposition === 'publish');
const urlOf = (id: string): string => {
  const page = pages.find((p) => p.id === id);
  if (!page) throw new Error(`content/inventory.json has no published page "${id}"`);
  return page.url;
};

export const SITE = {
  name: 'Dripmetric',
  origin: inventory.origin,
  homeUrl: urlOf('home'),
  privacyUrl: urlOf('privacy'),
  contactEmail: 'hello@dripmetric.com',
  /** Read at build time. Empty = the form opens a pre-filled email instead. */
  waitlistEndpoint: process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT ?? '',
  /** Read at build time. Empty = "Claim a founding seat" goes to the sign-up form. */
  foundingSeatUrl: process.env.NEXT_PUBLIC_FOUNDING_SEAT_URL ?? '',
  /** The date every page on the site was last reviewed against the Ground Truth. */
  updated: '2026-11-08',
} as const;

/** Measured on the shipping code — Ground Truth appendix, "Measured". */
export const MEASURED = [
  { value: '5,018 B', label: 'Browser SDK core, gzipped. The build fails past 5,120.' },
  { value: '76', label: 'Canonical events, from Signed Up to Payment Failed' },
  { value: '9', label: 'Leak rules, each one written so you can read it' },
  { value: '8', label: 'Stacks with a ready-made install snippet' },
  { value: '0', label: 'Billing integrations you need to set up' },
] as const;

export interface Leak {
  id: string;
  name: string;
  /** The rule text from packages/engine/src/leaks/types.ts, unchanged. */
  rule: string;
  how: string;
}
export interface LeakGroup {
  id: string;
  title: string;
  badge: string;
  paid: boolean;
  leaks: Leak[];
}

/** packages/engine/src/leaks/types.ts — rules, requirements and alerting, verbatim. */
export const LEAK_GROUPS: LeakGroup[] = [
  {
    id: 'product',
    title: 'Run on product events alone',
    badge: 'Product events',
    paid: false,
    leaks: [
      {
        id: 'onboarding-stall',
        name: 'Onboarding stall',
        rule: 'Someone entered a step and made no progress for longer than the step allows — 24 hours by default, or the step’s own slowest tenth once 20 people have finished it.',
        how: 'Counted per step on your dashboard and in the weekly report.',
      },
      {
        id: 'step-collapse',
        name: 'Step completion collapse',
        rule: 'A step’s completions in the last 24 hours fell so far below its own 14-day rate that chance does not explain it.',
        how: 'Instant alert. It is about a step, not a person, so nothing is masked.',
      },
      {
        id: 'pricing-quick-exit',
        name: 'Pricing quick exit',
        rule: 'Someone opened your pricing page for the first time, glanced at it and left.',
        how: 'Shown as a rate by source, device and country.',
      },
    ],
  },
  {
    id: 'event',
    title: 'Fires on its own event',
    badge: 'The event itself',
    paid: false,
    leaks: [
      {
        id: 'cancelled-or-failed',
        name: 'Cancelled or payment failed',
        rule: 'They cancelled, or a payment failed.',
        how: 'Fires whatever sends the event. Counted in your weekly report.',
      },
    ],
  },
  {
    id: 'paid',
    title: 'Switch on with one paid event',
    badge: 'Paid event',
    paid: true,
    leaks: [
      {
        id: 'last-moment-drop',
        name: 'Last-moment drop',
        rule: 'Someone started checkout and no payment arrived within 2 hours. A trial-only checkout does not count.',
        how: 'Instant masked alert.',
      },
      {
        id: 'high-intent-quiet',
        name: 'High-intent user went quiet',
        rule: 'Someone reached 60 or more on buying intent, then went 7 days without doing anything, and never paid.',
        how: 'Instant masked alert.',
      },
      {
        id: 'trial-ended-unpaid',
        name: 'Trial ended unpaid',
        rule: 'Their trial end date passed and no payment arrived.',
        how: 'Instant masked alert. Also needs your trial end dates.',
      },
      {
        id: 'payer-going-quiet',
        name: 'Payer going quiet',
        rule: 'A paying customer’s active days halved or worse against their own 4-week baseline, two weeks running.',
        how: 'Instant masked alert.',
      },
      {
        id: 'limit-reached',
        name: 'Limit reached, no upgrade',
        rule: 'They hit a limit of their plan and did not upgrade within 7 days.',
        how: 'Instant masked alert.',
      },
    ],
  },
];

/** packages/engine/src/intent/points.ts — every signal and its points. */
export const INTENT_SIGNALS = [
  { signal: 'Started checkout (not a card-up-front trial)', points: '+30' },
  { signal: 'Reached activation', points: '+25' },
  { signal: 'Hit a plan limit or a paywall prompt', points: '+20' },
  { signal: 'Asked to talk to someone', points: '+20' },
  { signal: 'Invited a teammate', points: '+15' },
  { signal: 'Added a card before the trial ended', points: '+15' },
  { signal: 'Read the pricing page', points: '+10' },
  { signal: 'Weighed the plans', points: '+10' },
  { signal: 'Connected an integration or imported data', points: '+10' },
  { signal: 'Did the core action 3+ times in their first 14 days', points: '+10' },
  { signal: 'Active on 3 or more of the last 7 days', points: '+10' },
  { signal: 'Activated faster than your median', points: '+10' },
  { signal: 'Looks like a buyer (fit signals)', points: '+5 each, up to +10' },
  { signal: 'Signed up with a throwaway address', points: '−20' },
] as const;

/** The sample person in the hero alert and the score card. Simulated, and labelled so. */
export const SAMPLE_SCORE = [
  { points: '+25', why: 'Reached activation' },
  { points: '+20', why: 'Hit a limit of their plan' },
  { points: '+10', why: 'Read the pricing page' },
  { points: '+10', why: 'Weighed the plans — second visit, annual toggle' },
  { points: '+10', why: 'Used the core feature 3+ times in their first 14 days' },
] as const;

export interface Plan {
  id: string;
  name: string;
  /** Whole US dollars, for display and for the JSON-LD offer. */
  price: number;
  per: string;
  listPrice?: number;
  pitch: string;
  includes: string[];
  cta: 'access' | 'founding';
  flag?: string;
  /** How the JSON-LD prices it. */
  billing: 'free' | 'MON' | 'ANN';
}

/** Ground Truth "Pricing & packaging" (28 Oct 2026 decision). */
export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    per: 'forever',
    pitch: 'Where and how much revenue leaks.',
    includes: [
      'Full funnel and step timing',
      'Buying-intent score',
      'All nine leaks, masked',
      'Instant masked alerts to Slack or Discord, plus an in-app feed',
      'Weekly leak report',
      'Tracking health and before-and-after proof',
      'Segment splits',
      '90 days of raw events; daily summaries kept forever',
    ],
    cta: 'access',
    billing: 'free',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 39,
    per: 'a month',
    listPrice: 49,
    pitch:
      'Or $390 a year (list $490). Launch price held for 12 months for anyone who starts by 30 June 2027.',
    // Only what is built: reveal_identity and why_signals are wired in the code. The
    // "timeline" and "suggested action per leak" entitlements exist as flags with no UI
    // yet, so they are not promised here.
    includes: [
      'Everything in Free',
      'The name, email and id behind every masked tag',
      'The signals behind each score',
      '13 months of raw events',
    ],
    cta: 'access',
    billing: 'MON',
  },
  {
    id: 'founding',
    name: 'Founding seat',
    price: 390,
    per: 'a year, locked for life',
    pitch: 'Starter’s yearly launch price, locked for life instead of for 12 months.',
    includes: [
      'A full year of Starter',
      'A 45-minute guided setup call',
      'Money back within 30 days of launch',
    ],
    cta: 'founding',
    flag: 'Pre-launch · first 25 founders',
    billing: 'ANN',
  },
];

/** Starter's yearly option, shown in its pitch and offered in the JSON-LD. */
export const STARTER_YEARLY = { price: 390, listPrice: 490 } as const;

export const ADDONS = [
  {
    name: 'Funnel teardown',
    price: 299,
    listPrice: 349,
    what: 'a written teardown of one onboarding funnel, delivered in 48 hours and credited toward a setup.',
  },
  {
    name: 'Concierge setup',
    price: 499,
    listPrice: 599,
    what: 'a fixed-scope, done-for-you setup on a paid plan. A few slots a month.',
  },
] as const;

/** apps/web dashboard modules, in the founder's words. */
export const MODULES = [
  {
    title: 'Where you are losing people',
    body: 'Each leak: open now, new this week, and what it’s worth at your price.',
  },
  {
    title: 'Your funnel',
    body: 'Every step: reached, finished, dropped, typical time, stuck right now.',
  },
  {
    title: 'Who looks ready to buy',
    body: 'People at high intent, and how many of them haven’t paid.',
  },
  { title: 'Checkout', body: 'Started, abandoned — and last-moment drops still worth chasing.' },
  { title: 'Do they come back', body: 'How many return after signing up.' },
  { title: 'Paying customers going quiet', body: 'Payers whose usage is falling, and since when.' },
  {
    title: 'Is the tracking healthy',
    body: 'Missing events, shape drift, double-sends and late arrivals — so “tracking broke” never looks like “your users vanished”.',
  },
  { title: 'Did your changes work', body: 'Mark a change; see before and after.' },
] as const;

/** Category comparison. Neutral "built for" wording only — dated, see the footnote. */
export const COMPARISON = [
  {
    category: 'Product analytics',
    builtFor: 'Exploring any event data — you build the funnels, queries and alerts',
    examples: 'PostHog, Mixpanel, Amplitude',
    approach:
      'Nine leak rules and an intent score ready on day one, over product and payment events',
  },
  {
    category: 'Lifecycle email',
    builtFor: 'Sending behavioural email journeys',
    examples: 'Customer.io, Loops, Encharge',
    approach: 'Sends nothing to your users; shows you where and who first',
  },
  {
    category: 'In-app onboarding',
    builtFor: 'Tours, checklists and prompts inside your app',
    examples: 'Appcues, Userpilot, Chameleon',
    approach: 'Adds no UI to your product; measures whether onboarding converts',
  },
  {
    category: 'Churn and payment recovery',
    builtFor: 'Retrying failed cards, dunning, cancel flows',
    examples: 'Churnkey, Churn Buster, Baremetrics Recover',
    approach: 'Watches the whole path before a card ever fails, too',
  },
] as const;

export const CAPABILITIES = [
  ['Funnel, step timing, cohorts, segment splits', 'Full', '—'],
  ['Buying-intent score, every band', 'Full', '—'],
  ['Onboarding stall, step collapse, pricing quick exit', 'Full', '—'],
  ['Tracking health, before-and-after proof', 'Full', '—'],
  ['Cancelled or payment failed', 'Fires on the event, whatever sends it', '—'],
  ['Dashboard modules', '5 of 8', 'All 8'],
  [
    'Last-moment drop, high-intent quiet, payer going quiet, limit reached',
    '—',
    'With a declared paid event',
  ],
  ['Trial ended unpaid', '—', 'Paid event + trial dates'],
  ['A dollar figure on every leak', '—', 'Your list price'],
] as const;

export const STACKS = [
  'Next.js App Router',
  'Node/Express',
  'Django',
  'Flask',
  'Rails',
  'Laravel',
  'Go net/http',
  'Plain HTTP',
] as const;
