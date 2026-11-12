import type { Metadata } from 'next';
import { Facts } from '@/components/home/facts';
import { Faq, HOME_FAQ } from '@/components/home/faq';
import { FINAL_CTA_ID, FinalCta } from '@/components/home/final-cta';
import { Hero } from '@/components/home/hero';
import { HowItWorks } from '@/components/home/how-it-works';
import { Leaks } from '@/components/home/leaks';
import { Plans } from '@/components/home/plans';
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
    title: 'Dripmetric — Find the revenue leaking out of your signup funnel',
    description:
      'A revenue-leak detector for self-serve SaaS. Nine readable leak rules and a transparent buying-intent score, over product and payment events. Free plan; no billing integration. In private beta.',
  },
};

/** Fully prerendered at build time: the HTML every crawler gets is the whole page. */
export const dynamic = 'force-static';

/**
 * One page, one job: join the waitlist. Seven short sections answer, in order, what
 * this is, whether it is for you, why to believe it, what it costs and what to do next.
 * Everything deeper lives on its own page (/leaks, /buying-intent, /docs, /pricing),
 * and `pnpm site:check` holds this page to a length budget so it stays that way.
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
        <Facts />
        <Leaks />
        <HowItWorks />
        <Plans />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
      <MobileCta heroFormId={WAITLIST_ID} finalFormId={FINAL_CTA_ID} label={CTA_LABEL} />
    </>
  );
}
