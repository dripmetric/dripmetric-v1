import { SectionHead } from '@/components/ui/section-head';
import { INTENT_SIGNALS, SAMPLE_SCORE } from '@/content/site';

/** 06 · The buying-intent score (packages/engine/src/intent/points.ts) and masking. */
export function Intent() {
  return (
    <section className="section section--paper2" id="intent" aria-labelledby="intent-title">
      <div className="wrap">
        <SectionHead
          n="04"
          kicker="Buying intent"
          id="intent-title"
          title="Know who looked ready to buy — and why."
          lede="Every tracked user gets a 0–100 buying-intent score: the self-serve version of a product-qualified lead score. It is built from rules, not a black box. Every point names the signal that earned it, and the score halves every quiet week."
        />
        <div className="intent">
          <div className="card score-card" data-reveal>
            <div className="score-card__top">
              <div>
                <p className="score-card__who mono">User A7F2C1</p>
                <p className="score-card__band">High intent</p>
              </div>
              <p className="score-card__score">
                <span>75</span>
                <small>/100</small>
              </p>
            </div>
            <div className="bands" aria-hidden="true">
              <span className="bands__seg">cold</span>
              <span className="bands__seg">warm</span>
              <span className="bands__seg bands__seg--high">high</span>
              <span className="bands__marker" />
            </div>
            <ol className="score-lines">
              {SAMPLE_SCORE.map((line) => (
                <li key={line.why}>
                  <span className="pts">{line.points}</span> {line.why}
                </li>
              ))}
            </ol>
            <p className="sample-label">Sample score · simulated data</p>
          </div>

          <div className="intent__side">
            <details className="signals">
              <summary>All 14 signals and their points</summary>
              <table className="signals__table">
                <caption className="visually-hidden">Buying-intent signals and points</caption>
                <thead>
                  <tr>
                    <th scope="col">Signal</th>
                    <th scope="col">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {INTENT_SIGNALS.map((row) => (
                    <tr key={row.signal}>
                      <td>{row.signal}</td>
                      <td>{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="note">
                Bands: 30+ is warm, 60+ is high intent. Points are suggestions you approve — never
                re-weighted automatically.
              </p>
            </details>

            <div className="reveal-compare">
              <h3 className="h3">Free shows where and how much. Starter shows who.</h3>
              <div className="reveal-compare__cards">
                <div className="mini-alert">
                  <p className="mini-alert__plan">Free</p>
                  <p className="mini-alert__who mono">User A7F2C1</p>
                  <p className="mini-alert__meta">75 of 100 · Pro · $49.00 at stake · this week</p>
                </div>
                <div className="mini-alert mini-alert--revealed">
                  <p className="mini-alert__plan">Starter</p>
                  <p className="mini-alert__who">Maya Okafor</p>
                  <p className="mini-alert__email mono">maya@northwind.example</p>
                  <p className="mini-alert__meta">Plus the signals behind her score</p>
                </div>
              </div>
              <p>
                On Free, every alert is real — the leak, the score, the plan and the money at stake
                — except who, which sits behind a stable tag like{' '}
                <span className="mono">User A7F2C1</span>. Masking is enforced on our server, so a
                free project’s pages, alerts and API responses never contain a name, an email or a
                user id.
              </p>
              <p className="sample-label">Sample alerts · simulated people</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
