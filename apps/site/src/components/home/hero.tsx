import { SignupForm } from '@/components/signup-form';
import { BrandMark } from '@/components/ui/brand';
import { SITE } from '@/content/site';

const FUNNEL = [
  { label: 'Signed up', n: '1,240' },
  { label: 'Verified email', n: '1,018' },
  { label: 'Connected a data source', n: '431', leak: '−58% · biggest leak' },
  { label: 'Activated', n: '352' },
  { label: 'Started checkout', n: '97' },
  { label: 'Paid', n: '61' },
];

/** 01 · What it is, who it is for, what to do — plus the product as proof. */
export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero__grid">
        <div className="hero__copy">
          <p className="eyebrow">
            <span className="eyebrow__dot" aria-hidden="true" />
            Revenue-leak detection for self-serve software
          </p>
          <h1 id="hero-title" className="display">
            Find the revenue leaking out of your <span className="accent">signup funnel.</span>
          </h1>
          <p className="lede hero__lede">
            Dripmetric watches product usage and payments on one event stream and tells you,
            automatically, where signups stall, who looked ready to buy and went quiet — and what
            it’s costing you.
          </p>
          <SignupForm
            source="hero"
            idPrefix="hero"
            endpoint={SITE.waitlistEndpoint}
            contactEmail={SITE.contactEmail}
            noteId="hero-email-note"
          >
            <ul className="signup__notes" id="hero-email-note">
              <li>Free plan, forever</li>
              <li>No billing integration</li>
              <li>A real number in under 10 minutes</li>
            </ul>
          </SignupForm>
        </div>

        <figure className="hero__proof" aria-labelledby="hero-proof-caption">
          <div className="card funnel-card" aria-hidden="true">
            <div className="card__bar">
              <span className="card__title">Your funnel</span>
              <span className="card__meta">Last 30 days</span>
            </div>
            <ol className="funnel">
              {FUNNEL.map((step) => (
                <li key={step.label} className={step.leak ? 'is-leak' : undefined}>
                  <span className="funnel__label">{step.label}</span>
                  <span className="funnel__n">{step.n}</span>
                  {step.leak ? <span className="funnel__flag">{step.leak}</span> : null}
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
              <span className="dot dot--warn" aria-hidden="true" />
              Someone with buying intent went quiet
            </p>
            <p className="alert-card__says">
              They looked ready to buy — 75 out of 100 — and have not been back for 7 days.
            </p>
            <dl className="alert-card__fields">
              <div>
                <dt>Who (masked)</dt>
                <dd className="mono">User A7F2C1</dd>
              </div>
              <div>
                <dt>Buying intent</dt>
                <dd>75 of 100 · high</dd>
              </div>
              <div>
                <dt>Plan</dt>
                <dd>Pro</dd>
              </div>
              <div>
                <dt>At stake</dt>
                <dd className="at-stake">$49.00 at your list price</dd>
              </div>
              <div>
                <dt>When</dt>
                <dd>this week</dd>
              </div>
            </dl>
            <p className="alert-card__rule">
              Rule: reached 60 or more on buying intent, then 7 days without doing anything, and
              never paid.
            </p>
          </div>
          <figcaption id="hero-proof-caption" className="sample-label">
            Sample alert and funnel · simulated data
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
