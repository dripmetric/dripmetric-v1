import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The workspace packages are TypeScript source; Next compiles them with the app.
  transpilePackages: ['@dripmetric/db', '@dripmetric/catalog', '@dripmetric/ingest'],
  // Security headers. Expanded at M13; these are the ones that cost nothing now.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default config;
