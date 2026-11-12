import { FACTS } from '@/content/site';

/** Measured facts only — the Ground Truth appendix's "can be stated as fact" group. */
export function Facts() {
  return (
    <section className="facts" aria-labelledby="facts-title">
      <div className="wrap">
        <h2 id="facts-title" className="visually-hidden">
          Measured on the shipping code
        </h2>
        <dl className="facts__grid">
          {FACTS.map((fact) => (
            <div className="fact" key={fact.value}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
