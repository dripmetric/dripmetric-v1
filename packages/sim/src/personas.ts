import type { MessageInput } from '@dripmetric/catalog';
import type { VirtualClock } from './clock.js';
import type { Rng } from './random.js';
import type { PersonaKey, ProductDefinition, SimMessage, UserTruth } from './types.js';

/**
 * Personas (brief section 10).
 *
 * Each function plays one person through one product and records what really happened
 * as it goes. The truth is not inferred from the events afterwards — it is written
 * down at the moment the decision is made, which is the only way an engine can be
 * scored rather than compared against itself.
 */

const FREE_EMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com'];
const WORK_EMAIL_DOMAINS = ['acme.com', 'northwind.io', 'globex.co', 'initech.dev', 'umbrella.app'];
const DISPOSABLE_DOMAINS = ['mailinator.com', 'yopmail.com', '10minutemail.com'];

const CRAWLER_AGENTS = [
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
];

const DESKTOP_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
];

const MOBILE_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
];

const REFERRERS = [
  'https://www.google.com/',
  'https://news.ycombinator.com/',
  'https://www.g2.com/categories/invoicing',
  'https://www.capterra.com/',
  'https://twitter.com/',
  '',
];

const COUNTRIES = ['US', 'GB', 'DE', 'IN', 'CA', 'AU', 'BR', 'NL'];

/** Everything one persona run needs, so the functions below stay readable. */
export interface PersonaContext {
  rng: Rng;
  clock: VirtualClock;
  product: ProductDefinition;
  index: number;
}

interface Person {
  userId: string;
  anonymousId: string;
  sessionId: string;
  email: string;
  userAgent: string;
  country: string;
  referrer: string;
  accountId: string | null;
}

/** A builder that collects messages and keeps the truth in step with them. */
class Journey {
  readonly messages: SimMessage[] = [];
  readonly truth: UserTruth;
  private pageViewCounter = 0;

  constructor(
    private readonly context: PersonaContext,
    private readonly person: Person,
    persona: PersonaKey,
  ) {
    this.truth = {
      userId: person.userId,
      anonymousId: person.anonymousId,
      persona,
      product: context.product.key,
      email: person.email,
      signedUpAt: null,
      activatedAt: null,
      paidAt: null,
      stalledAtStep: null,
      expectStallLeak: false,
      expectHighIntent: false,
      expectFiltered: false,
      stepsCompleted: [],
      eventCount: 0,
      accountId: person.accountId,
      lastEventAt: null,
    };
  }

  /** A new session: the SDK would start one after 30 minutes idle. */
  newSession(): void {
    this.person.sessionId = this.context.rng.id('sess');
  }

  private context_(): MessageInput['context'] {
    return {
      userAgent: this.person.userAgent,
      sessionId: this.person.sessionId,
      locale: 'en-US',
      timezone: 'Europe/Berlin',
      library: { name: 'dripmetric', version: '2.0.0' },
      consent: { granted: true },
      page: { referrer: this.person.referrer },
      screen: { width: /Mobile|iPhone|Android/.test(this.person.userAgent) ? 390 : 1512 },
    };
  }

  private push(message: MessageInput, serverSide: boolean): void {
    const at = this.context.clock.now();
    this.messages.push({ message, at, persona: this.truth.persona, serverSide });
    this.truth.eventCount += 1;
    this.truth.lastEventAt = at.toISOString();
  }

  private base(): { messageId: string; timestamp: string } {
    return {
      messageId: this.context.rng.id('msg', 16),
      timestamp: this.context.clock.now().toISOString(),
    };
  }

  /** An anonymous page view, before the person is known. */
  anonymousPage(path: string, activeSeconds: number): void {
    this.pageViewCounter += 1;
    const pageViewId = `${this.person.sessionId}-${this.pageViewCounter}`;

    this.push(
      {
        type: 'page',
        ...this.base(),
        anonymousId: this.person.anonymousId,
        properties: { path },
        context: { ...this.context_(), page: { path, referrer: this.person.referrer }, pageViewId },
      },
      false,
    );

    this.context.clock.advanceSeconds(activeSeconds);

    // Page Left carries the running totals the browser SDK accumulates.
    this.push(
      {
        type: 'page',
        ...this.base(),
        anonymousId: this.person.anonymousId,
        name: 'Page Left',
        properties: {
          path,
          activeSeconds,
          deepestScroll: this.context.rng.int(20, 100),
          pageViewId,
        },
        context: { ...this.context_(), page: { path }, pageViewId },
      },
      false,
    );
  }

