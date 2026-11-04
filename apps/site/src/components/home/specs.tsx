import { MEASURED } from '@/content/site';

/** 02 · Measured facts only — the Ground Truth appendix's "can be stated as fact" group. */
export function Specs() {
  return (
    <section className="specs" aria-labelledby="specs-title">
      <div className="wrap">
        <h2 id="specs-title" className="kicker">
          Measured on the shipping code · November 2026
        </h2>
        <dl className="specs__grid">
          {MEASURED.map((fact) => (
            <div className="spec" key={fact.value}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
