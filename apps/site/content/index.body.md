Dripmetric is a revenue-leak detector for self-serve SaaS. It reads your product and payment events and tells you where signups stall, who looked ready to buy and went quiet, and what it costs you.

Status: private beta. Founders are invited weekly, in small cohorts, and the free plan stays free. [Join the waitlist](https://dripmetric.com/#waitlist) with a work email.

- Free plan, forever.
- No billing integration.
- 10–15 lines to install.

## Measured on the shipping code

- 9 leak rules, each one written so you can read it.
- A 5 KB browser SDK: 5,018 bytes gzipped. The build fails past 5,120.
- 76 canonical events, from Signed Up to Payment Failed.
- 0 billing integrations to set up.

## Nine leaks. Each one a rule you can read.

A revenue leak is a point where someone who was likely to pay stops, with no error, no complaint and no event to say so. Dripmetric watches for nine of them. There is no black box: every leak is a plain-language rule with a visible default.

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

Four leaks run on product events alone. One paid event switches on the other five and puts a dollar figure on each. Every rule in full, with its threshold, the data it needs and what to do about it: [The nine revenue leaks in a self-serve SaaS funnel](https://dripmetric.com/leaks) ([Markdown](https://dripmetric.com/leaks.md)).

## How it works

Paste a snippet. See a real number in under 10 minutes.

1. **Install in 10–15 lines.** `npm install dripmetric`, then `identify()` and `track()` where they belong. Or paste our prompt into Cursor or Copilot and let it write the integration.
2. **Keep your own event names.** Dripmetric maps them to 76 canonical events, with AI-suggested matches you confirm. Nothing in your code gets renamed.
3. **Let the leaks find you.** Nine rules run on their own. Masked alerts go to Slack or Discord, and a leak report arrives every Monday morning.

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

Payment events arrive like any other event, so Stripe, Paddle, Lemon Squeezy, Chargebee and a hand-rolled billing table all work the same way. Already on Segment, RudderStack or PostHog? Forward events with no code. The install guide has the browser and server SDKs, consent, paid events and all 76 events: [Install Dripmetric](https://dripmetric.com/docs) ([Markdown](https://dripmetric.com/docs.md)).

## Pricing

Free shows where and how much. Starter shows who.

| Plan | Price | What it includes |
| --- | --- | --- |
| Free | $0, forever | The full funnel and step timing, the buying-intent score, all nine leaks, masked alerts to Slack or Discord, and a weekly leak report. |
| Starter | $39 a month at launch, or $390 a year | Everything in Free, plus the name, email and id behind every masked tag, and the signals behind each score. |

On Free, every alert is real: the leak, the score, the plan and the money at stake. Only the person is masked, behind a stable tag. Masking is enforced on our server, so a free project’s pages, alerts and API responses never contain a name, an email or a user id.

Prices in US dollars. List prices, founding seats, add-ons and what each plan includes: [Dripmetric pricing](https://dripmetric.com/pricing) ([Markdown](https://dripmetric.com/pricing.md)).

## A sample, with simulated data

The page shows one funnel and the alert Dripmetric would send about it. Both are simulated.

The funnel, over the last 30 days: 1,240 signed up, 1,018 verified their email, 431 connected a data source, 352 activated, 97 started checkout and 61 paid. 587 people stopped at “Connected a data source”, which makes it the biggest leak.

The alert, as it arrives in Slack: “Someone with buying intent went quiet. They looked ready to buy — 75 out of 100 — and have not been back for 7 days.” Who (masked): User A7F2C1 · Buying intent: 75 of 100, high · Plan: Pro · At stake: $49.00 at your list price · When: this week. Rule: Someone reached 60 or more on buying intent, then went 7 days without doing anything, and never paid.

On Free that alert names `User A7F2C1`. On Starter the same alert names the person (in the sample, Maya Okafor, maya@northwind.example).

## Frequently asked questions

### What is Dripmetric?

Dripmetric is a revenue-leak detector for self-serve SaaS. It reads your product’s usage events and, if you send them, your payment events, and flags the moments where a signup was on its way to becoming revenue and stopped: an onboarding stall, an abandoned checkout, a trial that ended unpaid, a failed payment, a paying customer going quiet. It is built for small teams, from a few hundred signups a month.

### Is Dripmetric an email or drip-campaign tool?

No. Dripmetric observes and reports to you. It never contacts your users, and it sends no drip campaigns, recovery emails or in-app prompts. The only messages it sends go to you: alerts in Slack, Discord or the app, and a weekly leak report.

### Do I need Stripe, or any billing integration?

No. Dripmetric never connects to a billing provider. You send payment events the same way as any other event, so Stripe, Paddle, Lemon Squeezy, Chargebee, Razorpay, RevenueCat or your own billing table all work the same way. With no payment events at all you still get the funnel, step timing, the buying-intent score and four of the nine leaks.

### How long does Dripmetric take to set up?

About 10–15 lines of code for a typical product, most of which the AI-coder prompt writes for you in Cursor or Copilot. The promise every feature is held to is a real drop-off number in under 10 minutes, from product events alone. [The install guide](https://dripmetric.com/docs) has the code.

### How is Dripmetric different from PostHog, Mixpanel or Amplitude?

Those are general-purpose product analytics platforms: you explore any event data and build the funnels, queries and alerts you need. Dripmetric is narrower on purpose. It ships nine leak rules, a transparent buying-intent score and masked alerts, ready on day one, over product and payment events together. Many teams keep their analytics tool and add Dripmetric for the money questions. [Dripmetric vs PostHog](https://dripmetric.com/compare/posthog) compares the two.

### Will the Dripmetric SDK slow my site, and what data does it store?

No. The browser core is 5,018 bytes gzipped. It sends in batches off the rendering path, never throws, and uses 3-second timeouts, so even a Dripmetric outage cannot slow a page. It stores the events you send. Where consent is required, nothing is stored on a visitor’s device, and nothing is sent, until they consent. IP addresses are never stored, emails are encrypted at rest, and one API call deletes everything held about a person.

### How much does Dripmetric cost?

Dripmetric is free forever for where and how much revenue leaks. Starter, which shows who, is $39 a month at the launch price, or $390 a year. [Full pricing](https://dripmetric.com/pricing) lists what each plan includes.

## What Dripmetric does not do

- It never contacts your users: no drip campaigns, recovery emails or in-app prompts.
- It never connects to a billing provider; payment events arrive only because you send them.
- It does not retry cards or run dunning.
- It does no session replay, keystroke capture or fingerprinting.

## Guides and reference

- [The nine revenue leaks in a self-serve SaaS funnel](https://dripmetric.com/leaks) ([Markdown](https://dripmetric.com/leaks.md))
- [How the buying-intent score works](https://dripmetric.com/buying-intent) ([Markdown](https://dripmetric.com/buying-intent.md))
- [Install Dripmetric](https://dripmetric.com/docs) ([Markdown](https://dripmetric.com/docs.md))
- [Dripmetric pricing](https://dripmetric.com/pricing) ([Markdown](https://dripmetric.com/pricing.md))
- [Trial-to-paid conversion rate: 2026 benchmarks, formula and where trials leak](https://dripmetric.com/guides/trial-to-paid-conversion) ([Markdown](https://dripmetric.com/guides/trial-to-paid-conversion.md))
- [Dripmetric vs PostHog](https://dripmetric.com/compare/posthog) ([Markdown](https://dripmetric.com/compare/posthog.md))

## Contact

Questions: [hello@dripmetric.com](mailto:hello@dripmetric.com). Every sample on dripmetric.com uses simulated data, and says so.
