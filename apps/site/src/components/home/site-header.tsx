import { Brand } from '@/components/ui/brand';
import { CTA_LABEL } from '@/content/site';
import { withBase } from '@/lib/paths';

/** The id of the waitlist form in the hero: every "Join the waitlist" link lands on it. */
export const WAITLIST_ID = 'waitlist';

export function SiteHeader({ nav = true }: { nav?: boolean }) {
  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <Brand />
        {nav ? (
          <nav className="site-nav" aria-label="Main">
            <ul>
              <li>
                <a href={withBase('/leaks')}>The nine leaks</a>
              </li>
              <li>
                <a href={withBase('/pricing')}>Pricing</a>
              </li>
              <li>
                <a href={withBase('/docs')}>Docs</a>
              </li>
            </ul>
          </nav>
        ) : null}
        <a className="btn btn--primary btn--sm" href={withBase(`/#${WAITLIST_ID}`)}>
          {CTA_LABEL}
        </a>
      </div>
    </header>
  );
}
