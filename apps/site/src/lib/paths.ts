/**
 * The site's base path: empty at dripmetric.com, "/<repository>" when the static export is
 * served from a GitHub Pages project address (https://<user>.github.io/<repository>/).
 * Set at build time from SITE_BASE_PATH (see next.config.ts and tools/export.mjs).
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * A root-relative URL that works under the base path, for plain <a> tags and metadata.
 * next/link adds the base path by itself; plain anchors and metadata URLs do not.
 */
export const withBase = (path: string): string => `${BASE_PATH}${path}`;
