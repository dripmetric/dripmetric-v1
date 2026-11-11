import { ArticlePage, articleMetadata } from '@/components/article-page';

/** Rendered from content/pages: see src/content/pages.ts for what this page owns. */
export const metadata = articleMetadata('trial-to-paid');

export const dynamic = 'force-static';

export default function Page() {
  return <ArticlePage id="trial-to-paid" />;
}
