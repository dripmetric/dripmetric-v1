import { PAGE_LEFT, type Message, type MessageContext } from '../shared/types.js';
import { SETTINGS_PATH } from '../shared/constants.js';
import { collectContext, paidClick } from './context.js';
import { ActivityTracker } from './activity.js';
import { Transport } from './transport.js';
import { anonymousId, clearIdentity, persistAnonymousId } from './storage.js';
import { clearSession, sessionId, touch } from './session.js';
import { normalisePath } from './paths.js';
import { uuid } from './ids.js';

/**
 * The browser client.
 *
 * Two rules shape everything here.
 *
 * **Never throws.** Every public call is wrapped (see `guard`). An analytics library
 * that can throw inside a founder's click handler is worse than no analytics.
 *
 * **Consent is absolute** (settled decision 13). With `requireConsent` on, nothing is
 * stored on the device and nothing is sent — not even the settings fetch — until
 * `consent(true)`. Events wait in memory with their ORIGINAL timestamps and flush
 * when consent arrives; if it never comes they are discarded.
 */

export interface InitOptions {
  /** Default true. A founder whose visitors need no banner turns it off in settings. */
  requireConsent?: boolean;
  /** Hosts where page titles may be sent. Titles are never sent from inside an app. */
  marketingHosts?: string[];
  /** A first-party route through the founder's own domain, so ad blockers do not
   *  drop page views. Defaults to our API. */
  host?: string;
  debug?: boolean;
}

interface ProjectSettings {
  /** Pages where forms, clicks and speed are captured. */
  keyPages?: string[];
  /** URL patterns that map to a meaning; the server owns the mapping. */
  rulePaths?: string[];
}

const DEFAULT_HOST = 'https://api.dripmetric.com';

export class Client {
  private transport: Transport | undefined;
  private activity = new ActivityTracker();
  private options: Required<Omit<InitOptions, 'marketingHosts'>> & { marketingHosts: string[] } = {
    requireConsent: true,
    marketingHosts: [],
    host: DEFAULT_HOST,
    debug: false,
  };

  private started = false;
  private consentGranted = false;
  private userId: string | undefined;
  private userIdHmac: string | undefined;
  private lastTraits = '';
  private currentPath = '';
  private pageViewId = '';
  private pageStartedAt = 0;
  private settings: ProjectSettings = {};
  private interactionsLoaded = false;
  private teardown: (() => void)[] = [];

