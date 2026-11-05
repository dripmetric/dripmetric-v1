import { Brand } from '@/components/ui/brand';
import { withBase } from '@/lib/paths';

export function SiteHeader({ nav = true }: { nav?: boolean }) {
  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <Brand />
        {nav ? (
          <nav className="site-nav" aria-label="Main">
            <ul>
              <li>
                <a href={withBase('/#how-it-works')}>How it works</a>
              </li>
              <li>
                <a href={withBase('/#leaks')}>The nine leaks</a>
              </li>
              <li className="site-nav__pricing">
                <a href={withBase('/#pricing')}>Pricing</a>
              </li>
              <li>
                <a href={withBase('/#faq')}>FAQ</a>
              </li>
            </ul>
          </nav>
        ) : null}
        <a
          className={nav ? 'btn btn--primary btn--sm' : 'btn btn--primary btn--sm site-header__cta'}
          href={withBase('/#get-access')}
        >
          Get early access
        </a>
      </div>
    </header>
  );
}
