import type { ReactNode } from 'react';

interface Qa {
  id: string;
  q: string;
  a: ReactNode;
}

/**
 * Answers are written to stand alone: the first sentence answers the question, the rest
 * qualifies it. They are restated in content/index.body.md for the Markdown copy.
 */
const FAQ: Qa[] = [
  {
    id: 'faq-what',
    q: 'What is Dripmetric?',
    a: 'Dripmetric is a revenue-leak detector for self-serve software. It reads your product’s usage events — and, if you send them, your payment events — on one event schema, and automatically flags the moments where a signup was on its way to becoming revenue and didn’t: an onboarding stall, an abandoned checkout, a trial that ended unpaid, a payment that failed, a paying customer going quiet. It is built for small teams, roughly from a few hundred signups a month.',
  },
  {
    id: 'faq-leak',
    q: 'What counts as a revenue leak?',
    a: 'A revenue leak is a point in the customer journey where someone who was likely to pay stops, without an error, a complaint or an event that says so. Dripmetric tracks nine of them as named rules: onboarding stall, step completion collapse, pricing quick exit, cancelled or payment failed, last-moment drop, high-intent user went quiet, trial ended unpaid, payer going quiet, and limit reached with no upgrade.',
  },
  {
    id: 'faq-stripe',
    q: 'Do I need Stripe, or any billing integration?',
    a: 'No. Dripmetric never connects to a billing provider. You send payment events the same way as any other event, so Stripe, Paddle, Lemon Squeezy, Chargebee, Razorpay, RevenueCat or your own billing table all work the same way. With no payment events at all you still get the funnel, step timing, the buying-intent score and four of the nine leaks. One paid event switches on the other five and puts a dollar figure on each.',
  },
  {
    id: 'faq-setup',
    q: 'How long does setup take?',
    a: 'About 10–15 lines of code for a typical team product, most of which the AI-coder prompt writes for you in Cursor, Copilot or similar. The promise every feature is held to: a real drop-off number in under 10 minutes, from product events alone.',
  },
  {
    id: 'faq-posthog',
    q: 'How is Dripmetric different from PostHog, Mixpanel or Amplitude?',
    a: (
      <>
        Those are general-purpose product analytics platforms: you explore any event data and build
        the funnels, queries and alerts you need. PostHog can also hold revenue next to product
        events —{' '}
        <a href="https://posthog.com/docs/revenue-analytics/start-here" rel="noopener">
          its revenue analytics
        </a>{' '}
        was in beta as of November 2026. Dripmetric is narrower on purpose: nine leak rules, a
        transparent intent score and masked alerts, ready on day one, over one schema of product and
        payment events. Many teams keep their analytics tool for exploration and use Dripmetric for
        the money questions.
      </>
    ),
  },
  {
    id: 'faq-recovery',
    q: 'How is it different from churn-recovery tools like Churnkey or Baremetrics Recover?',
    a: 'Recovery tools act after a card fails: retries, dunning emails, cancel flows. Dripmetric watches the whole path before that — onboarding, buying intent, checkout and trials — and puts failed payments on the same timeline. It does not retry cards or send emails itself.',
  },
  {
    id: 'faq-email',
    q: 'Does Dripmetric email or nudge my users?',
    a: 'No. Dripmetric observes and reports to you; it never contacts your users. It sends no drip campaigns, recovery emails or in-app prompts. The only messages it sends are to you: alerts in Slack, Discord or the app, and your weekly report.',
  },
  {
    id: 'faq-masked',
    q: 'What does the free plan include, and what does “masked” mean?',
    a: (
      <>
        Free includes the full funnel and step timing, the buying-intent score, all nine leaks,
        instant alerts, the weekly leak report, tracking health, before-and-after proof and segment
        splits — free forever. Masked means each person appears as a stable tag such as{' '}
        <span className="mono">User A7F2C1</span> instead of a name, with coarse times like “this
        week”. Starter reveals the name, email and id behind the tag and the signals behind each
        score.
      </>
    ),
  },
  {
    id: 'faq-intent',
    q: 'How is the buying-intent score calculated?',
    a: 'It adds points for transparent signals, from 0 to 100: starting checkout +30, reaching activation +25, hitting a plan limit or paywall +20, asking to talk to someone +20, inviting a teammate +15, reading pricing +10 (and +10 more for weighing the plans), and smaller signals, with −20 for a throwaway email address. The score halves every quiet week. 30 and above is warm; 60 and above is high intent. Every point on screen names the rule that produced it.',
  },
  {
    id: 'faq-speed',
    q: 'Will the SDK slow down my site or app?',
    a: 'No. The browser core is 5,018 bytes gzipped, and the build fails if it grows past 5,120. It sends in batches off the rendering path, never throws, keeps at most 1,000 events in memory and uses 3-second timeouts — so even a Dripmetric outage cannot slow a page load or break a request.',
  },
  {
    id: 'faq-data',
    q: 'What data does Dripmetric store?',
    a: 'The events you send: the event name, when it happened, the person’s id in your system, the page, and the properties you choose. Emails and name-like traits are encrypted at rest; IP addresses are never stored; there is no session replay or fingerprinting. Raw events are kept for 90 days on Free and 13 months on paid plans, with daily summaries kept forever. You are the data controller, and one API call deletes everything held about a person.',
  },
  {
    id: 'faq-stacks',
    q: 'Which languages and frameworks does it support?',
    a: (
      <>
        The <code>dripmetric</code> npm package covers the browser and Node. The snippet generator
        covers Next.js App Router, Node/Express, Django, Flask, Rails, Laravel, Go net/http and
        plain HTTP. Python, Ruby, PHP and Go can use Segment’s open-source libraries pointed at
        Dripmetric’s host, any language can call the HTTPS API, and Segment, RudderStack or PostHog
        can forward events with no code.
      </>
    ),
  },
];

/** 13 · Frequently asked questions — visible HTML only (FAQ rich results are gone). */
export function Faq() {
  return (
    <section className="section" id="faq" aria-labelledby="faq-title">
      <div className="wrap faq">
        <header className="section-head" data-reveal>
          <p className="kicker">
            <span className="kicker__n">11</span> Questions
          </p>
          <h2 id="faq-title" className="h2">
            Frequently asked questions
          </h2>
        </header>
        <div className="faq__list" data-reveal>
          {FAQ.map((item, index) => (
            <details className="qa" id={item.id} key={item.id} open={index === 0}>
              <summary>
                <h3>{item.q}</h3>
              </summary>
              <div className="qa__a">
                <p>{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
