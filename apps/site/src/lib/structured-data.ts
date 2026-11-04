import { PLANS, SITE, STARTER_YEARLY } from '@/content/site';

/**
 * The page's JSON-LD: the smallest truthful entity graph.
 *
 * Organization + WebSite + WebPage + SoftwareApplication with the offers that are
 * visible in the pricing section (they are built from the same PLANS data). Decisions
 * recorded in the SEO work notes, checked against Google's documentation on 4 Nov 2026:
 *  - no FAQPage: FAQ rich results stopped appearing in Google Search on 7 May 2026;
 *  - SoftwareApplication cannot earn its rich result without genuine ratings or
 *    reviews, which do not exist yet and are never invented. It stays for clarity
 *    about what the product is;
 *  - no `sameAs` until there are profiles the company controls (see the README).
 */
export function homeStructuredData(): Record<string, unknown> {
  const org = `${SITE.origin}/#organization`;
  const unit = (price: number, unitCode: 'MON' | 'ANN') => ({
    '@type': 'UnitPriceSpecification',
    price: String(price),
    priceCurrency: 'USD',
    unitCode,
    referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode },
  });
  const offers = PLANS.flatMap((plan) => {
    const base = { '@type': 'Offer', priceCurrency: 'USD', url: `${SITE.homeUrl}#pricing` };
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

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': org,
        name: SITE.name,
        url: SITE.homeUrl,
        email: SITE.contactEmail,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE.origin}/icon-512.png`,
          width: 512,
          height: 512,
        },
        description:
          'Dripmetric makes a revenue-leak detector for small self-serve software teams.',
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE.origin}/#website`,
        url: SITE.homeUrl,
        name: SITE.name,
        inLanguage: 'en',
        publisher: { '@id': org },
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE.origin}/#webpage`,
        url: SITE.homeUrl,
        name: 'Dripmetric — Revenue-leak detection for self-serve SaaS',
        description:
          'Dripmetric finds where signups stall, who looked ready to buy and went quiet, and what it costs you — from product and payment events on one stream.',
        inLanguage: 'en',
        dateModified: SITE.updated,
        isPartOf: { '@id': `${SITE.origin}/#website` },
        about: { '@id': `${SITE.origin}/#software` },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: `${SITE.origin}/og.png`,
          width: 1200,
          height: 630,
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE.origin}/#software`,
        name: SITE.name,
        url: SITE.homeUrl,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description:
          'A revenue-leak detector for self-serve software. It puts product usage and payment events on one event schema, runs nine readable leak rules, scores buying intent from 0 to 100 with transparent rules, and sends masked alerts to Slack or Discord plus a weekly leak report.',
        publisher: { '@id': org },
        offers,
      },
    ],
  };
}

/** Serialises JSON-LD for a <script> tag, escaping "<" so it can never close the tag. */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
