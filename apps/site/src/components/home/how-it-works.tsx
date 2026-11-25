import type { ReactNode } from 'react';
import { SectionHead } from '@/components/ui/section-head';
import { withBase } from '@/lib/paths';

const S = ({ children }: { children: string }) => <span className="tok-s">{children}</span>;
const C = ({ children }: { children: string }) => <span className="tok-c">{children}</span>;
const N = ({ children }: { children: string }) => <span className="tok-n">{children}</span>;

const STEPS: { title: string; body: ReactNode }[] = [
  {
    title: 'Add 10–15 lines',
    body: (
      <>
        <code>identify()</code> and <code>track()</code> where they belong, in your app and on your
        server. Or paste our prompt into Cursor or Copilot and let it write the integration.
      </>
    ),
  },
  {
    title: 'Keep your own event names',
    body: (
      <>
        Dripmetric matches them to its own events, with suggestions you confirm. Nothing in your
        code gets renamed.
      </>
    ),
  },
  {
    title: 'Let the leaks find you',
    body: (
      <>
        Dripmetric watches on its own. Alerts go to Slack or Discord, and a leak report arrives
        every Monday.
      </>
    ),
  },
];

/**
 * A sample walk-through of setup: three steps and the calls a founder adds. Event names
 * and properties are the catalog's own (packages/catalog/src/events.ts); the calls are the
 * SDK's (packages/sdk). No install command and no package name: the SDK is not on a public
 * registry before launch, and the install steps come with an invite (docs/decisions.md,
 * 2026-11-25).
 */
export function HowItWorks() {
  return (
    <section className="section" id="how-it-works" aria-labelledby="how-title">
      <div className="wrap">
        <SectionHead
          label="Setup"
          id="how-title"
          title="A few lines of code. A real number in under 10 minutes."
        />
        <div className="how">
          <ol className="steps">
            {STEPS.map((step, index) => (
              <li className="step" key={step.title}>
                <span className="step__n" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="step__title">{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="code" role="group" aria-label="Setup example">
            <p className="code__file">In your app</p>
            <pre tabIndex={0} role="region" aria-label="Browser example">
              <code>
                dripmetric.init(<S>{"'pk_live_…'"}</S>);
                {'\n'}dripmetric.identify(user.id, {'{'} email: user.email {'}'});
                {'\n'}dripmetric.track(<S>{"'Onboarding Step Completed'"}</S>, {'{'}
                {'\n  '}step: <S>{"'connect-data'"}</S>,{'\n'}
                {'});'}
              </code>
            </pre>
            <p className="code__file">From your billing webhook, any provider</p>
            <pre tabIndex={0} role="region" aria-label="Server example">
              <code>
                <C>{'// One call. No billing integration.'}</C>
                {'\n'}dm.track(user.id, <S>{"'Subscription Started'"}</S>, {'{'}
                {'\n  '}plan: <S>{"'pro'"}</S>, amount: <N>4900</N>, currency: <S>{"'usd'"}</S>,
                {'\n'}
                {'});'}
              </code>
            </pre>
          </div>
        </div>
        <p className="section__foot">
          Payment events arrive like any other event, so Stripe, Paddle, Lemon Squeezy, Chargebee,
          Razorpay, RevenueCat and your own billing table all work the same way. Already on Segment,
          RudderStack or PostHog? Forward events with no code.{' '}
          <a href={withBase('/docs')}>See how setup works</a>.
        </p>
      </div>
    </section>
  );
}
