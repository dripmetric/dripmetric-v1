import Link from 'next/link';
import { Brand } from '@/components/ui/brand';
import { SITE } from '@/content/site';
import { withBase } from '@/lib/paths';

export function SiteFooter({ full = true }: { full?: boolean }) {
  return (
    <footer className="site-footer">
      {full ? (
        <div className="wrap site-footer__grid">
          <div className="site-footer__brand">
            <Brand />
            <p>
              Dripmetric is a revenue-leak detector for small self-serve software teams: one event
              schema across product usage and money.
            </p>
          </div>
          <nav aria-label="Product">
            <p className="site-footer__h">Product</p>
            <ul>
              <li>
                <a href={withBase('/#how-it-works')}>How it works</a>
              </li>
              <li>
                <a href={withBase('/#leaks')}>The nine leaks</a>
              </li>
              <li>
                <a href={withBase('/#intent')}>Buying intent</a>
              </li>
              <li>
                <a href={withBase('/#pricing')}>Pricing</a>
              </li>
              <li>
                <a href={withBase('/#faq')}>FAQ</a>
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
            </ul>
          </nav>
          <nav aria-label="For AI assistants">
            <p className="site-footer__h">For AI assistants</p>
            <ul>
              <li>
                <a href={withBase('/llms.txt')}>llms.txt</a>
              </li>
              <li>
                <a href={withBase('/index.md')}>This page in Markdown</a>
              </li>
            </ul>
          </nav>
        </div>
      ) : null}
      <div className="wrap">
        <div className="site-footer__base">
          <p>© 2026 Dripmetric</p>
          {full ? (
            <p>Every sample on this page uses simulated data, and says so.</p>
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
