import type { Metadata } from 'next';
import { Faq, HOME_FAQ } from '@/components/home/faq';
import { Features } from '@/components/home/features';
import { FINAL_CTA_ID, FinalCta } from '@/components/home/final-cta';
import { Hero } from '@/components/home/hero';
import { HowItWorks } from '@/components/home/how-it-works';
import { Leaks } from '@/components/home/leaks';
import { Problem } from '@/components/home/problem';
import { SiteFooter } from '@/components/home/site-footer';
import { SiteHeader, WAITLIST_ID } from '@/components/home/site-header';
import { MobileCta } from '@/components/mobile-cta';
import { CTA_LABEL, SITE } from '@/content/site';
import { HOME_DESCRIPTION, HOME_TITLE, OPEN_GRAPH } from '@/lib/metadata';
import { homeStructuredData, jsonLd } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: SITE.homeUrl,
    types: { 'text/markdown': `${SITE.origin}/index.md` },
  },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
  openGraph: {
    ...OPEN_GRAPH,
    url: SITE.homeUrl,
    title: 'Dripmetric — See where your signup funnel leaks revenue',
    description:
      'A revenue-leak detector for self-serve SaaS. Nine readable rules over your product and payment events, with alerts and a weekly report. No billing integration. In private beta.',
  },
};

/** Fully prerendered at build time: the HTML every crawler gets is the whole page. */
export const dynamic = 'force-static';

/**
 * One page, one job: join the waitlist. The sections answer, in order: what is this
 * (the claim), why it matters (the problem), how it works (the nine rules), what you get
 * when something leaks, how setup goes, the questions people ask, and the ask again.
 * Text only: no illustrations, no sample data, no prices. `pnpm site:check` holds it to
 * a length budget so it stays that way.
 */
export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(homeStructuredData(HOME_FAQ)) }}
      />
      <SiteHeader />
      <main id="main">
        <Hero />
        <Problem />
        <Leaks />
        <Features />
        <HowItWorks />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
      <MobileCta heroFormId={WAITLIST_ID} finalFormId={FINAL_CTA_ID} label={CTA_LABEL} />
    </>
  );
}
