import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { RevealOnScroll } from '@/components/reveal-on-scroll';
import { SITE } from '@/content/site';
import { OPEN_GRAPH } from '@/lib/metadata';
import { withBase } from '@/lib/paths';
import './globals.css';

/*
 * Self-hosted fonts (SIL OFL 1.1). No request ever leaves dripmetric.com — the product
 * promises "the IP is never stored", so the site does not hand visitors' IPs to a font CDN.
 * The display face is the LCP text on desktop and the sans face on phones, so both are
 * preloaded; the mono face is not.
 */
const display = localFont({
  src: './fonts/newsreader-latin-wght-normal.woff2',
  weight: '200 800',
  variable: '--font-display-face',
  display: 'swap',
  preload: false,
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});
const sans = localFont({
  src: './fonts/schibsted-grotesk-latin-wght-normal.woff2',
  weight: '400 900',
  variable: '--font-sans-face',
  display: 'swap',
  fallback: ['Arial', 'Helvetica', 'sans-serif'],
});
const mono = localFont({
  src: './fonts/jetbrains-mono-latin-wght-normal.woff2',
  weight: '100 800',
  variable: '--font-mono-face',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'Menlo', 'Consolas', 'monospace'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin),
  applicationName: SITE.name,
  icons: {
    icon: [
      { url: withBase('/favicon.ico'), sizes: '32x32' },
      { url: withBase('/favicon.svg'), type: 'image/svg+xml' },
    ],
    apple: withBase('/apple-touch-icon.png'),
  },
  manifest: withBase('/site.webmanifest'),
  openGraph: OPEN_GRAPH,
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f3ec' },
    { media: '(prefers-color-scheme: dark)', color: '#14120f' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        <RevealOnScroll />
      </body>
    </html>
  );
}
