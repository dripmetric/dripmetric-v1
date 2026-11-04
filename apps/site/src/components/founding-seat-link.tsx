'use client';

import type { ReactNode } from 'react';
import { FOUNDING_EVENT } from './signup-form';

/**
 * "Claim a founding seat". With a payment link configured
 * (NEXT_PUBLIC_FOUNDING_SEAT_URL) it goes there; otherwise it goes to the sign-up form
 * and ticks the founding-seat box, so the interest is never lost.
 */
export function FoundingSeatLink({
  url,
  className,
  children,
}: {
  url: string;
  className: string;
  children: ReactNode;
}) {
  if (/^https:\/\/\S+$/i.test(url)) {
    return (
      <a className={className} href={url} rel="noopener" data-founding>
        {children}
      </a>
    );
  }
  return (
    <a
      className={className}
      href="#get-access"
      data-founding
      onClick={() => window.dispatchEvent(new Event(FOUNDING_EVENT))}
    >
      {children}
    </a>
  );
}