  init(publishableKey: string, options: InitOptions = {}): void {
    this.guard(() => {
      if (this.started) {
        this.log('init() called twice; ignoring the second call');
        return;
      }
      if (!publishableKey) {
        this.log('init() needs your publishable key');
        return;
      }
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        // Imported on a server by mistake: do nothing rather than crash a render.
        return;
      }

      this.options = {
        requireConsent: options.requireConsent !== false,
        marketingHosts: options.marketingHosts ?? [],
        host: (options.host ?? DEFAULT_HOST).replace(/\/+$/, ''),
        debug: options.debug === true,
      };
      this.started = true;

      this.transport = new Transport({
        host: this.options.host,
        publishableKey,
        debug: this.options.debug,
        onDropped: (count) => this.log(`${count} events dropped in total`),
      });

      // With no banner required, we are consented from the start.
      if (!this.options.requireConsent) this.grantConsent();

      this.activity.start(Date.now());
      this.watchRoutes();
      this.watchPageEnd();
      this.page();
    });
  }

  /** `consent(true)` opens the gate. `consent(false)` keeps it shut and forgets. */
  consent(granted: boolean): void {
    this.guard(() => {
      if (!granted) {
        this.consentGranted = false;
        // Nothing waiting may ever be sent, and nothing is left on the device.
        this.transport?.discard();
        clearIdentity();
        clearSession();
        return;
      }
      this.grantConsent();
    });
  }

  private grantConsent(): void {
    if (this.consentGranted) return;
    this.consentGranted = true;
    // Only now may an id touch the device (settled decision 13).
    persistAnonymousId();
    this.transport?.allowSending();
    void this.fetchSettings();
    void this.transport?.flush();
  }

  identify(userId: string, traits: Record<string, unknown> = {}): void {
    this.guard(() => {
      if (!userId) return;
      this.userId = String(userId);
      if (typeof traits['userIdHmac'] === 'string') this.userIdHmac = traits['userIdHmac'];

      // Traits are sent only when they change: in a logged-in app `identify()` runs
      // on every page load, and resending the same traits is pure noise
      // (brief section 6).
      const fingerprint = JSON.stringify(traits);
      if (fingerprint === this.lastTraits) return;
      this.lastTraits = fingerprint;

      this.send({ type: 'identify', traits: this.withoutHmac(traits) });
    });
  }

  group(groupId: string, traits: Record<string, unknown> = {}): void {
    this.guard(() => {
      if (!groupId) return;
      this.send({ type: 'group', groupId: String(groupId), traits });
    });
  }

  track(event: string, properties: Record<string, unknown> = {}): void {
    this.guard(() => {
      if (!event) return;
      this.send({ type: 'track', event: String(event), properties });
    });
  }

  /** A page view. Called automatically on load and on every SPA route change. */
  page(properties: Record<string, unknown> = {}): void {
    this.guard(() => {
      const path = normalisePath(location.pathname, location.hash);

      // A route change ends the previous page view before starting this one.
      if (this.currentPath && this.currentPath !== path) this.endPageView();

      this.currentPath = path;
      this.pageViewId = uuid();
      this.pageStartedAt = Date.now();

      const click = paidClick();
      this.send({
        type: 'page',
        properties: {
          path,
          ...(click.paid ? { paidClick: true, paidNetwork: click.network } : {}),
          ...properties,
        },
      });

      void this.maybeLoadInteractions();
    });
  }

  /** Sends whatever is queued. Resolves when the attempt is over; never rejects. */
  flush(): Promise<void> {
    return this.transport?.flush() ?? Promise.resolve();
  }

  /** A logout. A new visitor and a new session from here on. */
  reset(): void {
    this.guard(() => {
      this.userId = undefined;
      this.userIdHmac = undefined;
      this.lastTraits = '';
      clearIdentity();
      clearSession();
    });
  }

  /** Tests and hot reloads: stop every listener and timer. */
  stop(): void {
    this.guard(() => {
      this.activity.stop();
      for (const off of this.teardown) off();
      this.teardown = [];
      this.transport?.discard();
      this.started = false;
    });
  }

  // --- internals --------------------------------------------------------------

  private withoutHmac(traits: Record<string, unknown>): Record<string, unknown> {
    if (!('userIdHmac' in traits)) return traits;
    const copy = { ...traits };
    delete copy['userIdHmac'];
    return copy;
  }

  private send(partial: Omit<Message, 'messageId' | 'timestamp' | 'context'>): void {
    if (!this.transport) return;
    const now = Date.now();
    touch(this.consentGranted, now);

    const context: MessageContext = collectContext({
      // The id only reaches the device once consent allows it.
      sessionId: sessionId(this.consentGranted, now),
      pageViewId: this.pageViewId,
      consentGranted: this.consentGranted,
      titleAllowed: this.titleAllowed(),
    });
    if (this.userIdHmac) context.userIdHmac = this.userIdHmac;

    this.transport.enqueue({
      ...partial,
      messageId: uuid(),
      // The ORIGINAL time, so an event that waited for consent is not misdated.
      timestamp: new Date(now).toISOString(),
      ...(this.userId ? { userId: this.userId } : {}),
      anonymousId: anonymousId(this.consentGranted),
      context,
    });
  }

  /** Titles only on marketing hosts and pages that match a rule (brief section 10). */
  private titleAllowed(): boolean {
    try {
      if (this.options.marketingHosts.includes(location.hostname)) return true;
      return (this.settings.rulePaths ?? []).some((p) => matches(this.currentPath, p));
    } catch {
      return false;
    }
  }

  private isKeyPage(): boolean {
    return (this.settings.keyPages ?? []).some((p) => matches(this.currentPath, p));
  }

  /**
   * Page Left carries the running totals for the page view that is ending
   * (brief section 6). The id is deterministic per page view, so a repeat raises
   * the stored numbers instead of being dropped as a duplicate.
   */
  private endPageView(beacon = false): void {
    if (!this.currentPath || !this.transport) return;
    const totals = beacon ? this.activity.peekTotals() : this.activity.takeTotals();

    const message: Message = {
      type: 'page',
      name: PAGE_LEFT,
      // Deterministic per page view: the server updates rather than dedupes.
      messageId: `pl-${this.pageViewId}`,
      timestamp: new Date().toISOString(),
      ...(this.userId ? { userId: this.userId } : {}),
      anonymousId: anonymousId(this.consentGranted),
      properties: {
        path: this.currentPath,
        activeSeconds: totals.activeSeconds,
        deepestScroll: totals.deepestScroll,
        pageViewId: this.pageViewId,
      },
      context: collectContext({
        sessionId: sessionId(this.consentGranted, Date.now()),
        pageViewId: this.pageViewId,
        consentGranted: this.consentGranted,
        titleAllowed: this.titleAllowed(),
      }),
    };

    if (beacon) {
      const pending = this.transport.drain();
      this.transport.sendBeacon([...pending, message]);
    } else {
      this.transport.enqueue(message);
    }
  }

  /**
   * Single-page-app route changes (brief section 6): the History API is patched, and
   * `popstate` and `hashchange` cover the back button and hash routers.
   */
  private watchRoutes(): void {
    const announce = () => {
      // A microtask, so the framework has finished updating `location`.
      setTimeout(() => this.page(), 0);
    };

    try {
      const history = window.history;
      for (const name of ['pushState', 'replaceState'] as const) {
        const original = history[name];
        const patched = function (this: History, ...args: Parameters<History['pushState']>) {
          const result = original.apply(this, args);
          announce();
          return result;
        };
        history[name] = patched as History[typeof name];
        this.teardown.push(() => {
          history[name] = original;
        });
      }

      for (const type of ['popstate', 'hashchange'] as const) {
        window.addEventListener(type, announce);
        this.teardown.push(() => window.removeEventListener(type, announce));
      }
    } catch {
      // A locked-down environment: automatic SPA page views are off, and the
      // founder can still call page() themselves.
    }
  }

  /** The last moment of a page: a beacon, because a fetch would be cancelled. */
  private watchPageEnd(): void {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') this.endPageView(true);
    };
    try {
      document.addEventListener('visibilitychange', onHidden);
      window.addEventListener('pagehide', () => this.endPageView(true));
      this.teardown.push(() => document.removeEventListener('visibilitychange', onHidden));
    } catch {
      // No document: nothing to watch.
    }
  }

  /**
   * Forms, rage and dead clicks and pricing interactions load LAZILY, after the page
   * is idle and only on key pages (brief section 6). Keeping them out of the core is
   * what holds it inside its 5 KB budget.
   */
  private async maybeLoadInteractions(): Promise<void> {
    if (this.interactionsLoaded || !this.isKeyPage()) return;
    this.interactionsLoaded = true;

    const load = async () => {
      try {
        const module = await import('./interactions.js');
        const stop = module.watchInteractions({
          track: (event, properties) => this.track(event, properties),
          isPricingPage: () => /pricing/.test(this.currentPath),
        });
        this.teardown.push(stop);
      } catch (error) {
        this.log(`could not load interaction capture: ${String(error)}`);
      }
    };

    // After the page is idle, so nothing competes with the founder's own work.
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void })
      .requestIdleCallback;
    if (idle) idle(() => void load());
    else setTimeout(() => void load(), 2000);
  }

  /**
   * Key pages and URL rules come from project settings, fetched ONCE consent allows
   * and cached in memory only — never written to the device (brief section 6).
   */
  private async fetchSettings(): Promise<void> {
    if (!this.transport?.isSendingAllowed()) return;
    try {
      const response = await fetch(`${this.options.host}${SETTINGS_PATH}`, {
        credentials: 'omit',
      });
      if (response.ok) {
        this.settings = (await response.json()) as ProjectSettings;
        /*
         * Try the lazy chunk again now that we know which pages are key pages.
         *
         * Settings are fetched asynchronously, and `init()` sends the first page
         * view immediately, so on the landing page `isKeyPage()` was always false
         * when it was first asked — interaction capture never started at all. The
         * landing page is often the ONLY page in a session, so this was most of the
         * forms-and-friction signal, silently missing. Playwright caught it.
         */
        void this.maybeLoadInteractions();
      }
    } catch {
      // Settings are an optimisation: without them, interaction capture stays off
      // and page views still work.
    }
  }

  /** Every public call goes through this. The SDK never throws into the app. */
  private guard(action: () => void): void {
    try {
      action();
    } catch (error) {
      this.log(`caught: ${String(error)}`);
    }
  }

  private log(message: string): void {
    if (this.options.debug) console.warn(`[dripmetric] ${message}`);
  }
}

/** `/onboarding/*` style globs, the only wildcard key pages and rules support. */
function matches(path: string, pattern: string): boolean {
  if (!pattern.includes('*')) return path === pattern;
  return new RegExp(
    '^' +
      pattern
        .split('*')
        .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      '$',
  ).test(path);
}
