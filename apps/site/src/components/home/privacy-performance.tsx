import { SectionHead } from '@/components/ui/section-head';

const PRIVACY = [
  'Nothing is stored on a visitor’s device — and nothing is sent — until they consent.',
  'Country comes from your platform’s header. The IP address is never stored.',
  'No session replay, keystroke capture or fingerprinting.',
  'Emails and name-like traits are encrypted at rest.',
  'You are the data controller; Dripmetric is the processor.',
  'One API call deletes everything held about a person.',
];

const PERFORMANCE = [
  '5,018 bytes gzipped for the browser core. Forms, clicks and speed capture load lazily, on your key pages only.',
  'Never blocks rendering. Never throws.',
  'At most 1,000 queued events; the oldest are dropped first.',
  '3-second timeouts, 3 retries, then a 60-second pause. If our API is down, that is our problem, not your page’s.',
];

/** 11 · Privacy by default and the SDK's promises (packages/sdk/README.md). */
export function PrivacyPerformance() {
  return (
    <section className="section" id="privacy" aria-labelledby="privacy-title">
      <div className="wrap">
        <SectionHead
          n="09"
          kicker="Privacy and performance"
          id="privacy-title"
          title="Private by default. Never in your users’ way."
        />
        <div className="two-col" data-reveal>
          <div>
            <h3 className="h3">Privacy</h3>
            <ul className="ticks">
              {PRIVACY.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="h3">Performance</h3>
            <ul className="ticks">
              {PERFORMANCE.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
