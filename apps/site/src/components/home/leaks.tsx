import { SectionHead } from '@/components/ui/section-head';
import { LEAK_STAGES } from '@/content/site';
import { withBase } from '@/lib/paths';

/**
 * The nine leaks, by where in the journey they happen. One rule per stage is printed in
 * full, in the engine's own words; the rest are named and linked to /leaks, which
 * explains every rule, its threshold and the data it needs.
 */
export function Leaks() {
  return (
    <section className="section" id="leaks" aria-labelledby="leaks-title">
      <div className="wrap">
        <SectionHead
          label="What it catches"
          id="leaks-title"
          title="Nine leaks. Each one a rule you can read."
          lede="A revenue leak is a point where someone who was likely to pay stops, with no error, no complaint and no event to say so. Dripmetric watches for nine of them. There is no black box: every leak is a plain-language rule with a visible default."
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
          Four leaks run on product events alone. One paid event switches on the other five and puts
          a dollar figure on each. <a href={withBase('/leaks')}>Read every rule in full</a>.
        </p>
      </div>
    </section>
  );
}
