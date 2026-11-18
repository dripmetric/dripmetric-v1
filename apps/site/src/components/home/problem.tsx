import { SectionHead } from '@/components/ui/section-head';

const QUIET = [
  'Someone signs up, gets stuck on step two of onboarding, and never comes back.',
  'Someone reads your pricing twice, starts checkout, and stops.',
  'A trial ends unpaid, or a card fails, and nothing tells you.',
];

/**
 * The problem, in short. The two figures are third-party, sourced and dated, and they
 * are labelled as such; they were checked on 11 Nov 2026 (docs/decisions.md).
 */
export function Problem() {
  return (
    <section className="section section--alt" id="problem" aria-labelledby="problem-title">
      <div className="wrap split">
        <SectionHead label="The problem" id="problem-title" title="Revenue rarely leaks loudly." />
        <div className="split__body">
          <p className="lede">
            Most of what a self-serve product loses is lost in silence. Someone who was going to pay
            simply stops, with no error, no complaint and no event that says so.
          </p>
          <ul className="quiet">
            {QUIET.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p>
            Your product analytics sees what people did, but not the money. Your billing tool sees
            the money, but not what happened first. The leak sits in the gap between them.
          </p>
          <p className="sources">
            For scale: across 62 B2B SaaS companies, the average activation rate was 37.5% (
            <a href="https://userpilot.com/saas-product-metrics/" rel="noopener">
              Userpilot, 2025
            </a>
            ), and about a third of SaaS churn is a payment that failed rather than a customer who
            chose to leave (
            <a href="https://www.recurly.com/research/churn-rate-benchmarks" rel="noopener">
              Recurly, July 2026 data
            </a>
            ). Third-party figures, not Dripmetric data.
          </p>
        </div>
      </div>
    </section>
  );
}
