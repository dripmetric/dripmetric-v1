import type { NextConfig } from 'next';
import inventory from './content/inventory.json';
import legacy from './content/redirects.json';

/**
 * Content-Security-Policy for dripmetric.com.
 *
 * One deliberate difference from the founder app: `script-src` allows 'unsafe-inline'.
 * Next.js bootstraps App Router pages with INLINE scripts (`self.__next_f.push(...)`).
 * The founder app handles that with a per-request nonce in middleware, which makes every
 * page dynamic; this site is a public, fully prerendered page with no user input, no
 * session and no third-party scripts, so static serving from the CDN is worth more than
 * a nonce. Everything else stays same-origin only. `connect-src` and `form-action` allow
 * https: because the waitlist endpoint is configured per deployment.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https:",
  "form-action 'self' https: mailto:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

/**
 * Two ways to ship the same site:
 *  - the default build (`pnpm site:build`), served by Vercel or `next start`, which sends
 *    the headers below;
 *  - a static export (`pnpm site:export`, which sets SITE_STATIC_EXPORT=1) for GitHub Pages
 *    or any static host. Static hosts cannot send custom headers, so `headers()` is left
 *    out of that build — Next does not support it with `output: 'export'`.
 * SITE_BASE_PATH is only for a GitHub Pages project address such as
 * https://<user>.github.io/<repository>/; leave it empty on a custom domain.
 */
const staticExport = process.env.SITE_STATIC_EXPORT === '1';
const basePath = (process.env.SITE_BASE_PATH ?? '').replace(/\/+$/, '');

const securityHeaders = async () => {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), payment=()',
        },
        // Same value as the founder app sends. Browsers ignore it over plain http.
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ],
    },
    // The Markdown copies for AI clients: served as Markdown, pointing back at the
    // canonical HTML page so search engines consolidate them (Google honours a
    // rel=canonical Link header on non-HTML documents).
    {
      source: '/:path(.*\\.md)',
      headers: [
        { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
        { key: 'Cache-Control', value: 'public, max-age=3600' },
      ],
    },
    // Every page's Markdown copy names its HTML page as canonical (content/inventory.json).
    ...inventory.pages
      .filter((page) => page.disposition === 'publish' && page.md_path)
      .map((page) => ({
        source: `/${page.md_path}`,
        headers: [{ key: 'Link', value: `<${page.url}>; rel="canonical"` }],
      })),
    {
      source: '/llms.txt',
      headers: [
        { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
        { key: 'Cache-Control', value: 'public, max-age=3600' },
      ],
    },
  ];
};

/**
 * v1 of Dripmetric (a different product) served a few URLs on this domain that v2 has no
 * page for. Permanent redirects keep their links and bookmarks working; the list lives in
 * content/redirects.json so the static export and the checks read the same one.
 */
const legacyRedirects = async () =>
  legacy.redirects.map(({ source, destination }) => ({ source, destination, permanent: true }));

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(basePath ? { basePath } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Static hosts can send neither headers nor redirects; tools/export.mjs writes redirect
  // stubs instead.
  ...(staticExport
    ? { output: 'export' as const }
    : { headers: securityHeaders, redirects: legacyRedirects }),
};

export default config;
