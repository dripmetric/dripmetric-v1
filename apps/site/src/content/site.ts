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
  updated: '2026-11-25',
} as const;

/**
 * One sentence that says what Dripmetric is. The hero, the footer, the JSON-LD and
 * llms.txt all start from it, because an answer engine describes a product the way
 * the product most consistently describes itself (apps/site/LAUNCH.md §4).
 */
export const DEFINITION = 'Dripmetric is a revenue-leak detector for self-serve SaaS.';

/** The one action on the site, worded the same everywhere it appears. */
export const CTA_LABEL = 'Join the waitlist';

/**
 * How much the public site says (docs/decisions.md, 2026-11-21).
 *
 * The founder's call: public pages stay general. They say what Dripmetric watches for
 * and why it matters, and link outside research for the "why". The exact rules,
 * thresholds, intent points and the full event list are for invited founders only.
 * `pnpm site:check` fails if an engine rule sentence appears on a public page, so the
 * detail cannot drift back in by accident.
 */

export interface LeakStage {
  id: string;
  title: string;
  /** One plain sentence: what goes wrong at this stage, with no rule or threshold. */
  line: string;
}

/** The nine leaks, by where in the journey they happen. /leaks names each one. */
export const LEAK_STAGES: LeakStage[] = [
  {
    id: 'activate',
    title: 'Before they activate',
    line: 'New signups stall in onboarding and never reach the moment the product clicks.',
  },
  {
    id: 'pay',
    title: 'Before they pay',
    line: 'People who look ready to buy hesitate at pricing, checkout or the end of a trial.',
  },
  {
    id: 'stay',
    title: 'After they pay',
    line: 'Paying customers drift away, or a payment fails and nobody notices.',
  },
];

export interface Finding {
  id: string;
  /** What the research found, in a sentence a founder can repeat. */
  finding: string;
  /** Who published it, and when. */
  source: string;
  url: string;
}

/**
 * Why the problem matters, from outside research rather than our own examples.
 *
 * Each figure was checked against its source on the date in docs/decisions.md and is
 * shown with who published it. They are third-party numbers, never Dripmetric data.
 * The benchmark guide (content/pages/guides/trial-to-paid-conversion.md) cites the same
 * two reports in full.
 */
export const RESEARCH: Finding[] = [
  {
    id: 'activation',
    finding:
      'Most new users never reach the point where the product works for them: the average activation rate across 62 B2B SaaS companies was 37.5%.',
    source: 'Userpilot, SaaS Product Metrics Benchmark Report 2025',
    url: 'https://userpilot.com/saas-product-metrics/',
  },
  {
    id: 'conversion',
    finding:
      'Most trials end without a payment: the median free-to-paid conversion rate across 200 software products was 8%.',
    source: 'Kyle Poyar with ChartMogul and ProductLed, The SaaS Conversion Report, February 2026',
    url: 'https://chartmogul.com/reports/saas-conversion-report/',
  },
  {
    id: 'failed-payments',
    finding:
      'About a third of SaaS churn is a payment that failed, not a customer who chose to leave.',
    source: 'Recurly, churn rate benchmarks, July 2026 data',
    url: 'https://www.recurly.com/research/churn-rate-benchmarks',
  },
];

export interface Feature {
  id: string;
  title: string;
  body: string;
}

/**
 * What a founder gets once a leak is found, said generally (the specifics are for
 * invited founders). Only what is built and tested:
 *  - alerts: packages/ingest/src/alerts (Slack and Discord, the in-app feed, 10 a day,
 *    quiet hours) — M10;
 *  - the Monday report: packages/engine/src/reports/weekly.ts — M10;
 *  - the score: packages/engine/src/intent/points.ts — M7;
 *  - the dollar figure: settled decision 14, formula always on screen — M8;
 *  - tracking health: packages/engine/src/health/checks.ts — M11;
 *  - before-and-after: the Changes comparison, 100 people per window — M10.
 * Nothing here contacts the founder's users: nudges and recovery are later layers that
 * are not built (docs/publishing.md, "What is not built").
 */
export const FEATURES: Feature[] = [
  {
    id: 'alerts',
    title: 'An alert when it matters',
    body: 'In Slack or Discord, and in the app, saying what leaked and what is at stake.',
  },
  {
    id: 'report',
    title: 'A leak report every Monday',
    body: 'Your biggest leak, who looked ready to buy and didn’t, and how your last change is doing.',
  },
  {
    id: 'money',
    title: 'What each leak is worth',
    body: 'Valued at your own prices, with the working shown beside the number.',
  },
  {
    id: 'intent',
    title: 'Who is closest to buying',
    body: 'A buying-intent score for every user, so you know who to look at first.',
  },
  {
    id: 'health',
    title: 'A warning when tracking breaks',
    body: 'If an event stops arriving or changes, you hear about it. Broken tracking never looks like users leaving.',
  },
  {
    id: 'proof',
    title: 'Proof your fix worked',
    body: 'Mark a change and see whether it made a difference, measured fairly before and after.',
  },
];
