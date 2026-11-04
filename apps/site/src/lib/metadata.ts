import type { Metadata } from 'next';
import { SITE } from '@/content/site';

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
      alt: 'Dripmetric: a masked alert reading “Someone with buying intent went quiet — 75 of 100, $49.00 at your list price”.',
    },
  ],
};
