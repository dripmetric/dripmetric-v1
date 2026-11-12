import type { Metadata } from 'next';
import { SITE } from '@/content/site';

/**
 * The home page's search result: the brand and its category in the title, and in the
 * description what it finds, the two facts people ask first (free plan, no billing
 * integration) and that it is in private beta — so nobody clicks expecting a sign-up.
 * Under 160 characters. The JSON-LD WebPage node uses the same two strings.
 */
export const HOME_TITLE = 'Dripmetric — Revenue-leak detection for self-serve SaaS';
export const HOME_DESCRIPTION =
  'Dripmetric finds where signups stall, who looked ready to buy and went quiet, and what it costs you. Free plan, no billing integration. In private beta.';

/**
 * Open Graph fields every page shares.
 *
 * Next.js merges metadata shallowly: a page that sets `openGraph` replaces the layout's
 * whole `openGraph` object, image included. So each page spreads these in rather than
 * relying on the layout.
 */
export const OPEN_GRAPH: NonNullable<Metadata['openGraph']> = {
  type: 'website',
  siteName: SITE.name,
  locale: 'en_US',
  images: [
    {
      url: '/og.png',
      width: 1200,
      height: 630,
      alt: 'Dripmetric: find the revenue leaking out of your signup funnel. A sample funnel shows 587 people stopping at one step.',
    },
  ],
};
