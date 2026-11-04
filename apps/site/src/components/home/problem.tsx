import { SectionHead } from '@/components/ui/section-head';

const SILENT = [
  'A new user stalls on step 2 of onboarding and never comes back.',
  'A step that converted fine starts converting worse after a release — and nobody notices for a month.',
  'Someone views pricing twice, starts checkout, then goes quiet for a week.',
  'A trial ends, and nobody notices it ended unpaid.',
  'A payment fails and the subscription just stops.',
  'A paying customer’s usage quietly halves, long before they cancel.',
];

/** 03 · The problem, in the founder's words, with two sourced third-party benchmarks. */
export function Problem() {
  return (
    <section className="section" id="problem" aria-labelledby="problem-title">
      <div className="wrap">
        <SectionHead
          n="01"
          kicker="The problem"
          id="problem-title"
          title="Revenue rarely leaks loudly."
          lede="Most of what a self-serve product loses has nothing to do with whether the product is good. It is lost to silence: someone who was going to pay quietly stops — no error, no complaint, no event that says so."
        />

        <ol className="silent-list">
          {SILENT.map((line, index) => (
            <li key={line}>
              <span className="silent-list__n">{String(index + 1).padStart(2, '0')}</span>
              {line}
            </li>
          ))}
        </ol>

        <div className="split-story" data-reveal>
          <div className="split-story__side">
            <p className="split-story__label">Product analytics</p>
            <p>Knows what happened in your product. Knows nothing about money.</p>
          </div>
          <div className="split-story__side">
            <p className="split-story__label">Billing and recovery tools</p>
            <p>Know a card failed. Know nothing about what happened first.</p>
          </div>
          <div className="split-story__join">
            <p className="split-story__label">Dripmetric</p>
            <p>
              Puts both on one event stream, so one rule can say:{' '}
              <em>
                this person finished onboarding, hit a plan limit, viewed pricing twice — and then
                their payment failed.
              </em>
            </p>
          </div>
        </div>

        <div className="benchmarks" data-reveal>
          <figure className="benchmark">
            <p className="benchmark__n">37.5%</p>
            <figcaption>
              Average activation rate across 62 B2B SaaS companies. Most signups never reach the
              point where the product works for them.
              <cite>
                <a href="https://userpilot.com/saas-product-metrics/" rel="noopener">
                  Userpilot, SaaS Product Metrics Benchmark Report 2025
                </a>
              </cite>
            </figcaption>
          </figure>
          <figure className="benchmark">
            <p className="benchmark__n">≈ ⅓</p>
            <figcaption>
              of SaaS churn in Recurly’s benchmark is involuntary — payments that failed, not
              customers who chose to leave (1.06 of 3.22 points).
              <cite>
                <a href="https://www.recurly.com/research/churn-rate-benchmarks" rel="noopener">
                  Recurly churn rate benchmarks, data as of July 2026
                </a>
              </cite>
            </figcaption>
          </figure>
          <p className="benchmarks__note">Third-party benchmarks, not Dripmetric data.</p>
        </div>
      </div>
    </section>
  );
}
