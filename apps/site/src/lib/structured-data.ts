import type { ArticleMeta } from '@/content/pages';
import { SITE } from '@/content/site';
import type { FaqItem } from '@/lib/markdown';
import { HOME_DESCRIPTION, HOME_TITLE } from '@/lib/metadata';

/**
 * The site's JSON-LD: the smallest truthful entity graph, the same on every page.
 *
 * Organization + WebSite + SoftwareApplication on every page, plus a node for the page
 * itself, its breadcrumb trail and — where the page shows questions and answers — a
 * FAQPage. There are no Offer nodes: the site publishes no prices before launch, and
 * structured data only says what the page says.
 * Decisions recorded in the SEO work notes, checked against current documentation on
 * 8 Nov 2026:
 *  - FAQPage is used only for Q&A that is visible on the page, read from the same
 *    source as the HTML. Google stopped showing FAQ rich results on 7 May 2026, so it
 *    earns nothing there; it stays because it describes the page accurately for other
 *    consumers and costs nothing;
 *  - SoftwareApplication cannot earn its rich result without genuine ratings or
 *    reviews, which do not exist yet and are never invented. It stays for clarity
 *    about what the product is;
 *  - no `sameAs` until there are profiles the company controls (see apps/site/LAUNCH.md).
 */

const ORG = `${SITE.origin}/#organization`;
const WEBSITE = `${SITE.origin}/#website`;
const SOFTWARE = `${SITE.origin}/#software`;

const organization = {
  '@type': 'Organization',
  '@id': ORG,
  name: SITE.name,
  url: SITE.homeUrl,
  email: SITE.contactEmail,
  logo: { '@type': 'ImageObject', url: `${SITE.origin}/icon-512.png`, width: 512, height: 512 },
  description:
    'Dripmetric makes a revenue-leak detector for small self-serve SaaS teams: it shows where and how much revenue leaks between a visitor’s first visit and their first payment.',
  knowsAbout: [
    'Revenue leaks in SaaS signup funnels',
    'Trial-to-paid conversion',
    'Onboarding drop-off',
    'Product-qualified leads and buying-intent scoring',
    'Product analytics for self-serve software',
  ],
};

const website = {
  '@type': 'WebSite',
  '@id': WEBSITE,
  url: SITE.homeUrl,
  name: SITE.name,
  inLanguage: 'en',
  publisher: { '@id': ORG },
};

function software() {
  return {
    '@type': 'SoftwareApplication',
    '@id': SOFTWARE,
    name: SITE.name,
    url: SITE.homeUrl,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'A revenue-leak detector for self-serve SaaS. It reads product usage and payment events together, watches for nine kinds of revenue leak, scores how close each user is to buying, and sends alerts to Slack or Discord plus a weekly leak report. It needs no billing integration and does not message end users.',
    publisher: { '@id': ORG },
  };
}

const faqPage = (url: string, faq: readonly FaqItem[]) => ({
  '@type': 'FAQPage',
  '@id': `${url}#faq`,
  url,
  isPartOf: { '@id': WEBSITE },
  mainEntity: faq.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
});

export function homeStructuredData(faq: readonly FaqItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      website,
      {
        '@type': 'WebPage',
        '@id': `${SITE.origin}/#webpage`,
        url: SITE.homeUrl,
        name: HOME_TITLE,
        description: HOME_DESCRIPTION,
        inLanguage: 'en',
        dateModified: SITE.updated,
        isPartOf: { '@id': WEBSITE },
        about: { '@id': SOFTWARE },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: `${SITE.origin}/og.png`,
          width: 1200,
          height: 630,
        },
      },
      software(),
      ...(faq.length > 0 ? [faqPage(SITE.homeUrl, faq)] : []),
    ],
  };
}

interface Link {
  name: string;
  url: string;
}

export interface ArticlePageFacts {
  meta: ArticleMeta;
  url: string;
  title: string;
  updated: string;
  faq: readonly FaqItem[];
  /** The hub the page sits under, for the middle breadcrumb. */
  hub?: Link | null;
  /** A hub's pages, for its ItemList. */
  items?: readonly Link[];
}

/**
 * The author of every page is the Organization, never a person: the founder chose to
 * keep the site about the product (docs/decisions.md, 2026-11-25).
 */
const pageFields = (meta: ArticleMeta, url: string, title: string, items: readonly Link[]) => {
  switch (meta.schemaType) {
    case 'TechArticle':
      return { headline: title, author: { '@id': ORG }, publisher: { '@id': ORG } };
    case 'CollectionPage':
      return {
        name: title,
        publisher: { '@id': ORG },
        mainEntity: {
          '@type': 'ItemList',
          '@id': `${url}#items`,
          itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            url: item.url,
          })),
        },
      };
    case 'AboutPage':
      return { name: title, publisher: { '@id': ORG }, mainEntity: { '@id': ORG } };
    default:
      return { name: title };
  }
};

export function articleStructuredData({
  meta,
  url,
  title,
  updated,
  faq,
  hub = null,
  items = [],
}: ArticlePageFacts): Record<string, unknown> {
  const page = {
    '@type': meta.schemaType,
    '@id': `${url}#page`,
    url,
    ...pageFields(meta, url, title, items),
    description: meta.description,
    inLanguage: 'en',
    datePublished: meta.published,
    dateModified: updated,
    isPartOf: { '@id': WEBSITE },
    about: { '@id': SOFTWARE },
    mainEntityOfPage: url,
    breadcrumb: { '@id': `${url}#breadcrumb` },
    image: `${SITE.origin}/og.png`,
  };
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      { name: 'Dripmetric', item: SITE.homeUrl },
      ...(hub ? [{ name: hub.name, item: hub.url }] : []),
      { name: title, item: url },
    ].map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, ...crumb })),
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      website,
      page,
      breadcrumb,
      software(),
      ...(faq.length > 0 ? [faqPage(url, faq)] : []),
    ],
  };
}

/** Serialises JSON-LD for a <script> tag, escaping "<" so it can never close the tag. */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
