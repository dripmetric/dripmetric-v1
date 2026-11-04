'use client';

import { useEffect, useState } from 'react';

/**
 * A sticky "Get early access" bar on phones, shown only between the hero form and the
 * final form — never on top of either. Hidden bars are `visibility: hidden` as well as
 * moved off screen, so a keyboard user can never tab into one they cannot see.
 */
export function MobileCta({ heroFormId, finalId }: { heroFormId: string; finalId: string }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById(heroFormId);
    const final = document.getElementById(finalId);
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
  }, [heroFormId, finalId]);

  if (!mounted) return null;
  return (
    <div className={visible ? 'mobile-cta is-visible' : 'mobile-cta'} data-mobile-cta>
      <a className="btn btn--primary" href={`#${finalId}`}>
        Get early access
      </a>
    </div>
  );
}
