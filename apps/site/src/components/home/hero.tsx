import { SignupForm } from '@/components/signup-form';
import { BrandMark } from '@/components/ui/brand';
import { CTA_LABEL, DEFINITION, LEAK_STAGES, SITE } from '@/content/site';
import { WAITLIST_ID } from './site-header';

/** A simulated funnel. The third step is the leak: 587 of 1,018 people stop there. */
const FUNNEL = [
  { label: 'Signed up', n: 1240 },
  { label: 'Verified email', n: 1018 },
  { label: 'Connected a data source', n: 431, lost: 587 },
  { label: 'Activated', n: 352 },
  { label: 'Started checkout', n: 97 },
  { label: 'Paid', n: 61 },
];
const TOP = FUNNEL[0]?.n ?? 1;
const share = (n: number) => `${((n / TOP) * 100).toFixed(1)}%`;
const count = (n: number) => n.toLocaleString('en-US');

/**
 * The alert is the product's own: title and fields as packages/engine/src/alerts/payload.ts
 * builds them, the sentence as packages/engine/src/leaks/rules.ts writes it, and the rule
 * as the engine states it.
 */
const QUIET_RULE = LEAK_STAGES.flatMap((stage) => [stage.featured, ...stage.also]).find(
  (leak) => leak.id === 'high-intent-quiet',
)?.rule;

const ALERT_FIELDS = [
  { label: 'Who (masked)', value: 'User A7F2C1', mono: true },
  { label: 'Buying intent', value: '75 of 100 · high' },
  { label: 'Plan', value: 'Pro' },
  { label: 'At stake', value: '$49.00 at your list price', stake: true },
  { label: 'When', value: 'this week' },
];

/** What it is, who it is for, the one thing to do — then the product as proof. */
export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap">
        <div className="hero__copy">
          <p className="pill">
            <span className="pill__status">Private beta</span>
            Revenue-leak detection for self-serve SaaS
          </p>
          <h1 id="hero-title" className="display">
            Find the revenue <span className="leak-word">leaking</span> out of your signup funnel.
          </h1>
          <p className="lede">
            {DEFINITION} It reads your product and payment events and tells you where signups stall,
            who looked ready to buy and went quiet, and what it costs you.
          </p>
          <SignupForm
            source="hero"
            id={WAITLIST_ID}
            endpoint={SITE.waitlistEndpoint}
            contactEmail={SITE.contactEmail}
            label={CTA_LABEL}
            noteId="hero-note"
          >
            <ul className="assurances" id="hero-note">
              <li>Free plan, forever</li>
              <li>No billing integration</li>
              <li>10–15 lines to install</li>
            </ul>
          </SignupForm>
        </div>

        <figure className="showcase" aria-labelledby="showcase-caption">
          <div className="showcase__grid">
            <div className="card funnel-card">
              <div className="card__bar">
                <span className="card__title">Your funnel</span>
                <span className="card__meta">Last 30 days</span>
              </div>
              <ol className="funnel">
                {FUNNEL.map((step) => (
                  <li key={step.label} className={step.lost ? 'is-leak' : undefined}>
                    <span className="funnel__label">{step.label}</span>
                    <span className="funnel__n">{count(step.n)}</span>
                    <span className="funnel__track" aria-hidden="true">
                      <span className="funnel__bar" style={{ width: share(step.n) }} />
                      {step.lost ? (
                        <span
                          className="funnel__lost"
                          style={{ left: share(step.n), width: share(step.lost) }}
                        />
                      ) : null}
                    </span>
                    {step.lost ? (
                      <span className="funnel__flag">
                        <svg viewBox="0 0 12 16" aria-hidden="true" focusable="false">
                          <path d="M6 0S0 7.1 0 10.4a6 6 0 0 0 12 0C12 7.1 6 0 6 0z" />
                        </svg>
                        {count(step.lost)} people stopped here. Your biggest leak.
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>

            <div className="card alert-card">
              <div className="alert-card__head">
                <BrandMark className="alert-card__avatar" />
                <span className="alert-card__from">Dripmetric</span>
                <span className="tag">App</span>
                <span className="alert-card__channel">#revenue-leaks</span>
              </div>
              <p className="alert-card__title">
                <span className="dot" aria-hidden="true" />
                Someone with buying intent went quiet
              </p>
              <p className="alert-card__says">
                They looked ready to buy — 75 out of 100 — and have not been back for 7 days.
              </p>
              <dl className="alert-card__fields">
                {ALERT_FIELDS.map((field) => (
                  <div key={field.label}>
                    <dt>{field.label}</dt>
                    <dd className={field.mono ? 'mono' : field.stake ? 'at-stake' : undefined}>
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="alert-card__rule">Rule: {QUIET_RULE}</p>
            </div>
          </div>
          <figcaption id="showcase-caption" className="sample-label">
            Sample funnel and Slack alert. Simulated data.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
