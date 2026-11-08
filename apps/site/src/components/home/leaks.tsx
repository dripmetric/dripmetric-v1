import { SectionHead } from '@/components/ui/section-head';
import { LEAK_GROUPS } from '@/content/site';
import { withBase } from '@/lib/paths';

/** 05 · The nine leaks as one ruled ledger — the engine's own rule text, grouped by need. */
export function Leaks() {
  return (
    <section className="section" id="leaks" aria-labelledby="leaks-title">
      <div className="wrap">
        <SectionHead
          n="03"
          kicker="The nine leaks"
          id="leaks-title"
          title="Nine leaks, each a rule you can read."
          lede="No black box. Every leak is a plain-language rule with a visible default. Each fires at most once per person per episode, and never about someone who was deleted or opted out."
        />
        <div className="leak-groups">
          {LEAK_GROUPS.map((group) => (
            <section
              key={group.id}
              className={group.paid ? 'leak-group leak-group--paid' : 'leak-group'}
              aria-labelledby={`lg-${group.id}`}
            >
              <div className="leak-group__head">
                <h3 id={`lg-${group.id}`} className="leak-group__title">
                  {group.title}
                </h3>
                <span className={group.paid ? 'badge badge--leak' : 'badge'}>{group.badge}</span>
              </div>
              <ul className="leaks">
                {group.leaks.map((leak) => (
                  <li className="leak" id={`leak-${leak.id}`} key={leak.id} data-reveal>
                    <h4 className="leak__name">{leak.name}</h4>
                    <p className="leak__rule">{leak.rule}</p>
                    <p className="leak__how">{leak.how}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="footnote">
          Apart from the two leaks that are about paying customers, no leak ever fires about someone
          who has already paid.
        </p>
        <a className="more-link" href={withBase('/leaks')}>
          Every rule in full — thresholds, the data each needs, and what to do about it →
        </a>
      </div>
    </section>
  );
}
