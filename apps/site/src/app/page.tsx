import type { Metadata } from 'next';
import { Compare } from '@/components/home/compare';
import { Dashboard } from '@/components/home/dashboard';
import { Faq } from '@/components/home/faq';
import { FinalCta } from '@/components/home/final-cta';
import { Hero } from '@/components/home/hero';
import { HowItWorks } from '@/components/home/how-it-works';
import { Intent } from '@/components/home/intent';
import { Leaks } from '@/components/home/leaks';
import { NoBilling } from '@/components/home/no-billing';
import { PotentialRevenue } from '@/components/home/potential-revenue';
import { Pricing } from '@/components/home/pricing';
import { PrivacyPerformance } from '@/components/home/privacy-performance';
import { Problem } from '@/components/home/problem';
import { SiteFooter } from '@/components/home/site-footer';
import { SiteHeader } from '@/components/home/site-header';
import { Specs } from '@/components/home/specs';
import { MobileCta } from '@/components/mobile-cta';
import { SITE } from '@/content/site';
import { OPEN_GRAPH } from '@/lib/metadata';
import { homeStructuredData, jsonLd } from '@/lib/structured-data';

const TITLE = 'Dripmetric — Revenue-leak detection for self-serve SaaS';
const DESCRIPTION =
  'Dripmetric finds where signups stall, who looked ready to buy and went quiet, and what it costs you — from product and payment events on one stream. Free plan; no billing integration needed.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
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
      'A revenue-leak detector for self-serve software. Product and payment events on one stream, nine readable leak rules, a transparent buying-intent score. Free plan; no billing integration needed.',
  },
};

/** Fully prerendered at build time: the HTML every crawler gets is the whole page. */
export const dynamic = 'force-static';

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(homeStructuredData()) }}
      />
      <SiteHeader />
      <main id="main">
        <Hero />
        <Specs />
        <Problem />
        <HowItWorks />
        <Leaks />
        <Intent />
        <PotentialRevenue />
        <NoBilling />
        <Dashboard />
        <Compare />
        <PrivacyPerformance />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
      <MobileCta heroFormId="hero-signup" finalId="get-access" />
    </>
  );
}
