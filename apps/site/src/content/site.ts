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
  /**
   * Where the form posts. On Vercel, the site's own endpoint (src/app/api/waitlist),
   * which stores nothing until WAITLIST_INTAKE=open. NEXT_PUBLIC_WAITLIST_ENDPOINT
   * overrides it, and is the only option for the static export, which has no server;
   * with neither, the form opens a pre-filled email. Read at build time.
   */
  waitlistEndpoint:
    process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT ||
    (process.env.NEXT_PUBLIC_STATIC_EXPORT
      ? ''
      : `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/waitlist`),
  /** The date every page on the site was last reviewed against the Ground Truth. */
  updated: '2026-11-18',
} as const;

/**
 * One sentence that says what Dripmetric is. The hero, the footer, the JSON-LD and
 * llms.txt all start from it, because an answer engine describes a product the way
 * the product most consistently describes itself (apps/site/LAUNCH.md §4).
 */
export const DEFINITION = 'Dripmetric is a revenue-leak detector for self-serve SaaS.';

/** The one action on the site, worded the same everywhere it appears. */
export const CTA_LABEL = 'Join the waitlist';

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

export interface Feature {
  id: string;
  title: string;
  body: string;
}

/**
 * What a founder gets once a leak is found. Only what is built and tested:
 *  - alerts: packages/ingest/src/alerts (Slack and Discord, the in-app feed, 10 a day,
 *    quiet hours) — M10;
 *  - the Monday report: packages/engine/src/reports/weekly.ts — M10;
 *  - the score: packages/engine/src/intent/points.ts — M7, rules published on
 *    /buying-intent;
 *  - the dollar figure: settled decision 14, formula always on screen — M8;
 *  - tracking health: packages/engine/src/health/checks.ts — M11;
 *  - before-and-after: the Changes comparison, 100 people per window — M10.
 * Nothing here contacts the founder's users: nudges and recovery are later layers that
 * are not built (docs/publishing.md, "What is not built").
 */
export const FEATURES: Feature[] = [
  {
    id: 'alerts',
    title: 'An alert the moment it matters',
    body: 'Slack or Discord, plus a feed in the app. Each alert names the leak, the person’s buying intent, their plan and what is at stake at your list price. At most 10 a day, held through your quiet hours.',
  },
  {
    id: 'report',
    title: 'A leak report every Monday',
    body: 'Your biggest leak, the people who reached high buying intent and did not pay, and how any change you made is doing. It arrives Monday morning in your timezone.',
  },
  {
    id: 'money',
    title: 'A dollar figure on every leak',
    body: 'The people in a leak times your own list price, with the formula printed beside it. It is labelled potential revenue, because it is a count of people, not money that arrived.',
  },
  {
    id: 'intent',
    title: 'A buying-intent score for every user',
    body: 'From 0 to 100, built from published rules: starting checkout, reaching activation, hitting a plan limit and more. It fades when someone goes quiet.',
  },
  {
    id: 'health',
    title: 'A warning when tracking breaks',
    body: 'If an event stops arriving, changes shape or is sent twice, Dripmetric says so. Broken tracking never looks like users leaving.',
  },
  {
    id: 'proof',
    title: 'Proof your fix worked',
    body: 'Mark a change and Dripmetric compares equal windows before and after, with at least 100 people in each before it calls a result.',
  },
];
