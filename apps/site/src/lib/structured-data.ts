import type { ArticleMeta } from '@/content/pages';
import { PLANS, SITE, STARTER_YEARLY, type Plan } from '@/content/site';
import type { FaqItem } from '@/lib/markdown';
import { HOME_DESCRIPTION, HOME_TITLE } from '@/lib/metadata';

/**
 * The site's JSON-LD: the smallest truthful entity graph, the same on every page.
 *
 * Organization + WebSite + SoftwareApplication (with the offers visible on that page,
 * built from the same PLANS data) on every page, plus a node for the page itself,
 * its breadcrumb trail and — where the page shows questions and answers — a FAQPage.
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

const unit = (price: number, unitCode: 'MON' | 'ANN') => ({
  '@type': 'UnitPriceSpecification',
  price: String(price),
  priceCurrency: 'USD',
  unitCode,
  referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode },
});

/** Offers for the plans a page actually shows: structured data mirrors visible content. */
function offers(pricingUrl: string, plans: readonly Plan[]) {
  return plans.flatMap((plan) => {
    const base = { '@type': 'Offer', priceCurrency: 'USD', url: pricingUrl };
    if (plan.billing === 'free') return [{ ...base, name: plan.name, price: '0' }];
    if (plan.id === 'starter') {
      return [
        {
          ...base,
          name: 'Starter, monthly (launch price)',
          price: String(plan.price),
          priceSpecification: unit(plan.price, 'MON'),
        },
        {
          ...base,
          name: 'Starter, yearly (launch price)',
          price: String(STARTER_YEARLY.price),
          priceSpecification: unit(STARTER_YEARLY.price, 'ANN'),
        },
      ];
    }
    return [
      {
        ...base,
        name: 'Founding seat (first 25 founders, price locked for life)',
        price: String(plan.price),
        priceSpecification: unit(plan.price, plan.billing),
      },
    ];
  });
}

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

function software(pricingUrl: string, plans: readonly Plan[]) {
  return {
    '@type': 'SoftwareApplication',
    '@id': SOFTWARE,
    name: SITE.name,
    url: SITE.homeUrl,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'A revenue-leak detector for self-serve SaaS. It puts product usage and payment events on one event schema, runs nine readable leak rules, scores buying intent from 0 to 100 with transparent rules, and sends masked alerts to Slack or Discord plus a weekly leak report. It needs no billing integration and never contacts end users.',
    publisher: { '@id': ORG },
    ...(plans.length > 0 ? { offers: offers(pricingUrl, plans) } : {}),
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
      software(
        `${SITE.homeUrl}#pricing`,
        PLANS.filter((plan) => plan.onHome),
      ),
      ...(faq.length > 0 ? [faqPage(SITE.homeUrl, faq)] : []),
    ],
  };
}

export interface ArticlePageFacts {
  meta: ArticleMeta;
  url: string;
  title: string;
  updated: string;
  faq: readonly FaqItem[];
}

export function articleStructuredData({
  meta,
  url,
  title,
  updated,
  faq,
}: ArticlePageFacts): Record<string, unknown> {
  const isPricing = meta.id === 'pricing';
  const page = {
    '@type': meta.schemaType,
    '@id': `${url}#page`,
    url,
    ...(meta.schemaType === 'TechArticle'
      ? { headline: title, author: { '@id': ORG }, publisher: { '@id': ORG } }
      : { name: title }),
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
      { '@type': 'ListItem', position: 1, name: 'Dripmetric', item: SITE.homeUrl },
      { '@type': 'ListItem', position: 2, name: title, item: url },
    ],
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      website,
      page,
      breadcrumb,
      software(url, isPricing ? PLANS : []),
      ...(faq.length > 0 ? [faqPage(url, faq)] : []),
    ],
  };
}

/** Serialises JSON-LD for a <script> tag, escaping "<" so it can never close the tag. */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
