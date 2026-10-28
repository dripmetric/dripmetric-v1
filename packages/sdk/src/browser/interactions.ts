import {
  DEAD_CLICK_WINDOW_MS,
  RAGE_CLICK_COUNT,
  RAGE_CLICK_RADIUS_PX,
  RAGE_CLICK_WINDOW_MS,
  SLOW_INTERACTION_MS,
  SLOW_PAGE_MS,
} from '../shared/constants.js';
import { AUTO_EVENTS } from '../shared/types.js';

/**
 * Forms, friction and pricing interactions (brief section 6 and Appendix A).
 *
 * This file is a LAZY chunk: it loads after the page is idle and only on key pages,
 * which is what keeps the core inside its 5 KB gzipped budget. Nothing here is
 * needed for page views, sessions, identify or track.
 *
 * What is deliberately NOT captured (brief section 10): typed text, page text,
 * general click capture, or mouse movement. Form errors carry the FIELD NAME only,
 * never what was typed.
 */

export interface InteractionHooks {
  track: (event: string, properties: Record<string, unknown>) => void;
  isPricingPage: () => boolean;
}

interface FormState {
  started: boolean;
  startedAt: number;
  touched: Set<string>;
  submitted: boolean;
}

export function watchInteractions(hooks: InteractionHooks): () => void {
  const forms = new WeakMap<HTMLFormElement, FormState>();
  const listeners: (() => void)[] = [];
  let recentClicks: { x: number; y: number; at: number }[] = [];

  const on = <K extends keyof DocumentEventMap>(
    type: K,
    handler: (event: DocumentEventMap[K]) => void,
    options: AddEventListenerOptions = { passive: true, capture: true },
  ) => {
    document.addEventListener(type, handler as EventListener, options);
    listeners.push(() => document.removeEventListener(type, handler as EventListener, options));
  };

  const formOf = (target: EventTarget | null): HTMLFormElement | null => {
    const element = target as Element | null;
    return element?.closest?.('form') ?? null;
  };

  const nameOf = (element: Element): string =>
    // The field's NAME, never its value.
    element.getAttribute('name') ?? element.getAttribute('id') ?? element.tagName.toLowerCase();

  const formName = (form: HTMLFormElement): string =>
    form.getAttribute('data-dripmetric-form') ??
    form.getAttribute('name') ??
    form.getAttribute('id') ??
    'form';

  // --- Signup Started and the form lifecycle ---------------------------------
  on('focusin', (event) => {
    const form = formOf(event.target);
    if (!form) return;
    let state = forms.get(form);
    if (!state) {
      state = { started: false, startedAt: 0, touched: new Set(), submitted: false };
      forms.set(form, state);
    }
    const field = event.target as Element;
    state.touched.add(nameOf(field));

    if (!state.started) {
      state.started = true;
      state.startedAt = Date.now();
      hooks.track(AUTO_EVENTS.formStarted, { form: formName(form) });
      // The first input on a signup page is Signup Started (brief Appendix A).
      if (
        /sign.?up|register|create.?account|get.?started/i.test(location.pathname + formName(form))
      ) {
        hooks.track(AUTO_EVENTS.signupStarted, { method: 'form' });
      }
    }
  });

  on('submit', (event) => {
    const form = formOf(event.target);
    if (!form) return;
    const state = forms.get(form);
    if (!state) return;
    state.submitted = true;
    hooks.track(AUTO_EVENTS.formSubmitted, {
      form: formName(form),
      fieldsTouched: state.touched.size,
      timeToSubmitMs: state.startedAt ? Date.now() - state.startedAt : undefined,
    });
  });

  // An invalid field is a form error. The field's name, never its value.
  on('invalid', (event) => {
    const field = event.target as Element | null;
    const form = formOf(event.target);
    if (!field || !form) return;
    hooks.track(AUTO_EVENTS.formError, { form: formName(form), field: nameOf(field) });
  });

  const abandon = () => {
    // Leaving a started, unsubmitted form is abandonment.
    for (const form of Array.from(document.forms)) {
      const state = forms.get(form);
      if (state?.started && !state.submitted) {
        state.submitted = true; // report once
        hooks.track(AUTO_EVENTS.formAbandoned, {
          form: formName(form),
          fieldsTouched: state.touched.size,
        });
      }
    }
  };
  const onHidden = () => {
    if (document.visibilityState === 'hidden') abandon();
  };
  document.addEventListener('visibilitychange', onHidden);
  listeners.push(() => document.removeEventListener('visibilitychange', onHidden));

  // --- Rage clicks, dead clicks, slow interactions ---------------------------
  on('click', (event) => {
    const at = Date.now();
    const { clientX: x, clientY: y } = event;

    // Three clicks, each within 1 s and 30 px of the previous one.
    const previous = recentClicks[recentClicks.length - 1];
    if (
      previous &&
      at - previous.at <= RAGE_CLICK_WINDOW_MS &&
      Math.hypot(x - previous.x, y - previous.y) <= RAGE_CLICK_RADIUS_PX
    ) {
      recentClicks.push({ x, y, at });
    } else {
      recentClicks = [{ x, y, at }];
    }

    if (recentClicks.length >= RAGE_CLICK_COUNT) {
      recentClicks = [];
      hooks.track(AUTO_EVENTS.rageClick, { path: location.pathname, label: labelOf(event.target) });
    }

    // A click followed by no change on the page is a dead click.
    watchForChange(event.target, hooks);

    // A reply to a click over 500 ms is a Slow Page (brief Appendix A).
    const started = performance.now();
    requestAnimationFrame(() => {
      const elapsed = performance.now() - started;
      if (elapsed > SLOW_INTERACTION_MS) {
        hooks.track(AUTO_EVENTS.slowPage, {
          path: location.pathname,
          kind: 'interaction',
          durationMs: Math.round(elapsed),
        });
      }
    });

    // --- Pricing page interactions ------------------------------------------
    if (!hooks.isPricingPage()) return;
    const element = event.target as Element | null;
    if (!element) return;

    // Explicit attributes first, then simple label rules, because guessing which
    // button is a plan button from markup alone is weak (brief section 6).
    const explicitPlan = element.closest?.('[data-dripmetric-plan]');
    if (explicitPlan) {
      hooks.track(AUTO_EVENTS.planSelected, {
        plan: explicitPlan.getAttribute('data-dripmetric-plan'),
        interval: explicitPlan.getAttribute('data-dripmetric-interval') ?? undefined,
      });
      return;
    }

    const explicitToggle = element.closest?.('[data-dripmetric-interval-toggle]');
    if (explicitToggle) {
      hooks.track(AUTO_EVENTS.pricingInteraction, {
        kind: 'toggle',
        plan: explicitToggle.getAttribute('data-dripmetric-interval-toggle') ?? undefined,
      });
      return;
    }

    const label = labelOf(event.target);
    if (/month|annual|year/i.test(label)) {
      hooks.track(AUTO_EVENTS.pricingInteraction, { kind: 'toggle', plan: label });
    } else if (/faq|question/i.test(label)) {
      hooks.track(AUTO_EVENTS.pricingInteraction, { kind: 'faq' });
    } else if (/compare|comparison/i.test(label)) {
      hooks.track(AUTO_EVENTS.pricingInteraction, { kind: 'comparison' });
    } else if (/choose|select|start|upgrade|buy|subscribe|get /i.test(label)) {
      hooks.track(AUTO_EVENTS.planSelected, { plan: label });
    }
  });

  reportLoadSpeed(hooks);

  return () => {
    for (const off of listeners) off();
  };
}