  /** A page view by a known person. */
  page(path: string, activeSeconds: number): void {
    this.pageViewCounter += 1;
    const pageViewId = `${this.person.sessionId}-${this.pageViewCounter}`;

    this.push(
      {
        type: 'page',
        ...this.base(),
        userId: this.person.userId,
        anonymousId: this.person.anonymousId,
        properties: { path },
        context: { ...this.context_(), page: { path }, pageViewId },
      },
      false,
    );

    this.context.clock.advanceSeconds(activeSeconds);

    this.push(
      {
        type: 'page',
        ...this.base(),
        userId: this.person.userId,
        anonymousId: this.person.anonymousId,
        name: 'Page Left',
        properties: {
          path,
          activeSeconds,
          deepestScroll: this.context.rng.int(20, 100),
          pageViewId,
        },
        context: { ...this.context_(), page: { path }, pageViewId },
      },
      false,
    );
  }

  identify(traits: Record<string, unknown>): void {
    this.push(
      {
        type: 'identify',
        ...this.base(),
        userId: this.person.userId,
        anonymousId: this.person.anonymousId,
        traits,
        context: this.context_(),
      },
      // Sent from the server, so ad blockers and declined consent cannot stop it.
      true,
    );
  }

  group(traits: Record<string, unknown>): void {
    if (!this.person.accountId) return;
    this.push(
      {
        type: 'group',
        ...this.base(),
        userId: this.person.userId,
        groupId: this.person.accountId,
        traits,
        context: this.context_(),
      },
      true,
    );
  }

  /** A tracked event. `serverSide` events go through a secret key. */
  track(event: string, properties: Record<string, unknown> = {}, serverSide = false): void {
    this.push(
      {
        type: 'track',
        ...this.base(),
        userId: this.person.userId,
        anonymousId: this.person.anonymousId,
        event,
        ...(Object.keys(properties).length > 0 ? { properties } : {}),
        context: this.context_(),
      },
      serverSide,
    );
  }

  /** Completes a funnel step and records it in the truth. */
  completeStep(label: string): void {
    const step = this.context.product.steps.find((s) => s.label === label);
    if (!step) throw new Error(`${this.context.product.key} has no step "${label}".`);

    if (step.eventName) {
      this.track(step.eventName, {}, true);
    } else if (step.urlPattern) {
      // A URL-rule step is reached by visiting the page.
      this.page(step.urlPattern, this.context.rng.int(20, 180));
    }
    // The founder's own step event, which is how a step with no URL is reported.
    this.track('Onboarding Step Completed', { step: label }, true);
    this.truth.stepsCompleted.push(label);
  }

  /** Enters a step without completing it: what a stall looks like. */
  enterStep(label: string): void {
    const step = this.context.product.steps.find((s) => s.label === label);
    if (!step) throw new Error(`${this.context.product.key} has no step "${label}".`);
    this.track('Onboarding Step Viewed', { step: label }, false);
    if (step.urlPattern) this.page(step.urlPattern, this.context.rng.int(15, 90));
  }

  signUp(): void {
    const method = this.context.rng.pick(['email', 'google', 'github']);
    this.identify({
      email: this.person.email,
      createdAt: this.context.clock.now().toISOString(),
      signupMethod: method,
      ...(this.context.product.hasAccounts ? { role: 'owner', joinedVia: 'self' } : {}),
    });
    this.track('Signed Up', { method }, true);
    this.truth.signedUpAt = this.context.clock.now().toISOString();
    this.truth.stepsCompleted.push('Create account');

    if (this.context.product.hasAccounts && this.person.accountId) {
      this.group({
        name: `${this.person.email.split('@')[1]?.split('.')[0] ?? 'team'} workspace`,
        domain: this.person.email.split('@')[1] ?? 'example.com',
      });
    }
  }

  activate(): void {
    this.track('Activated', {}, true);
    this.truth.activatedAt = this.context.clock.now().toISOString();
    if (!this.truth.stepsCompleted.includes(this.lastStepLabel())) {
      this.truth.stepsCompleted.push(this.lastStepLabel());
    }
  }

  private lastStepLabel(): string {
    const last = this.context.product.steps[this.context.product.steps.length - 1];
    return last?.label ?? 'Activated';
  }

  /** Pricing, with the behaviour that distinguishes a studier from a glancer. */
  viewPricing(activeSeconds: number, deliberate: boolean): void {
    this.page('/pricing', activeSeconds);
    this.track('Pricing Viewed', { from: 'menu', repeat: false, activeSeconds }, false);
    if (deliberate) {
      this.track('Pricing Interaction', { kind: 'toggle', plan: 'annual' }, false);
      this.track('Plan Selected', { plan: 'pro', interval: 'month' }, false);
    }
  }

  startCheckout(type: 'purchase' | 'trial' = 'purchase'): void {
    this.track(
      'Checkout Started',
      {
        plan: 'pro',
        amount: this.context.product.listPriceAmount,
        currency: this.context.product.listPriceCurrency,
        type,
      },
      true,
    );
  }

