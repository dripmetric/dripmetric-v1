import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/home/site-footer';
import { SiteHeader } from '@/components/home/site-header';
import { ARTICLES, inventoryPage, type ArticleId } from '@/content/pages';
import { SITE } from '@/content/site';
import { readContent, renderMarkdown } from '@/lib/markdown';
import { OPEN_GRAPH } from '@/lib/metadata';
import { withBase } from '@/lib/paths';
import { articleStructuredData, jsonLd } from '@/lib/structured-data';

/**
 * One layout for every guide page: breadcrumb, H1, review date, the page's own Markdown,
 * a table of contents, a call to action and where to read next.
 *
 * Everything is rendered at build time. The words come from content/pages/*.md — the
 * same file served as the page's Markdown copy — so the HTML a crawler reads and the
 * Markdown an AI client reads are one text.
 */

const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const longDate = (iso: string) => LONG_DATE.format(new Date(`${iso}T00:00:00Z`));
const pathOf = (url: string) => new URL(url).pathname;

export function articleMetadata(id: ArticleId): Metadata {
  const meta = ARTICLES[id];
  const page = inventoryPage(id);
  return {
    title: { absolute: meta.metaTitle },
    description: meta.description,
    alternates: {
      canonical: page.url,
      types: { 'text/markdown': `${SITE.origin}/${page.md_path}` },
    },
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    openGraph: {
      ...OPEN_GRAPH,
      type: 'article',
      url: page.url,
      title: meta.metaTitle,
      description: meta.description,
    },
  };
}

export function ArticlePage({ id }: { id: ArticleId }) {
  const meta = ARTICLES[id];
  const page = inventoryPage(id);
  const { html, toc, faq } = renderMarkdown(readContent(page.body_ref));
  const data = articleStructuredData({
    meta,
    url: page.url,
    title: page.title,
    updated: page.updated_at,
    faq,
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
      <SiteHeader />
      <main id="main" className="article">
        <div className="wrap article__wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link prefetch={false} href="/">
                  Dripmetric
                </Link>
              </li>
              <li aria-current="page">{meta.kicker}</li>
            </ol>
          </nav>

          <header className="article__head">
            <p className="eyebrow">{meta.kicker}</p>
            <h1 className="article__title">{page.title}</h1>
            <p className="article__meta">
              Reviewed against the product code and its sources on{' '}
              <time dateTime={page.updated_at}>{longDate(page.updated_at)}</time> · Written by the
              Dripmetric team · Also in{' '}
              <a href={withBase(`/${page.md_path}`)} type="text/markdown">
                Markdown
              </a>
            </p>
          </header>

          <div className="article__layout">
            {toc.length > 2 ? (
              <nav className="toc" aria-labelledby="toc-title">
                <p className="toc__title" id="toc-title">
                  On this page
                </p>
                <ol>
                  {toc.map((heading) => (
                    <li key={heading.id}>
                      <a href={`#${heading.id}`}>{heading.text}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}

            <div className="article__body">
              <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />

              <aside className="article-cta" aria-labelledby="article-cta-title">
                <h2 className="article-cta__title" id="article-cta-title">
                  {meta.cta.title}
                </h2>
                <p>{meta.cta.body}</p>
                <div className="article-cta__actions">
                  <a className="btn btn--primary" href={withBase('/#get-access')}>
                    Get early access
                  </a>
                  {/* With a payment link configured it goes there; otherwise to the sign-up
                      form on the home page, whose founding-seat box records the interest. */}
                  <a
                    className="btn btn--ghost"
                    href={
                      /^https:\/\/\S+$/i.test(SITE.foundingSeatUrl)
                        ? SITE.foundingSeatUrl
                        : withBase('/#get-access')
                    }
                  >
                    Claim a founding seat
                  </a>
                </div>
              </aside>

              <nav className="related" aria-labelledby="related-title">
                <h2 className="related__title" id="related-title">
                  Read next
                </h2>
                <ul>
                  {meta.related.map((relatedId) => {
                    const next = inventoryPage(relatedId);
                    return (
                      <li key={relatedId}>
                        <Link prefetch={false} href={pathOf(next.url)}>
                          <span className="related__name">{next.title}</span>
                          <span className="related__about">{ARTICLES[relatedId].description}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
