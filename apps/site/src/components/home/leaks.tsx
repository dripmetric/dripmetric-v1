import { SectionHead } from '@/components/ui/section-head';
import { LEAK_STAGES } from '@/content/site';
import { withBase } from '@/lib/paths';

/**
 * How Dripmetric finds leaks: nine rules, by where in the journey they happen. One rule
 * per stage is printed in full, in the engine's own words; the rest are named and linked
 * to /leaks, which explains every rule, its threshold, the data it needs and what to do.
 */
export function Leaks() {
  return (
    <section className="section" id="leaks" aria-labelledby="leaks-title">
      <div className="wrap">
        <SectionHead
          label="How Dripmetric finds them"
          id="leaks-title"
          title="Nine leaks. Each one a rule you can read."
          lede="Dripmetric puts your product events and payment events on one stream and checks them against nine plain-language rules. There is no black box: each rule says exactly what counts, and fires once per person per episode."
        />
        <ol className="stages">
          {LEAK_STAGES.map((stage) => (
            <li className="stage-col" key={stage.id}>
              <h3 className="stage-col__title">{stage.title}</h3>
              <div className="rule-card">
                <p className="rule-card__name">
                  <a href={withBase(`/leaks#${stage.featured.id}`)}>{stage.featured.name}</a>
                </p>
                <p className="rule-card__rule">
                  <span className="rule-card__tag">Rule</span> {stage.featured.rule}
                </p>
              </div>
              <ul className="stage-col__also" aria-label={`Also ${stage.title.toLowerCase()}`}>
                {stage.also.map((leak) => (
                  <li key={leak.id}>
                    <a href={withBase(`/leaks#${leak.id}`)}>{leak.name}</a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="section__foot">
          Four of the rules run on product events alone. One payment event from your billing webhook
          switches on the other five.{' '}
          <a href={withBase('/leaks')}>Every rule in full, with what to do about each</a>.
        </p>
      </div>
    </section>
  );
}
