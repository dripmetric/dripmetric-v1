import type { NextConfig } from 'next';

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

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
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
      {
        source: '/index.md',
        headers: [{ key: 'Link', value: '<https://dripmetric.com/>; rel="canonical"' }],
      },
      {
        source: '/privacy.md',
        headers: [{ key: 'Link', value: '<https://dripmetric.com/privacy>; rel="canonical"' }],
      },
      {
        source: '/llms.txt',
        headers: [
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];
  },
};

export default config;
