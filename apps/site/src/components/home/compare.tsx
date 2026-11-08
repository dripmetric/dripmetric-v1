import { SectionHead } from '@/components/ui/section-head';
import { COMPARISON } from '@/content/site';
import { withBase } from '@/lib/paths';

/** 10 · Where it fits — neutral, dated category descriptions; no claims about rivals. */
export function Compare() {
  return (
    <section className="section section--paper2" id="compare" aria-labelledby="compare-title">
      <div className="wrap">
        <SectionHead
          n="08"
          kicker="Where it fits"
          id="compare-title"
          title="Built for the gap between your analytics and your billing."
          lede="Most small teams stitch this together from tools that each see half the story. Dripmetric doesn’t replace them; it joins product and money for one job: finding the revenue you’re losing."
        />
        <div className="table-wrap" data-reveal>
          <table className="matrix matrix--compare">
            <caption className="visually-hidden">
              How Dripmetric compares with adjacent tool categories
            </caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Built for</th>
                <th scope="col">For example</th>
                <th scope="col">Dripmetric’s approach</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.category}>
                  <th scope="row">{row.category}</th>
                  <td data-label="Built for">{row.builtFor}</td>
                  <td data-label="For example">{row.examples}</td>
                  <td data-label="Dripmetric’s approach">{row.approach}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="footnote">
          Category descriptions as of November 2026. Product names are trademarks of their owners.
        </p>
        <a className="more-link" href={withBase('/compare/posthog')}>
          Dripmetric vs PostHog, side by side →
        </a>
      </div>
    </section>
  );
}
