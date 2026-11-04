import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: { absolute: 'Page not found — Dripmetric' },
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main id="main" className="page">
      <div className="wrap">
        <p className="kicker">404</p>
        <h1>That page isn’t here.</h1>
        <p>
          It may have moved, or the link may be wrong. Everything about Dripmetric — the nine leaks,
          pricing and the FAQ — is on one page.
        </p>
        <p>
          <Link prefetch={false} className="btn btn--primary" href="/">
            Go to dripmetric.com
          </Link>
        </p>
      </div>
    </main>
  );
}
