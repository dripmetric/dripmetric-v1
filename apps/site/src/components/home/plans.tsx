import { SectionHead } from '@/components/ui/section-head';
import { PLANS } from '@/content/site';
import { withBase } from '@/lib/paths';

/**
 * What it costs, explained by what each plan shows: the same alert, masked on Free and
 * revealed on Starter. Prices come from PLANS, which the JSON-LD offers are built from
 * too. What each plan includes in full, and the add-ons, are on /pricing.
 */
export function Plans() {
  return (
    <section className="section" id="pricing" aria-labelledby="pricing-title">
      <div className="wrap plans">
        <div className="plans__copy">
          <SectionHead
            label="Pricing"
            id="pricing-title"
            title="Free shows where and how much. Starter shows who."
          />
          <dl className="plan-list">
            {PLANS.map((plan) => (
              <div className="plan" key={plan.id}>
                <dt>
                  <span className="plan__name">{plan.name}</span>
                  <span className="plan__price">
                    <strong>${plan.price}</strong> {plan.per}
                  </span>
                </dt>
                <dd>{plan.includes}</dd>
              </div>
            ))}
          </dl>
          <p className="section__foot">
            Prices in US dollars. <a href={withBase('/pricing')}>See full pricing</a>.
          </p>
        </div>

        <figure className="reveal" aria-labelledby="reveal-caption">
          <div className="mini-alert">
            <p className="mini-alert__plan">Free</p>
            <p className="mini-alert__who mono">User A7F2C1</p>
            <p className="mini-alert__meta">75 of 100 · Pro · $49.00 at stake · this week</p>
          </div>
          <div className="mini-alert mini-alert--revealed">
            <p className="mini-alert__plan">Starter</p>
            <p className="mini-alert__who">Maya Okafor</p>
            <p className="mini-alert__email mono">maya@northwind.example</p>
            <p className="mini-alert__meta">75 of 100 · Pro · $49.00 at stake · this week</p>
          </div>
          <p className="reveal__note">
            On Free, every alert is real: the leak, the score, the plan and the money at stake. Only
            the person is masked, behind a stable tag. Masking is enforced on our server, so a free
            project’s pages, alerts and API responses never contain a name, an email or a user id.
          </p>
          <figcaption id="reveal-caption" className="sample-label">
            The same sample alert on each plan. Simulated person.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
