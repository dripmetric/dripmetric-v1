import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The SDK is a workspace package here; a real app installs it from npm.
  transpilePackages: ['dripmetric'],
};

export default config;