/**
 * Slow Page on a full page load: main content over 4 seconds (brief Appendix A).
 *
 * It lives in this chunk rather than the core for two reasons: the brief makes it a
 * key-pages-only event alongside forms and clicks, and keeping the Performance API
 * out of the core is what holds it inside its 5 KB budget.
 */
function reportLoadSpeed(hooks: InteractionHooks): void {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    if (!nav || nav.type !== 'navigate') return;

    const contentful =
      performance.getEntriesByName('first-contentful-paint')[0]?.startTime ??
      nav.domContentLoadedEventEnd;

    if (contentful > SLOW_PAGE_MS) {
      hooks.track(AUTO_EVENTS.slowPage, {
        path: location.pathname,
        kind: 'load',
        durationMs: Math.round(contentful),
      });
    }
  } catch {
    // No Performance API: the speed signal is simply absent.
  }
}

/** A button's own words, which is how a plan is identified. Never page text. */
function labelOf(target: EventTarget | null): string {
  try {
    const element = (target as Element | null)?.closest?.('button, a, [role="button"], label');
    const text = element?.getAttribute('aria-label') ?? element?.textContent ?? '';
    return text.trim().slice(0, 80);
  } catch {
    return '';
  }
}

/**
 * Dead click: nothing on the page changed after the click. A MutationObserver is the
 * cheapest honest test — no change to the DOM, no navigation, no scroll.
 */
function watchForChange(target: EventTarget | null, hooks: InteractionHooks): void {
  try {
    let changed = false;
    const observer = new MutationObserver(() => {
      changed = true;
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    const path = location.pathname;
    const scroll = window.scrollY;

    setTimeout(() => {
      observer.disconnect();
      if (changed || location.pathname !== path || window.scrollY !== scroll) return;
      hooks.track(AUTO_EVENTS.deadClick, { path, label: labelOf(target) });
    }, DEAD_CLICK_WINDOW_MS);
  } catch {
    // No MutationObserver: dead clicks are simply not detected.
  }
}
