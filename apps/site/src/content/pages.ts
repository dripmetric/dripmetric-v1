/**
 * The guide pages: what each one is for and how it presents itself to search.
 *
 * The words of each page live in content/pages/*.md (the HTML and its Markdown copy
 * are the same file). The canonical URL, title, purpose and review date live in
 * content/inventory.json, which also drives the sitemap, llms.txt and the Markdown
 * maps. This file only adds what the HTML page needs on top: the search-result title
 * and description, the kicker, the schema type and where the page sits.
 *
 * Every page here owns one query family from the SEO research (see the README,
 * "Keeping it true"), and its title, H1 and first paragraph answer that family directly.
 */
import inventory from '../../content/inventory.json';

export type ArticleId = 'leaks' | 'buying-intent' | 'docs' | 'trial-to-paid' | 'posthog';

export interface ArticleMeta {
  id: ArticleId;
  /** The <title>, written for the search result. */
  metaTitle: string;
  /** The meta description: under 160 characters, the answer first. */
  description: string;
  /** Short label above the H1, and the page's name in breadcrumbs. */
  kicker: string;
  /** TechArticle for reference pages and guides; WebPage for anything else. */
  schemaType: 'TechArticle' | 'WebPage';
  /** First published (fixed). The review date is `updated_at` in the inventory. */
  published: string;
  /** Pages this one should send readers to next, by inventory id. */
  related: ArticleId[];
  /** The call to action at the foot of the page. */
  cta: { title: string; body: string };
}

export const ARTICLES: Record<ArticleId, ArticleMeta> = {
  leaks: {
    id: 'leaks',
    metaTitle: 'The nine revenue leaks in a SaaS signup funnel — Dripmetric',
    description:
      'The nine places a self-serve SaaS loses revenue between first visit and renewal: what each leak is, why it matters, and the research behind it.',
    kicker: 'Revenue leaks',
    schemaType: 'TechArticle',
    published: '2026-11-08',
    related: ['buying-intent', 'trial-to-paid', 'docs'],
    cta: {
      title: 'See which of the nine is costing you most',
      body: 'Dripmetric watches for all nine from the events you already send. No billing integration needed.',
    },
  },
  'buying-intent': {
    id: 'buying-intent',
    metaTitle: 'What a buying-intent (PQL) score is — Dripmetric',
    description:
      'A buying-intent score shows how close each person is to paying, from what they do in your product. What it is, why it matters and how Dripmetric uses it.',
    kicker: 'Buying intent',
    schemaType: 'TechArticle',
    published: '2026-11-08',
    related: ['leaks', 'trial-to-paid', 'docs'],
    cta: {
      title: 'Know who looked ready to buy',
      body: 'Every tracked user gets a score you can explain. Join the waitlist to see yours.',
    },
  },
  docs: {
    id: 'docs',
    metaTitle: 'Install Dripmetric: quickstart, SDKs and paid events',
    description:
      'Install Dripmetric with npm in about 10–15 lines: browser and server SDKs, consent, and paid events from Stripe, Paddle, Lemon Squeezy or any provider.',
    kicker: 'Docs',
    schemaType: 'TechArticle',
    published: '2026-11-08',
    related: ['leaks', 'buying-intent', 'trial-to-paid'],
    cta: {
      title: 'Get your project keys',
      body: 'Dripmetric is in private beta. Join the waitlist and your keys come with your invite.',
    },
  },
  'trial-to-paid': {
    id: 'trial-to-paid',
    metaTitle: 'Trial-to-paid conversion rate: 2026 benchmarks and formula',
    description:
      'Median free-to-paid conversion is 8%; card-required trials convert at about 30%. The 2026 benchmarks, the formula, and where trials leak before paying.',
    kicker: 'Guide',
    schemaType: 'TechArticle',
    published: '2026-11-08',
    related: ['leaks', 'buying-intent', 'docs'],
    cta: {
      title: 'Find where your trials leak',
      body: 'Dripmetric checks six of these points for you, from the events you already have.',
    },
  },
  posthog: {
    id: 'posthog',
    metaTitle: 'Dripmetric vs PostHog: revenue leaks or all-in-one analytics?',
    description:
      'PostHog is an all-in-one product platform; Dripmetric is a revenue-leak detector that works on day one. A fair, dated comparison, and how to use both.',
    kicker: 'Compare',
    schemaType: 'TechArticle',
    published: '2026-11-08',
    related: ['leaks', 'trial-to-paid', 'docs'],
    cta: {
      title: 'Keep your analytics. Add the money questions.',
      body: 'Dripmetric reads the events you already send. No billing integration needed.',
    },
  },
};

interface InventoryPage {
  id: string;
  url: string;
  title: string;
  purpose: string;
  updated_at: string;
  body_ref: string;
  md_path: string;
  disposition: string;
}

/** The inventory row for a page: its canonical URL, title (the H1) and review date. */
export function inventoryPage(id: string): InventoryPage {
  const page = (inventory.pages as InventoryPage[]).find(
    (p) => p.id === id && p.disposition === 'publish',
  );
  if (!page) throw new Error(`content/inventory.json has no published page "${id}"`);
  return page;
}
