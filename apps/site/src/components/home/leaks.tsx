import { SectionHead } from '@/components/ui/section-head';
import { LEAK_STAGES } from '@/content/site';
import { withBase } from '@/lib/paths';

/**
 * Where leaks happen, in three stages of one plain line each. No rules, thresholds or
 * per-leak tags on the home page (founder's call, 21 Nov 2026); /leaks names all nine,
 * and the exact rules are for invited founders.
 */
export function Leaks() {
  return (
    <section className="section" id="leaks" aria-labelledby="leaks-title">
      <div className="wrap">
        <SectionHead
          label="How Dripmetric finds them"
          id="leaks-title"
          title="Nine leaks, from signup to renewal."
          lede="Dripmetric reads your product and payment events together and watches for nine kinds of leak across the whole journey."
        />
        <ol className="stages">
          {LEAK_STAGES.map((stage) => (
            <li className="stage-col" key={stage.id}>
              <h3 className="stage-col__title">{stage.title}</h3>
              <p className="stage-col__line">{stage.line}</p>
            </li>
          ))}
        </ol>
        <p className="section__foot">
          <a href={withBase('/leaks')}>See all nine leaks</a>
        </p>
      </div>
    </section>
  );
}
