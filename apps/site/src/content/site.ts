/**
 * The landing page's facts, as data.
 *
 * One source for everything that appears in more than one place — the page, the
 * JSON-LD and the checks — so they cannot drift apart. Every product fact here comes
 * from the Ground Truth (v2, 3 Nov 2026) and is checked against the code; the file that
 * proves each group is named beside it. When the product changes, change it here, then
 * update content/index.body.md and run `pnpm site:markdown`.
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
  /** Read at build time. Empty = "Claim a founding seat" goes to the waitlist form. */
  foundingSeatUrl: process.env.NEXT_PUBLIC_FOUNDING_SEAT_URL ?? '',
  /** The date every page on the site was last reviewed against the Ground Truth. */
  updated: '2026-11-11',
} as const;

/**
 * One sentence that says what Dripmetric is. The hero, the footer, the JSON-LD and
 * llms.txt all start from it, because an answer engine describes a product the way
 * the product most consistently describes itself (apps/site/LAUNCH.md §4).
 */
export const DEFINITION = 'Dripmetric is a revenue-leak detector for self-serve SaaS.';

/** The one action on the site, worded the same everywhere it appears. */
export const CTA_LABEL = 'Join the waitlist';

/** Measured on the shipping code — Ground Truth appendix, "Measured". */
export const FACTS = [
  { value: '9', label: 'leak rules, each one written so you can read it' },
  { value: '5 KB', label: 'browser SDK: 5,018 bytes gzipped. The build fails past 5,120.' },
  { value: '76', label: 'canonical events, from Signed Up to Payment Failed' },
  { value: '0', label: 'billing integrations to set up' },
] as const;

export interface Leak {
  /** The anchor on /leaks, which explains the rule in full. */
  id: string;
  name: string;
  /** The rule text from packages/engine/src/leaks/types.ts, unchanged. */
  rule: string;
}
export interface LeakStage {
  id: string;
  title: string;
  /** The one rule printed in full on the home page. */
  featured: Leak;
  /** The stage's other leaks, named and linked. */
  also: Leak[];
}

/**
 * The nine leaks, by where in the journey they happen.
 *
 * packages/engine/src/leaks/types.ts holds the rules; `pnpm site:check` fails if one of
 * them stops matching the text here. Four need product events only (onboarding stall,
 * step completion collapse, pricing quick exit, cancelled or payment failed); the other
 * five switch on with one paid event.
 */
export const LEAK_STAGES: LeakStage[] = [
  {
    id: 'activate',
    title: 'Before they activate',
    featured: {
      id: 'onboarding-stall',
      name: 'Onboarding stall',
      rule: 'Someone entered a step and made no progress for longer than the step allows — 24 hours by default, or the step’s own slowest tenth once 20 people have finished it.',
    },
    also: [
      {
        id: 'step-collapse',
        name: 'Step completion collapse',
        rule: 'A step’s completions in the last 24 hours fell so far below its own 14-day rate that chance does not explain it.',
      },
    ],
  },
  {
    id: 'pay',
    title: 'Before they pay',
    featured: {
      id: 'high-intent-quiet',
      name: 'High-intent user went quiet',
      rule: 'Someone reached 60 or more on buying intent, then went 7 days without doing anything, and never paid.',
    },
    also: [
      {
        id: 'pricing-quick-exit',
        name: 'Pricing quick exit',
        rule: 'Someone opened your pricing page for the first time, glanced at it and left.',
      },
      {
        id: 'last-moment-drop',
        name: 'Last-moment drop',
        rule: 'Someone started checkout and no payment arrived within 2 hours. A trial-only checkout does not count.',
      },
      {
        id: 'trial-ended-unpaid',
        name: 'Trial ended unpaid',
        rule: 'Their trial end date passed and no payment arrived.',
      },
      {
        id: 'limit-reached',
        name: 'Limit reached, no upgrade',
        rule: 'They hit a limit of their plan and did not upgrade within 7 days.',
      },
    ],
  },
  {
    id: 'stay',
    title: 'After they pay',
    featured: {
      id: 'payer-going-quiet',
      name: 'Payer going quiet',
      rule: 'A paying customer’s active days halved or worse against their own 4-week baseline, two weeks running.',
    },
    also: [
      {
        id: 'cancelled-or-failed',
        name: 'Cancelled or payment failed',
        rule: 'They cancelled, or a payment failed.',
      },
    ],
  },
];

export interface Plan {
  id: 'free' | 'starter' | 'founding';
  name: string;
  /** Whole US dollars, for display and for the JSON-LD offer. */
  price: number;
  per: string;
  /** How the JSON-LD prices it. */
  billing: 'free' | 'MON' | 'ANN';
  /** Shown on the home page. The founding seat is offered on /pricing only. */
  onHome: boolean;
  /** One sentence: what this plan answers. */
  includes: string;
}

/**
 * Ground Truth "Pricing & packaging" (28 Oct 2026 decision). The full table, list
 * prices and add-ons are on /pricing (content/pages/pricing.md).
 */
export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    per: 'forever',
    billing: 'free',
    onHome: true,
    includes:
      'The full funnel and step timing, the buying-intent score, all nine leaks, masked alerts to Slack or Discord, and a weekly leak report.',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 39,
    per: 'a month at launch',
    billing: 'MON',
    onHome: true,
    // Only what is built: reveal_identity and why_signals are wired in the code.
    includes:
      'Everything in Free, plus the name, email and id behind every masked tag, and the signals behind each score.',
  },
  {
    id: 'founding',
    name: 'Founding seat',
    price: 390,
    per: 'a year, locked for life',
    billing: 'ANN',
    onHome: false,
    includes: 'A full year of Starter for the first 25 founders, with a guided setup call.',
  },
];

/** Starter's yearly option, shown beside its monthly price and offered in the JSON-LD. */
export const STARTER_YEARLY = { price: 390 } as const;
