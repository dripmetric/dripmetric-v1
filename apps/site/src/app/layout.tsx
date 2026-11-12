import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { SITE } from '@/content/site';
import { OPEN_GRAPH } from '@/lib/metadata';
import { withBase } from '@/lib/paths';
import './globals.css';

/*
 * Two self-hosted faces (SIL OFL 1.1), 52 KB together: Geist for everything a person
 * reads, Geist Mono for code and for figures inside the product samples. No request
 * ever leaves dripmetric.com — the product promises "the IP is never stored", so the
 * site does not hand visitors' IPs to a font CDN. Geist carries the headline, which is
 * the largest paint on every screen, so it is preloaded; the mono face is not.
 */
const sans = localFont({
  src: './fonts/geist-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-sans-face',
  display: 'swap',
  fallback: ['Arial', 'Helvetica', 'sans-serif'],
});
const mono = localFont({
  src: './fonts/geist-mono-latin-wght-normal.woff2',
  weight: '100 900',
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

/* The page background in each theme: --bg in globals.css. Keep the two in step. */
export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#080c10' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
