'use client';

import { useEffect } from 'react';

/**
 * A gentle fade-up for blocks marked `data-reveal` as they scroll into view.
 *
 * Content is visible in the server HTML; the effect only starts after hydration, and
 * blocks already on screen are marked visible before the `js` class switches the
 * effect on, so nothing flashes. Off entirely for people who prefer reduced motion,
 * and a timer reveals everything regardless after four seconds.
 */
export function RevealOnScroll() {
  useEffect(() => {
    const root = document.documentElement;
    const blocks = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const reveal = (el: HTMLElement) => el.classList.add('is-in');
    const height = window.innerHeight || root.clientHeight;
    blocks.forEach((el) => {
      if (el.getBoundingClientRect().top < height * 0.95) reveal(el);
    });
    root.classList.add('js');

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      blocks.forEach(reveal);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal(entry.target as HTMLElement);
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    blocks.forEach((el) => {
      if (!el.classList.contains('is-in')) observer.observe(el);
    });
    const safety = window.setTimeout(() => blocks.forEach(reveal), 4000);
    return () => {
      observer.disconnect();
      window.clearTimeout(safety);
    };
  }, []);
  return null;
}
