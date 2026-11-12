import Link from 'next/link';
import { Brand } from '@/components/ui/brand';
import { DEFINITION, SITE } from '@/content/site';
import { withBase } from '@/lib/paths';

export function SiteFooter({ full = true }: { full?: boolean }) {
  return (
    <footer className="site-footer">
      {full ? (
        <div className="wrap site-footer__grid">
          <div className="site-footer__brand">
            <Brand />
            <p>
              {DEFINITION} It shows where and how much revenue leaks between a first visit and a
              first payment.
            </p>
          </div>
          <nav aria-label="Product">
            <p className="site-footer__h">Product</p>
            <ul>
              <li>
                <a href={withBase('/leaks')}>The nine leaks</a>
              </li>
              <li>
                <a href={withBase('/buying-intent')}>Buying-intent score</a>
              </li>
              <li>
                <a href={withBase('/pricing')}>Pricing</a>
              </li>
              <li>
                <a href={withBase('/docs')}>Docs</a>
              </li>
            </ul>
          </nav>
          <nav aria-label="Guides">
            <p className="site-footer__h">Guides</p>
            <ul>
              <li>
                <a href={withBase('/guides/trial-to-paid-conversion')}>
                  Trial-to-paid conversion benchmarks
                </a>
              </li>
              <li>
                <a href={withBase('/compare/posthog')}>Dripmetric vs PostHog</a>
              </li>
            </ul>
          </nav>
          <nav aria-label="Company">
            <p className="site-footer__h">Company</p>
            <ul>
              <li>
                <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
              </li>
              <li>
                <Link prefetch={false} href="/privacy">
                  Privacy
                </Link>
              </li>
              <li>
                <a href={withBase('/llms.txt')}>llms.txt</a>
              </li>
              <li>
                <a href={withBase('/sitemap.md')}>Site in Markdown</a>
              </li>
            </ul>
          </nav>
        </div>
      ) : null}
      <div className="wrap">
        <div className="site-footer__base">
          <p>© 2026 Dripmetric</p>
          {full ? (
            <p>Every sample on this site uses simulated data, and says so.</p>
          ) : (
            <p>
              <Link prefetch={false} href="/">
                Back to dripmetric.com
              </Link>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
