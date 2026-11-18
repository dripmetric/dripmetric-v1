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
 * about Dripmetric: who it is for, what it never touches, how it differs, what happens
 * after joining (the playbook's "answer the related questions on the one page"). Each
 * answer stands alone: the first sentence answers and names the product. They are
 * restated in content/index.body.md for the Markdown copy.
 *
 * Users are described in the present tense ("does not message them"), not "never":
 * messaging a founder's users is a later layer that is not built (docs/publishing.md),
 * and a promise the roadmap would break is not one to make on the page.
 */
const FAQ: Qa[] = [
  {
    id: 'faq-what',
    q: 'What is Dripmetric?',
    a: 'Dripmetric is a revenue-leak detector for self-serve SaaS. It reads your product’s usage events and, if you send them, your payment events, and flags the moments where a signup was on its way to becoming revenue and stopped: an onboarding stall, an abandoned checkout, a trial that ended unpaid, a failed payment, a paying customer going quiet.',
  },
  {
    id: 'faq-who',
    q: 'Who is Dripmetric for?',
    a: 'Small self-serve SaaS teams, from a few hundred signups a month, who want to know where people stop between signing up and paying. It suits products where people sign up and pay without talking to sales.',
  },
  {
    id: 'faq-touch',
    q: 'What does Dripmetric never touch?',
    a: 'Your billing provider: Dripmetric never connects to one, and payment events arrive only because you send them. Your visitors’ devices before consent: where consent is required, nothing is stored or sent until it is given. IP addresses, which are never stored. Keystrokes and screens: there is no session replay or fingerprinting. And your users themselves: Dripmetric does not message them.',
  },
  {
    id: 'faq-stripe',
    q: 'Do I need Stripe, or any billing integration?',
    a: 'No. You send payment events the same way as any other event, so Stripe, Paddle, Lemon Squeezy, Chargebee, Razorpay, RevenueCat or your own billing table all work the same way. With no payment events at all you still get the funnel, step timing, the buying-intent score and four of the nine leaks.',
  },
  {
    id: 'faq-email',
    q: 'Is Dripmetric an email or drip-campaign tool?',
    a: 'No. Dripmetric watches and reports to you. It does not send email, drip campaigns or in-app messages to your users. The only messages it sends go to you: alerts in Slack, Discord or the app, and a weekly leak report.',
  },
  {
    id: 'faq-posthog',
    q: 'How is Dripmetric different from PostHog, Mixpanel or Amplitude?',
    a: (
      <>
        Those are general-purpose product analytics platforms: you explore any event data and build
        the funnels, queries and alerts you need. Dripmetric is narrower on purpose. It ships nine
        leak rules, a buying-intent score and alerts, ready on day one, over product and payment
        events together. Many teams keep their analytics tool and add Dripmetric for the money
        questions. <a href={withBase('/compare/posthog')}>Dripmetric vs PostHog</a> compares the
        two.
      </>
    ),
  },
  {
    id: 'faq-speed',
    q: 'Will the Dripmetric SDK slow my site?',
    a: 'No. The browser core is 5,018 bytes gzipped, and the build fails if it grows past 5,120. It sends in batches off the rendering path, never throws, and uses 3-second timeouts, so even a Dripmetric outage cannot slow a page or break a request.',
  },
  {
    id: 'faq-after',
    q: 'What happens after I join the waitlist?',
    a: 'Dripmetric is in private beta, and founders are invited weekly in small cohorts. Your invite brings your project keys and the install guide. Your email is used only to let you in and to share launch news, and you can ask for it to be removed at any time.',
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
