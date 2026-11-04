import { FoundingSeatLink } from '@/components/founding-seat-link';
import { SectionHead } from '@/components/ui/section-head';
import { ADDONS, PLANS, SITE } from '@/content/site';

/** 12 · Pricing, from the same PLANS data the JSON-LD offers are built from. */
export function Pricing() {
  return (
    <section className="section section--paper2" id="pricing" aria-labelledby="pricing-title">
      <div className="wrap">
        <SectionHead
          n="10"
          kicker="Pricing"
          id="pricing-title"
          title="Free for where and how much. $39 a month for who."
          center
        />
        <div className="plans">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={plan.flag ? 'plan plan--featured' : 'plan'}
              aria-labelledby={`plan-${plan.id}`}
              data-reveal
            >
              {plan.flag ? <p className="plan__flag">{plan.flag}</p> : null}
              <h3 id={`plan-${plan.id}`} className="plan__name">
                {plan.name}
              </h3>
              <p className="plan__price">
                <span className="plan__amount">${plan.price}</span>{' '}
                <span className="plan__per">{plan.per}</span>
                {plan.listPrice ? (
                  <s className="plan__list">
                    <span className="visually-hidden">List price </span>${plan.listPrice}
                  </s>
                ) : null}
              </p>
              <p className="plan__pitch">{plan.pitch}</p>
              <ul className="ticks">
                {plan.includes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {plan.cta === 'founding' ? (
                <FoundingSeatLink url={SITE.foundingSeatUrl} className="btn btn--primary">
                  Claim a founding seat
                </FoundingSeatLink>
              ) : (
                <a className="btn btn--ghost" href="#get-access">
                  Get early access
                </a>
              )}
            </article>
          ))}
        </div>

        <div className="addons" data-reveal>
          <p className="addons__title">Want a hand?</p>
          {ADDONS.map((addon) => (
            <p key={addon.name}>
              <strong>
                {addon.name} — ${addon.price}
              </strong>{' '}
              <s>
                <span className="visually-hidden">list price </span>${addon.listPrice}
              </s>
              : {addon.what}
            </p>
          ))}
        </div>
        <p className="footnote footnote--center">Prices in US dollars.</p>
      </div>
    </section>
  );
}
