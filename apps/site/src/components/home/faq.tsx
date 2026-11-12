import { isValidElement, type ReactNode } from 'react';
import { SectionHead } from '@/components/ui/section-head';
import type { FaqItem } from '@/lib/markdown';
import { withBase } from '@/lib/paths';

interface Qa {
  id: string;
  q: string;
  a: ReactNode;
}

/**
 * The questions people ask before they join, and the ones answer engines are asked
 * about Dripmetric. Each answer stands alone: the first sentence answers the question
 * and names the product, the rest qualifies it. They are restated in
 * content/index.body.md for the Markdown copy. Questions a guide page owns (what a
 * revenue leak is, how the score is calculated) are answered there, not here.
 */
const FAQ: Qa[] = [
  {
    id: 'faq-what',
    q: 'What is Dripmetric?',
    a: 'Dripmetric is a revenue-leak detector for self-serve SaaS. It reads your product’s usage events and, if you send them, your payment events, and flags the moments where a signup was on its way to becoming revenue and stopped: an onboarding stall, an abandoned checkout, a trial that ended unpaid, a failed payment, a paying customer going quiet. It is built for small teams, from a few hundred signups a month.',
  },
  {
    id: 'faq-email',
    q: 'Is Dripmetric an email or drip-campaign tool?',
    a: 'No. Dripmetric observes and reports to you. It never contacts your users, and it sends no drip campaigns, recovery emails or in-app prompts. The only messages it sends go to you: alerts in Slack, Discord or the app, and a weekly leak report.',
  },
  {
    id: 'faq-stripe',
    q: 'Do I need Stripe, or any billing integration?',
    a: 'No. Dripmetric never connects to a billing provider. You send payment events the same way as any other event, so Stripe, Paddle, Lemon Squeezy, Chargebee, Razorpay, RevenueCat or your own billing table all work the same way. With no payment events at all you still get the funnel, step timing, the buying-intent score and four of the nine leaks.',
  },
  {
    id: 'faq-setup',
    q: 'How long does Dripmetric take to set up?',
    a: (
      <>
        About 10–15 lines of code for a typical product, most of which the AI-coder prompt writes
        for you in Cursor or Copilot. The promise every feature is held to is a real drop-off number
        in under 10 minutes, from product events alone.{' '}
        <a href={withBase('/docs')}>The install guide</a> has the code.
      </>
    ),
  },
  {
    id: 'faq-posthog',
    q: 'How is Dripmetric different from PostHog, Mixpanel or Amplitude?',
    a: (
      <>
        Those are general-purpose product analytics platforms: you explore any event data and build
        the funnels, queries and alerts you need. Dripmetric is narrower on purpose. It ships nine
        leak rules, a transparent buying-intent score and masked alerts, ready on day one, over
        product and payment events together. Many teams keep their analytics tool and add Dripmetric
        for the money questions. <a href={withBase('/compare/posthog')}>Dripmetric vs PostHog</a>{' '}
        compares the two.
      </>
    ),
  },
  {
    id: 'faq-safe',
    q: 'Will the Dripmetric SDK slow my site, and what data does it store?',
    a: 'No. The browser core is 5,018 bytes gzipped. It sends in batches off the rendering path, never throws, and uses 3-second timeouts, so even a Dripmetric outage cannot slow a page. It stores the events you send. Where consent is required, nothing is stored on a visitor’s device, and nothing is sent, until they consent. IP addresses are never stored, emails are encrypted at rest, and one API call deletes everything held about a person.',
  },
  {
    id: 'faq-cost',
    q: 'How much does Dripmetric cost?',
    a: (
      <>
        Dripmetric is free forever for where and how much revenue leaks. Starter, which shows who,
        is $24.99 a month. <a href={withBase('/pricing')}>Full pricing</a> lists what each plan
        includes.
      </>
    ),
  },
];

/** The visible text of an answer, for the FAQPage JSON-LD: same words, no markup. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

/** The questions and answers exactly as shown, for structured data. */
export const HOME_FAQ: FaqItem[] = FAQ.map((item) => ({
  question: item.q,
  answer: textOf(item.a).replace(/\s+/g, ' ').trim(),
}));

/**
 * Native <details>: the answers are in the HTML whether open or closed, so nothing
 * depends on JavaScript. The FAQPage JSON-LD is built from HOME_FAQ, so it can only
 * describe what is on the page. (Google stopped showing FAQ rich results in May 2026;
 * the markup stays because it is accurate.)
 */
export function Faq() {
  return (
    <section className="section section--alt" id="faq" aria-labelledby="faq-title">
      <div className="wrap faq">
        <SectionHead label="Questions" id="faq-title" title="Frequently asked questions" />
        <div className="faq__list">
          {FAQ.map((item, index) => (
            <details className="qa" id={item.id} key={item.id} open={index === 0}>
              <summary>
                <h3>{item.q}</h3>
              </summary>
              <p className="qa__a">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