  /** The paid event. Billing-sourced, so it must go through a secret key. */
  pay(): void {
    this.track(
      'Subscription Started',
      {
        plan: 'pro',
        amount: this.context.product.listPriceAmount,
        currency: this.context.product.listPriceCurrency,
        interval: 'month',
      },
      true,
    );
    this.truth.paidAt = this.context.clock.now().toISOString();
  }

  startTrial(): void {
    if (this.context.product.trialDays === null) return;
    const endsAt = new Date(
      this.context.clock.nowMs() + this.context.product.trialDays * 86400 * 1000,
    );
    this.identify({
      trialStartedAt: this.context.clock.now().toISOString(),
      trialEndsAt: endsAt.toISOString(),
      cardRequired: false,
    });
    this.track(
      'Trial Started',
      { plan: 'trial', trialEndsAt: endsAt.toISOString(), cardRequired: false },
      true,
    );
  }

  coreAction(times: number): void {
    for (let i = 0; i < times; i++) {
      // The founder's OWN name. Mapped to Core Action at setup, which is the point.
      this.track(this.context.product.coreActionName, { object: 'item', count: i + 1 }, false);
      this.context.clock.advanceMinutes(this.context.rng.int(1, 20));
    }
  }

  markStalled(step: string, expectLeak: boolean): void {
    this.truth.stalledAtStep = step;
    this.truth.expectStallLeak = expectLeak;
  }

  markHighIntent(): void {
    this.truth.expectHighIntent = true;
  }

  markFiltered(): void {
    this.truth.expectFiltered = true;
  }
}

function makePerson(context: PersonaContext, persona: PersonaKey): Person {
  const { rng, product, index } = context;

  const domain =
    persona === 'tourist'
      ? rng.pick(DISPOSABLE_DOMAINS)
      : persona === 'internal'
        ? 'ledgerly-internal.com'
        : product.hasAccounts || persona === 'converter'
          ? rng.pick(WORK_EMAIL_DOMAINS)
          : rng.pick([...WORK_EMAIL_DOMAINS, ...FREE_EMAIL_DOMAINS]);

  const userAgent =
    persona === 'bot'
      ? rng.pick(CRAWLER_AGENTS)
      : rng.chance(persona === 'converter' ? 0.8 : 0.55)
        ? rng.pick(DESKTOP_AGENTS)
        : rng.pick(MOBILE_AGENTS);

  return {
    userId: `user_${product.key}_${index}`,
    anonymousId: rng.id('anon'),
    sessionId: rng.id('sess'),
    email: `person${index}@${domain}`,
    userAgent,
    country: rng.pick(COUNTRIES),
    referrer: rng.pick(REFERRERS),
    accountId: product.hasAccounts ? `account_${product.key}_${Math.floor(index / 3)}` : null,
  };
}

