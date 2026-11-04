import { ACTIVITY_TICK_MS, ACTIVITY_WINDOW_MS } from '../shared/constants.js';

/**
 * Active time (brief section 6).
 *
 * "A second counts as active while the tab is visible and, in the previous 60
 * seconds, the page loaded, the tab returned to view, or there was a click, key
 * press, scroll or touch."
 *
 * The definition matters more than it looks: a tab left open on a pricing page for
 * an hour is not an hour of deliberation, and the intent score reads this number to
 * tell a studier from a glancer (brief section 8.2).
 */
export class ActivityTracker {
  private activeSeconds = 0;
  private deepestScroll = 0;
  private lastInteraction = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private listeners: (() => void)[] = [];

  start(now: number): void {
    // The page loading counts as an interaction, so the first minute is active.
    this.lastInteraction = now;

    const mark = () => {
      this.lastInteraction = Date.now();
    };
    const scroll = () => {
      mark();
      try {
        const height = document.documentElement.scrollHeight - window.innerHeight;
        if (height > 0) {
          const depth = Math.round(((window.scrollY || 0) / height) * 100);
          if (depth > this.deepestScroll) this.deepestScroll = Math.min(100, depth);
        } else {
          // A page shorter than the viewport is fully seen.
          this.deepestScroll = 100;
        }
      } catch {
        // Nothing to do: the scroll depth simply does not advance.
      }
    };

    const visibility = () => {
      // Returning to the tab counts as an interaction.
      if (document.visibilityState === 'visible') mark();
    };

    const add = (target: EventTarget, type: string, handler: () => void, passive = true) => {
      target.addEventListener(type, handler, { passive });
      this.listeners.push(() => target.removeEventListener(type, handler));
    };

    add(document, 'click', mark);
    add(document, 'keydown', mark);
    add(document, 'touchstart', mark);
    add(window, 'scroll', scroll);
    add(document, 'visibilitychange', visibility);
    scroll();

    this.timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - this.lastInteraction > ACTIVITY_WINDOW_MS) return;
      this.activeSeconds += ACTIVITY_TICK_MS / 1000;
    }, ACTIVITY_TICK_MS);
    (this.timer as unknown as { unref?: () => void }).unref?.();
  }

  /** The totals for the page view just ending, and a reset for the next one. */
  takeTotals(): { activeSeconds: number; deepestScroll: number } {
    const totals = {
      activeSeconds: Math.round(this.activeSeconds),
      deepestScroll: this.deepestScroll,
    };
    this.activeSeconds = 0;
    this.deepestScroll = 0;
    return totals;
  }

  /** Without resetting, for a beacon that may be followed by more time on the page. */
  peekTotals(): { activeSeconds: number; deepestScroll: number } {
    return { activeSeconds: Math.round(this.activeSeconds), deepestScroll: this.deepestScroll };
  }

  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    for (const off of this.listeners) off();
    this.listeners = [];
  }
}
