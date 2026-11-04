import { CodeTabs, type CodeSample } from '@/components/code-tabs';
import { SectionHead } from '@/components/ui/section-head';
import { STACKS } from '@/content/site';

const K = ({ children }: { children: string }) => <span className="tok-k">{children}</span>;
const S = ({ children }: { children: string }) => <span className="tok-s">{children}</span>;
const C = ({ children }: { children: string }) => <span className="tok-c">{children}</span>;
const N = ({ children }: { children: string }) => <span className="tok-n">{children}</span>;

/** Event names and properties are the catalog's own (packages/catalog/src/events.ts). */
const SAMPLES: CodeSample[] = [
  {
    id: 'browser',
    label: 'Browser',
    file: 'browser · your page shell',
    code: (
      <>
        <K>import</K> * <K>as</K> dripmetric <K>from</K> <S>{"'dripmetric/browser'"}</S>;{'\n\n'}
        <C>{'// Once, in your page shell'}</C>
        {'\n'}dripmetric.init(<S>{"'pk_live_…'"}</S>);{'\n\n'}
        <C>{'// At signup, and on every app load'}</C>
        {'\n'}dripmetric.identify(user.id, {'{'} email: user.email {'}'});{'\n\n'}
        <C>{'// The moments that matter, in your own words'}</C>
        {'\n'}dripmetric.track(<S>{"'Onboarding Step Completed'"}</S>, {'{'}
        {'\n  '}step: <S>{"'connect-data'"}</S>,{'\n'}
        {'});'}
      </>
    ),
  },
  {
    id: 'server',
    label: 'Server',
    file: 'server · Node.js',
    code: (
      <>
        <K>import</K> {'{'} Dripmetric {'}'} <K>from</K> <S>{"'dripmetric/server'"}</S>;{'\n\n'}
        <K>const</K> dm = <K>new</K> Dripmetric({'{'}
        {'\n  '}secretKey: process.env.DRIPMETRIC_SECRET_KEY,{'\n'}
        {'});'}
        {'\n\n'}dm.track(user.id, <S>{"'Signed Up'"}</S>, {'{'} method: <S>{"'google'"}</S> {'}'});
        {'\n\n'}
        <C>{'// From your billing webhook — any provider'}</C>
        {'\n'}dm.track(user.id, <S>{"'Subscription Started'"}</S>, {'{'}
        {'\n  '}plan: <S>{"'pro'"}</S>, amount: <N>4900</N>, currency: <S>{"'usd'"}</S>,{'\n'}
        {'});'}
      </>
    ),
  },
  {
    id: 'http',
    label: 'Any language',
    file: 'any language · plain HTTPS',
    code: (
      <>
        {'curl https://api.dripmetric.com/v1/batch \\\n  -H '}
        <S>{'"Authorization: Bearer $DRIPMETRIC_SECRET_KEY"'}</S>
        {' \\\n  -H '}
        <S>{'"Content-Type: application/json"'}</S>
        {' \\\n  -d '}
        <S>
          {
            '\'{"batch":[{"type":"track",\n       "messageId":"evt-1","userId":"user_123",\n       "event":"Signed Up"}]}\''
          }
        </S>
      </>
    ),
  },
];

const STEPS = [
  {
    title: 'Install in about 10–15 lines',
    body: (
      <>
        <code>npm install dripmetric</code>, then <code>identify()</code>, <code>track()</code> and{' '}
        <code>group()</code> where they belong. Or paste our prompt into Cursor, Copilot or a
        similar AI coder and let it write the integration for you.
      </>
    ),
  },
  {
    title: 'Keep your own event names',
    body: (
      <>
        Dripmetric maps them to one schema of 76 canonical events — Signed Up, Checkout Started,
        Payment Failed — with AI-suggested matches you confirm in an Inbox. Nothing in your code
        gets renamed.
      </>
    ),
  },
  {
    title: 'Let the leaks find you',
    body: (
      <>
        The funnel, step timing and a buying-intent score update as events arrive. Nine leak rules
        run on their own and send masked alerts to Slack or Discord, plus a leak report every Monday
        morning in your timezone.
      </>
    ),
  },
];

/** 04 · How it works — the core promise, three steps and real install code. */
export function HowItWorks() {
  return (
    <section className="section section--ink" id="how-it-works" aria-labelledby="how-title">
      <div className="wrap">
        <SectionHead
          n="02"
          kicker="How it works"
          id="how-title"
          title="Paste a snippet. See a real number in under 10 minutes."
        />
        <div className="how">
          <ol className="steps">
            {STEPS.map((step, index) => (
              <li className="step" key={step.title} data-reveal>
                <p className="step__n">{String(index + 1).padStart(2, '0')}</p>
                <h3 className="step__title">{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="how__code">
            <CodeTabs samples={SAMPLES} />
            <div className="stacks">
              <p className="stacks__title">Ready-made snippets for</p>
              <ul className="chips">
                {STACKS.map((stack) => (
                  <li key={stack}>{stack}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <ul className="how__notes">
          <li>
            <strong>Already on Segment, RudderStack or PostHog?</strong> Forward events with no code
            — signature-verified, with a deny-by-default field allow-list.
          </li>
          <li>
            <strong>Python, Ruby, PHP or Go?</strong> Segment’s open-source libraries work pointed
            at our host. Anything else can use plain HTTPS.
          </li>
        </ul>
      </div>
    </section>
  );
}