/** Plays one person and returns their messages plus what really happened. */
export function playPersona(
  context: PersonaContext,
  persona: PersonaKey,
): { messages: SimMessage[]; truth: UserTruth } {
  const person = makePerson(context, persona);
  const journey = new Journey(context, person, persona);
  const { rng, clock, product } = context;

  switch (persona) {
    case 'bot': {
      // A crawler reads a few marketing pages and leaves. Ingest must drop all of it.
      journey.markFiltered();
      for (const path of ['/', '/pricing', '/docs']) journey.anonymousPage(path, rng.int(1, 3));
      break;
    }

    case 'internal': {
      // The founder's own team. Signs up properly, and must still vanish from
      // every number because the address is on the internal list.
      journey.markFiltered();
      journey.anonymousPage('/', rng.int(5, 30));
      journey.signUp();
      journey.completeStep(product.steps[1]?.label ?? 'Create account');
      break;
    }

    case 'tourist': {
      // A disposable address, a glance at pricing, gone. Intent must stay low and
      // nothing should ever alert about them.
      journey.anonymousPage('/', rng.int(3, 20));
      // The quick exit: under 10 seconds, no interaction, session ends.
      journey.viewPricing(rng.int(2, 8), false);
      if (rng.chance(0.4)) {
        journey.signUp();
        journey.startTrial();
        clock.advanceHours(rng.int(1, 6));
        journey.enterStep(product.steps[1]?.label ?? 'Create account');
        journey.markStalled(product.steps[1]?.label ?? 'Create account', true);
      }
      break;
    }

    case 'converter': {
      // Two visits before signing up, then straight through, then pays.
      journey.anonymousPage('/', rng.int(20, 90));
      journey.viewPricing(rng.int(25, 120), true);
      clock.advanceDays(rng.int(1, 3));
      journey.newSession();
      journey.anonymousPage('/', rng.int(10, 40));

      journey.signUp();
      journey.startTrial();

      for (const step of product.steps.slice(1, -1)) {
        clock.advanceMinutes(rng.int(1, 25));
        journey.completeStep(step.label);
      }
      clock.advanceMinutes(rng.int(2, 30));
      journey.activate();

      // Uses the product properly over the next few days.
      for (let day = 1; day <= rng.int(3, 7); day++) {
        clock.advanceToHour(1, rng.int(9, 18));
        journey.newSession();
        journey.coreAction(rng.int(2, 6));
      }

      if (product.hasAccounts) journey.track('Invite Sent', { count: rng.int(1, 4) }, true);
      if (product.hasPlanLimits) journey.track('Plan Limit Reached', { limit: 'events' }, true);

      clock.advanceToHour(1, 11);
      journey.newSession();
      journey.viewPricing(rng.int(30, 150), true);
      journey.startCheckout();
      clock.advanceMinutes(rng.int(1, 8));
      journey.pay();
      journey.markHighIntent();
      break;
    }

    case 'staller': {
      // Signs up, enters step 2, and never comes back. The stall leak must catch
      // this; it is the single biggest group in the mix.
      journey.anonymousPage('/', rng.int(10, 60));
      journey.signUp();
      journey.startTrial();

      const stallStep = product.steps[rng.int(1, Math.max(1, product.steps.length - 2))];
      const label = stallStep?.label ?? product.steps[1]?.label ?? 'Create account';

      // Completes whatever comes before the one they get stuck on.
      for (const step of product.steps.slice(1)) {
        if (step.label === label) break;
        clock.advanceMinutes(rng.int(1, 20));
        journey.completeStep(step.label);
      }

      clock.advanceMinutes(rng.int(1, 15));
      journey.enterStep(label);
      journey.markStalled(label, true);

      // Then silence, long past the 24-hour default and past any step's
      // 90th-percentile elapsed time.
      clock.advanceHours(rng.int(49, 200));
      break;
    }

    case 'intent-then-leaves': {
      // Everything a buyer does, and then nothing. This is the group the whole
      // product exists for, so the intent engine must flag them.
      journey.anonymousPage('/', rng.int(20, 80));
      journey.signUp();
      journey.startTrial();

      for (const step of product.steps.slice(1, -1)) {
        clock.advanceMinutes(rng.int(2, 40));
        journey.completeStep(step.label);
      }
      clock.advanceMinutes(rng.int(5, 60));
      journey.activate();

      clock.advanceToHour(1, rng.int(9, 17));
      journey.newSession();
      journey.coreAction(rng.int(3, 8));

      if (product.hasPlanLimits) {
        journey.track(
          'Plan Limit Approached',
          { limit: 'events', used: 8200, maximum: 10000 },
          true,
        );
        journey.track('Plan Limit Reached', { limit: 'events' }, true);
        journey.track('Upgrade Prompt Viewed', { prompt: 'event-limit', paywall: true }, false);
      }
      if (product.hasAccounts) journey.track('Invite Sent', { count: rng.int(1, 3) }, true);

      clock.advanceToHour(1, rng.int(10, 16));
      journey.newSession();
      journey.viewPricing(rng.int(40, 200), true);

      // Gets as far as checkout and abandons: the last-moment drop.
      if (rng.chance(0.55)) {
        journey.startCheckout();
        // No Subscription Started: the 2-hour rule turns this into a leak.
      }

      journey.markHighIntent();
      // Then goes quiet for well over the 7 days the "went quiet" leak waits.
      clock.advanceDays(rng.int(8, 20));
      break;
    }

    case 'payer-gone-quiet': {
      // Pays, uses it properly for a month, then halves their activity two weeks
      // running. The payer-going-quiet leak must notice.
      journey.anonymousPage('/', rng.int(15, 60));
      journey.signUp();
      journey.startTrial();

      for (const step of product.steps.slice(1, -1)) {
        clock.advanceMinutes(rng.int(1, 20));
        journey.completeStep(step.label);
      }
      journey.activate();

      journey.viewPricing(rng.int(30, 120), true);
      journey.startCheckout();
      clock.advanceMinutes(rng.int(1, 5));
      journey.pay();

      // Four weeks of healthy use: this is the baseline the drop is measured against.
      for (let week = 0; week < 4; week++) {
        for (let day = 0; day < 4; day++) {
          clock.advanceToHour(1, rng.int(9, 18));
          journey.newSession();
          journey.coreAction(rng.int(3, 7));
        }
        clock.advanceToHour(3, 10);
      }

      // Then two weeks at well under half the baseline.
      for (let week = 0; week < 2; week++) {
        clock.advanceToHour(4, rng.int(9, 18));
        journey.newSession();
        journey.coreAction(1);
        clock.advanceToHour(3, 10);
      }
      break;
    }
  }

  return { messages: journey.messages, truth: journey.truth };
}
