# Dripmetric — revenue-leak detection for self-serve SaaS

Canonical: [Dripmetric — revenue-leak detection for self-serve SaaS](https://dripmetric.com/)

Locale: en

Purpose: What Dripmetric is, the waitlist, the problem of silent revenue leaks, the nine leak rules by stage, what you get when a leak is found, a setup walk-through, and the questions asked before joining

Content updated: 2026-11-18

Source revision: site-2026-11-18

Maintenance owner: Dripmetric (hello@dripmetric.com)

[Topic map](https://dripmetric.com/llm/topics/product.md) · [Complete scoped map](https://dripmetric.com/sitemap.md)

See where your signup funnel leaks revenue.

Dripmetric is a revenue-leak detector for self-serve SaaS. It watches your product and payment events, catches the moment a likely buyer stops, and tells you where it happened and what it is worth.

Status: private beta. Founders are invited weekly, in small cohorts. [Join the waitlist](https://dripmetric.com/#waitlist) with a work email.

- No billing integration.
- Keeps your own event names.
- 10–15 lines to install.

## The problem: revenue rarely leaks loudly

Most of what a self-serve product loses is lost in silence. Someone who was going to pay simply stops, with no error, no complaint and no event that says so.

- Someone signs up, gets stuck on step two of onboarding, and never comes back.
- Someone reads your pricing twice, starts checkout, and stops.
- A trial ends unpaid, or a card fails, and nothing tells you.

Your product analytics sees what people did, but not the money. Your billing tool sees the money, but not what happened first. The leak sits in the gap between them.

For scale: across 62 B2B SaaS companies, the average activation rate was 37.5% ([Userpilot, 2025](https://userpilot.com/saas-product-metrics/)), and about a third of SaaS churn is a payment that failed rather than a customer who chose to leave ([Recurly, July 2026 data](https://www.recurly.com/research/churn-rate-benchmarks)). Third-party figures, not Dripmetric data.

## How Dripmetric finds them: nine leaks, each a rule you can read

Dripmetric puts your product events and payment events on one stream and checks them against nine plain-language rules. There is no black box: each rule says exactly what counts, and fires once per person per episode.

One rule from each stage of the journey, in the product's own words:

| Stage | Leak | Rule |
| --- | --- | --- |
| Before they activate | [Onboarding stall](https://dripmetric.com/leaks#onboarding-stall) | Someone entered a step and made no progress for longer than the step allows — 24 hours by default, or the step’s own slowest tenth once 20 people have finished it. |
| Before they pay | [High-intent user went quiet](https://dripmetric.com/leaks#high-intent-quiet) | Someone reached 60 or more on buying intent, then went 7 days without doing anything, and never paid. |
| After they pay | [Payer going quiet](https://dripmetric.com/leaks#payer-going-quiet) | A paying customer’s active days halved or worse against their own 4-week baseline, two weeks running. |

The other six leaks:

- Before they activate: [Step completion collapse](https://dripmetric.com/leaks#step-collapse).
- Before they pay: [Pricing quick exit](https://dripmetric.com/leaks#pricing-quick-exit), [Last-moment drop](https://dripmetric.com/leaks#last-moment-drop), [Trial ended unpaid](https://dripmetric.com/leaks#trial-ended-unpaid) and [Limit reached, no upgrade](https://dripmetric.com/leaks#limit-reached).
- After they pay: [Cancelled or payment failed](https://dripmetric.com/leaks#cancelled-or-failed).

Four of the rules run on product events alone. One payment event from your billing webhook switches on the other five. Every rule in full, with what to do about each: [The nine revenue leaks in a self-serve SaaS funnel](https://dripmetric.com/leaks) ([Markdown](https://dripmetric.com/leaks.md)).

## When something leaks: you hear about it, with the numbers

Finding a leak is half the job. Dripmetric also tells you in time to act, and shows you whether what you changed made a difference.

- **An alert the moment it matters.** Slack or Discord, plus a feed in the app. Each alert names the leak, the person’s buying intent, their plan and what is at stake at your list price. At most 10 a day, held through your quiet hours.
- **A leak report every Monday.** Your biggest leak, the people who reached high buying intent and did not pay, and how any change you made is doing. It arrives Monday morning in your timezone.
- **A dollar figure on every leak.** The people in a leak times your own list price, with the formula printed beside it. It is labelled potential revenue, because it is a count of people, not money that arrived.
- **A buying-intent score for every user.** From 0 to 100, built from published rules: starting checkout, reaching activation, hitting a plan limit and more. It fades when someone goes quiet. [How the score works](https://dripmetric.com/buying-intent) ([Markdown](https://dripmetric.com/buying-intent.md)).
- **A warning when tracking breaks.** If an event stops arriving, changes shape or is sent twice, Dripmetric says so. Broken tracking never looks like users leaving.
- **Proof your fix worked.** Mark a change and Dripmetric compares equal windows before and after, with at least 100 people in each before it calls a result.

## Setup: paste a snippet, see a real number in under 10 minutes

1. **Install in 10–15 lines.** `npm install dripmetric`, then `identify()` and `track()` where they belong. Or paste our prompt into Cursor or Copilot and let it write the integration.
2. **Keep your own event names.** Dripmetric maps them to 76 canonical events, with AI-suggested matches you confirm. Nothing in your code gets renamed.
3. **Let the leaks find you.** Nine rules run on their own. Alerts go to Slack or Discord, and a leak report arrives every Monday morning.

In your app:

```js
import * as dripmetric from 'dripmetric/browser';

dripmetric.init('pk_live_…');
dripmetric.identify(user.id, { email: user.email });
dripmetric.track('Onboarding Step Completed', {
  step: 'connect-data',
});
```

From your billing webhook, any provider:

```js
// One call. No billing integration.
dm.track(user.id, 'Subscription Started', {
  plan: 'pro', amount: 4900, currency: 'usd',
});
```

Payment events arrive like any other event, so Stripe, Paddle, Lemon Squeezy, Chargebee and a hand-rolled billing table all work the same way. Already on Segment, RudderStack or PostHog? Forward events with no code. The install guide has the browser and server SDKs, consent, payment events and all 76 events: [Install Dripmetric](https://dripmetric.com/docs) ([Markdown](https://dripmetric.com/docs.md)).

## Frequently asked questions

### What is Dripmetric?

Dripmetric is a revenue-leak detector for self-serve SaaS. It reads your product’s usage events and, if you send them, your payment events, and flags the moments where a signup was on its way to becoming revenue and stopped: an onboarding stall, an abandoned checkout, a trial that ended unpaid, a failed payment, a paying customer going quiet.

### Who is Dripmetric for?

Small self-serve SaaS teams, from a few hundred signups a month, who want to know where people stop between signing up and paying. It suits products where people sign up and pay without talking to sales.

### What does Dripmetric never touch?

Your billing provider: Dripmetric never connects to one, and payment events arrive only because you send them. Your visitors’ devices before consent: where consent is required, nothing is stored or sent until it is given. IP addresses, which are never stored. Keystrokes and screens: there is no session replay or fingerprinting. And your users themselves: Dripmetric does not message them.

### Do I need Stripe, or any billing integration?

No. You send payment events the same way as any other event, so Stripe, Paddle, Lemon Squeezy, Chargebee, Razorpay, RevenueCat or your own billing table all work the same way. With no payment events at all you still get the funnel, step timing, the buying-intent score and four of the nine leaks.

### Is Dripmetric an email or drip-campaign tool?

No. Dripmetric watches and reports to you. It does not send email, drip campaigns or in-app messages to your users. The only messages it sends go to you: alerts in Slack, Discord or the app, and a weekly leak report.

### How is Dripmetric different from PostHog, Mixpanel or Amplitude?

Those are general-purpose product analytics platforms: you explore any event data and build the funnels, queries and alerts you need. Dripmetric is narrower on purpose. It ships nine leak rules, a buying-intent score and alerts, ready on day one, over product and payment events together. Many teams keep their analytics tool and add Dripmetric for the money questions. [Dripmetric vs PostHog](https://dripmetric.com/compare/posthog) compares the two.

### Will the Dripmetric SDK slow my site?

No. The browser core is 5,018 bytes gzipped, and the build fails if it grows past 5,120. It sends in batches off the rendering path, never throws, and uses 3-second timeouts, so even a Dripmetric outage cannot slow a page or break a request.

### What happens after I join the waitlist?

Dripmetric is in private beta, and founders are invited weekly in small cohorts. Your invite brings your project keys and the install guide. Your email is used only to let you in and to share launch news, and you can ask for it to be removed at any time.

## Guides and reference

- [The nine revenue leaks in a self-serve SaaS funnel](https://dripmetric.com/leaks) ([Markdown](https://dripmetric.com/leaks.md))
- [How the buying-intent score works](https://dripmetric.com/buying-intent) ([Markdown](https://dripmetric.com/buying-intent.md))
- [Install Dripmetric](https://dripmetric.com/docs) ([Markdown](https://dripmetric.com/docs.md))
- [Trial-to-paid conversion rate: 2026 benchmarks, formula and where trials leak](https://dripmetric.com/guides/trial-to-paid-conversion) ([Markdown](https://dripmetric.com/guides/trial-to-paid-conversion.md))
- [Dripmetric vs PostHog](https://dripmetric.com/compare/posthog) ([Markdown](https://dripmetric.com/compare/posthog.md))

## Contact

Questions: [hello@dripmetric.com](mailto:hello@dripmetric.com).
