import Link from 'next/link';

/** The mark: three funnel steps and the drop that leaks out. Decorative everywhere. */
export function BrandMark({ className = 'brand__mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="7.5" className="mark-bg" />
      <rect x="5.5" y="6.5" width="21" height="4.2" rx="2.1" className="mark-bar" />
      <rect x="5.5" y="13.9" width="13.2" height="4.2" rx="2.1" className="mark-bar" />
      <rect x="5.5" y="21.3" width="7.2" height="4.2" rx="2.1" className="mark-bar" />
      <path
        d="M23.2 13.6c0 0-4.2 5-4.2 8.4a4.2 4.2 0 0 0 8.4 0c0-3.4-4.2-8.4-4.2-8.4z"
        className="mark-drop"
      />
    </svg>
  );
}

export function Brand() {
  return (
    <Link prefetch={false} className="brand" href="/" aria-label="Dripmetric — home">
      <BrandMark />
      <span className="brand__name">Dripmetric</span>
    </Link>
  );
}
