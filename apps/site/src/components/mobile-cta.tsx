'use client';

import { useEffect, useState } from 'react';

/**
 * A sticky "Join the waitlist" bar on phones, shown only between the hero form and the
 * closing form — never on top of either. Hidden bars are `visibility: hidden` as well as
 * moved off screen, so a keyboard user can never tab into one they cannot see.
 */
export function MobileCta({
  heroFormId,
  finalFormId,
  label,
}: {
  heroFormId: string;
  finalFormId: string;
  label: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById(heroFormId);
    const final = document.getElementById(finalFormId);
    if (!hero || !final || !('IntersectionObserver' in window)) return;
    setMounted(true);
    let heroVisible = true;
    let finalVisible = false;
    const sync = () => setVisible(!heroVisible && !finalVisible);
    const heroObserver = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      heroVisible = entry.isIntersecting || entry.boundingClientRect.top > 0;
      sync();
    });
    const finalObserver = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      finalVisible = entry.isIntersecting;
      sync();
    });
    heroObserver.observe(hero);
    finalObserver.observe(final);
    return () => {
      heroObserver.disconnect();
      finalObserver.disconnect();
    };
  }, [heroFormId, finalFormId]);

  if (!mounted) return null;
  return (
    <div className={visible ? 'mobile-cta is-visible' : 'mobile-cta'} data-mobile-cta>
      <a className="btn btn--primary" href={`#${finalFormId}`}>
        {label}
      </a>
    </div>
  );
}
