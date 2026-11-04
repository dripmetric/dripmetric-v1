import { SectionHead } from '@/components/ui/section-head';
import { MODULES } from '@/content/site';

/** 09 · The eight dashboard modules and the Monday report (packages/engine/src/reports). */
export function Dashboard() {
  return (
    <section className="section" id="dashboard" aria-labelledby="dash-title">
      <div className="wrap">
        <SectionHead
          n="07"
          kicker="The dashboard"
          id="dash-title"
          title="Eight questions, answered in your own words."
        />
        <div className="dash">
          <ol className="modules" data-reveal>
            {MODULES.map((module, index) => (
              <li key={module.title}>
                <span className="modules__n">{String(index + 1).padStart(2, '0')}</span>
                <strong>{module.title}</strong> {module.body}
              </li>
            ))}
          </ol>

          <div className="report" data-reveal>
            <div className="card email-card">
              <div className="email-card__head">
                <p>
                  <span className="email-card__k">From</span> Dripmetric
                </p>
                <p>
                  <span className="email-card__k">When</span> Monday, 08:00 your time
                </p>
                <p className="email-card__subject">
                  3 users with buying intent didn’t pay last week
                </p>
              </div>
              <div className="email-card__body">
                <p className="email-card__h">Last week</p>
                <p>3 users reached high buying intent in the last 7 days and have not paid.</p>
                <p className="email-card__h">Your biggest leak</p>
                <p>Connect a data source — 58% of people stop here.</p>
                <p className="email-card__h">The change you made</p>
                <p>
                  “Shortened the step 2 form” — waiting for 100 people in each window before calling
                  a result.
                </p>
              </div>
            </div>
            <p className="sample-label">Sample weekly leak report · simulated data</p>
            <p className="report__note">
              <strong>Before-and-after proof.</strong> Mark a change and Dripmetric compares
              completion across equal windows, with at least 100 people in each before it reports a
              result. Quiet hours and a cap of 10 instant alerts a day keep the noise down; the rest
              wait for the weekly report.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
