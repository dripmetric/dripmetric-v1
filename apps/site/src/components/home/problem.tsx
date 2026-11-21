import { SectionHead } from '@/components/ui/section-head';
import { RESEARCH } from '@/content/site';

/**
 * The problem, in general terms, backed by outside research instead of our own
 * examples (founder's call, 21 Nov 2026). Every figure is third-party, named and
 * linked; RESEARCH in src/content/site.ts says when each was checked.
 */
export function Problem() {
  return (
    <section className="section section--alt" id="problem" aria-labelledby="problem-title">
      <div className="wrap split">
        <SectionHead label="The problem" id="problem-title" title="Revenue rarely leaks loudly." />
        <div className="split__body">
          <p className="lede">
            Most of what a self-serve product loses, it loses quietly. People stall before the
            product works for them, hesitate before they pay, or slip away after, and nothing raises
            an error.
          </p>
          <p>
            Product analytics sees what people did, but not the money. Billing sees the money, but
            not what happened first. The leak sits in the gap between them.
          </p>
          <ul className="findings" aria-label="What the research says">
            {RESEARCH.map((item) => (
              <li key={item.id}>
                <p>{item.finding}</p>
                <a href={item.url} rel="noopener">
                  {item.source}
                </a>
              </li>
            ))}
          </ul>
          <p className="sources">Third-party research, not Dripmetric data.</p>
        </div>
      </div>
    </section>
  );
}
