# Dripmetric — revenue-leak detection for self-serve SaaS

Canonical: [Dripmetric — revenue-leak detection for self-serve SaaS](https://dripmetric.com/)

Locale: en

Purpose: What Dripmetric is, the nine leak rules, the buying-intent score, setup, billing-provider independence, comparisons, privacy, pricing and FAQ

Content updated: 2026-11-04

Source revision: site-2026-11-04

Maintenance owner: Dripmetric (hello@dripmetric.com)

[Topic map](https://dripmetric.com/llm/topics/product.md) · [Complete scoped map](https://dripmetric.com/sitemap.md)

Dripmetric is a revenue-leak detector for self-serve software. It watches product usage and payments on one event stream and tells you, automatically, where signups stall, who looked ready to buy and went quiet — and what it is costing you.

Status: private beta. Founders are let in weekly, in small cohorts, and the free plan stays free, forever. Join at [dripmetric.com](https://dripmetric.com/).

## What is Dripmetric?

Dripmetric is a revenue-leak detector for self-serve software. It reads your product’s usage events — and, if you send them, your payment events — on one event schema, and automatically flags the moments where a signup was on its way to becoming revenue and didn’t: an onboarding stall, an abandoned checkout, a trial that ended unpaid, a payment that failed, a paying customer going quiet. It is built for small teams, roughly from a few hundred signups a month.

## What counts as a revenue leak?

A revenue leak is a point in the customer journey where someone who was likely to pay stops, without an error, a complaint or an event that says so. Dripmetric tracks nine of them as named rules: onboarding stall, step completion collapse, pricing quick exit, cancelled or payment failed, last-moment drop, high-intent user went quiet, trial ended unpaid, payer going quiet, and limit reached with no upgrade.

Most of what a self-serve product loses has nothing to do with whether the product is good. It is lost to silence:

- A new user stalls on step 2 of onboarding and never comes back.
- A step that converted fine starts converting worse after a release — and nobody notices for a month.
- Someone views pricing twice, starts checkout, then goes quiet for a week.
- A trial ends, and nobody notices it ended unpaid.
- A payment fails and the subscription just stops.
- A paying customer’s usage quietly halves, long before they cancel.

Product analytics knows what happened in your product and nothing about money. Billing and recovery tools know a card failed and nothing about what happened first. Dripmetric puts both on one event stream, so one rule can say: this person finished onboarding, hit a plan limit, viewed pricing twice — and then their payment failed.

Third-party benchmarks, not Dripmetric data:

- Average activation rate across 62 B2B SaaS companies: 37.5% ([Userpilot, SaaS Product Metrics Benchmark Report 2025](https://userpilot.com/saas-product-metrics/)).
- In Recurly’s churn benchmark, about one third of SaaS churn is involuntary — payments that failed, not customers who chose to leave (1.06 of 3.22 points; [Recurly churn rate benchmarks, data as of July 2026](https://www.recurly.com/research/churn-rate-benchmarks)).

## The nine leaks

Every leak is a plain-language rule with a visible default. Each fires at most once per person per episode, and never about someone who was deleted or opted out. Apart from the two leaks that are about paying customers, no leak ever fires about someone who has already paid.

| Leak | Rule | Needs | How it reports |
| --- | --- | --- | --- |
| Onboarding stall | Someone entered a step and made no progress for longer than the step allows — 24 hours by default, or the step’s own slowest tenth once 20 people have finished it. | Product events | Counted per step on your dashboard and in the weekly report. |
| Step completion collapse | A step’s completions in the last 24 hours fell so far below its own 14-day rate that chance does not explain it. | Product events | Instant alert. It is about a step, not a person, so nothing is masked. |
| Pricing quick exit | Someone opened your pricing page for the first time, glanced at it and left. | Product events | Shown as a rate by source, device and country. |
| Cancelled or payment failed | They cancelled, or a payment failed. | The event itself | Fires whatever sends the event. Counted in your weekly report. |
| Last-moment drop | Someone started checkout and no payment arrived within 2 hours. A trial-only checkout does not count. | Paid event | Instant masked alert. |
| High-intent user went quiet | Someone reached 60 or more on buying intent, then went 7 days without doing anything, and never paid. | Paid event | Instant masked alert. |
| Trial ended unpaid | Their trial end date passed and no payment arrived. | Paid event and trial end dates | Instant masked alert. |
| Payer going quiet | A paying customer’s active days halved or worse against their own 4-week baseline, two weeks running. | Paid event | Instant masked alert. |
| Limit reached, no upgrade | They hit a limit of their plan and did not upgrade within 7 days. | Paid event | Instant masked alert. |

## How it works

The promise every feature is held to: a real drop-off number in under 10 minutes, from product events alone.

1. **Install in about 10–15 lines.** `npm install dripmetric`, then `identify()`, `track()` and `group()` where they belong. Or paste the AI-coder prompt into Cursor, Copilot or a similar AI coder and let it write the integration.
2. **Keep your own event names.** Dripmetric maps them to one schema of 76 canonical events — Signed Up, Checkout Started, Payment Failed — with AI-suggested matches you confirm in an Inbox. Nothing in your code gets renamed.
3. **Let the leaks find you.** The funnel, step timing and a buying-intent score update as events arrive. Nine leak rules run on their own and send masked alerts to Slack or Discord, plus a leak report every Monday morning in your timezone.

Browser:

```js
import * as dripmetric from 'dripmetric/browser';

// Once, in your page shell
dripmetric.init('pk_live_…');

// At signup, and on every app load
dripmetric.identify(user.id, { email: user.email });

// The moments that matter, in your own words
dripmetric.track('Onboarding Step Completed', {
  step: 'connect-data',
});
```

Server (Node.js):

```js
import { Dripmetric } from 'dripmetric/server';

const dm = new Dripmetric({
  secretKey: process.env.DRIPMETRIC_SECRET_KEY,
});

dm.track(user.id, 'Signed Up', { method: 'google' });

// From your billing webhook — any provider
dm.track(user.id, 'Subscription Started', {
  plan: 'pro', amount: 4900, currency: 'usd',
});
```

Any language (plain HTTPS):

```bash
curl https://api.dripmetric.com/v1/batch \
  -H "Authorization: Bearer $DRIPMETRIC_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"batch":[{"type":"track",
       "messageId":"evt-1","userId":"user_123",
       "event":"Signed Up"}]}'
```

- Ready-made snippets for Next.js App Router, Node/Express, Django, Flask, Rails, Laravel, Go net/http and plain HTTP.
- Already on Segment, RudderStack or PostHog? Forward events with no code — signature-verified, with a deny-by-default field allow-list.
- Python, Ruby, PHP or Go? Segment’s open-source libraries work pointed at Dripmetric’s host. Anything else can use plain HTTPS.

## Buying-intent score

Every tracked user gets a 0–100 buying-intent score: the self-serve version of a product-qualified lead score. It is built from rules, not a black box. Every point names the signal that earned it, and the score halves every quiet week. 30 and above is warm; 60 and above is high intent. Points are suggestions you approve — never re-weighted automatically.

| Signal | Points |
| --- | --- |
| Started checkout (not a card-up-front trial) | +30 |
| Reached activation | +25 |
| Hit a plan limit or a paywall prompt | +20 |
| Asked to talk to someone | +20 |
| Invited a teammate | +15 |
| Added a card before the trial ended | +15 |
| Read the pricing page | +10 |
| Weighed the plans | +10 |
| Connected an integration or imported data | +10 |
| Did the core action 3+ times in their first 14 days | +10 |
| Active on 3 or more of the last 7 days | +10 |
| Activated faster than your median | +10 |
| Looks like a buyer (fit signals) | +5 each, up to +10 |
| Signed up with a throwaway address | −20 |

## Free and paid: what masked means

Free shows where and how much. Starter shows who. On Free, every alert is real — the leak, the score, the plan and the money at stake — except who, which sits behind a stable tag like `User A7F2C1`, with coarse times like “this week”. Masking is enforced on Dripmetric’s server, so a free project’s pages, alerts and API responses never contain a name, an email or a user id. Starter reveals the name, email and id behind the tag and the signals behind each score.

Example alert (simulated data): “Someone with buying intent went quiet. They looked ready to buy — 75 out of 100 — and have not been back for 7 days.” Who (masked): User A7F2C1 · Buying intent: 75 of 100, high · Plan: Pro · At stake: $49.00 at your list price · When: this week. Rule: reached 60 or more on buying intent, then 7 days without doing anything, and never paid.

## Potential revenue

Send one paid event and Dripmetric puts money on every leak: the people who reached high intent and didn’t pay, times your list price. The formula is always on screen. For example, 400 signups a month × 6% who reach high intent but don’t pay × a $49 monthly price = $1,176 a month in potential revenue (your numbers, Dripmetric’s formula; Dripmetric counts the actual people).

## Do I need Stripe, or any billing integration?

No. Dripmetric never connects to a billing provider. You send payment events the same way as any other event — one `track()` call from your webhook handler, your database or your CDP — so Stripe, Paddle, Lemon Squeezy, Chargebee, Razorpay, RevenueCat or your own billing table all work the same way. With no payment events at all you still get the funnel, step timing, the buying-intent score and four of the nine leaks. One paid event switches on the other five and puts a dollar figure on each.

| Capability | Product events alone | With money events |
| --- | --- | --- |
| Funnel, step timing, cohorts, segment splits | Full | — |
| Buying-intent score, every band | Full | — |
| Onboarding stall, step collapse, pricing quick exit | Full | — |
| Tracking health, before-and-after proof | Full | — |
| Cancelled or payment failed | Fires on the event, whatever sends it | — |
| Dashboard modules | 5 of 8 | All 8 |
| Last-moment drop, high-intent quiet, payer going quiet, limit reached | — | With a declared paid event |
| Trial ended unpaid | — | Paid event + trial dates |
| A dollar figure on every leak | — | Your list price |

The “paid event” is one setting — which event means someone started paying. It defaults to `Subscription Started`. Money events are an upgrade in depth, not a gate: add them in week two without redoing anything.

## The dashboard and the weekly report

Eight questions, answered in your own words:

1. **Where you are losing people** — each leak: open now, new this week, and what it’s worth at your price.
2. **Your funnel** — every step: reached, finished, dropped, typical time, stuck right now.
3. **Who looks ready to buy** — people at high intent, and how many of them haven’t paid.
4. **Checkout** — started, abandoned, and last-moment drops still worth chasing.
5. **Do they come back** — how many return after signing up.
6. **Paying customers going quiet** — payers whose usage is falling, and since when.
7. **Is the tracking healthy** — missing events, shape drift, double-sends and late arrivals, so “tracking broke” never looks like “your users vanished”.
8. **Did your changes work** — mark a change; see before and after.

A weekly leak report arrives every Monday morning in your timezone. Before-and-after proof: mark a change and Dripmetric compares completion across equal windows, with at least 100 people in each before it reports a result. Quiet hours and a cap of 10 instant alerts a day keep the noise down; the rest wait for the weekly report.

## How Dripmetric compares

Most small teams stitch this together from tools that each see half the story. Dripmetric doesn’t replace them; it joins product and money for one job: finding the revenue you’re losing. Category descriptions as of November 2026; product names are trademarks of their owners.

| Category | Built for | For example | Dripmetric’s approach |
| --- | --- | --- | --- |
| Product analytics | Exploring any event data — you build the funnels, queries and alerts | PostHog, Mixpanel, Amplitude | Nine leak rules and an intent score ready on day one, over product and payment events |
| Lifecycle email | Sending behavioural email journeys | Customer.io, Loops, Encharge | Sends nothing to your users; shows you where and who first |
| In-app onboarding | Tours, checklists and prompts inside your app | Appcues, Userpilot, Chameleon | Adds no UI to your product; measures whether onboarding converts |
| Churn and payment recovery | Retrying failed cards, dunning, cancel flows | Churnkey, Churn Buster, Baremetrics Recover | Watches the whole path before a card ever fails, too |

How is Dripmetric different from PostHog, Mixpanel or Amplitude? Those are general-purpose product analytics platforms: you explore any event data and build the funnels, queries and alerts you need. PostHog can also hold revenue next to product events — [its revenue analytics](https://posthog.com/docs/revenue-analytics/start-here) was in beta as of November 2026. Dripmetric is narrower on purpose: nine leak rules, a transparent intent score and masked alerts, ready on day one, over one schema of product and payment events. Many teams keep their analytics tool for exploration and use Dripmetric for the money questions.

How is it different from churn-recovery tools like Churnkey or Baremetrics Recover? Recovery tools act after a card fails: retries, dunning emails, cancel flows. Dripmetric watches the whole path before that — onboarding, buying intent, checkout and trials — and puts failed payments on the same timeline. It does not retry cards or send emails itself.

## Privacy and performance

Privacy:

- Nothing is stored on a visitor’s device — and nothing is sent — until they consent.
- Country comes from your platform’s header. The IP address is never stored.
- No session replay, keystroke capture or fingerprinting.
- Emails and name-like traits are encrypted at rest.
- You are the data controller; Dripmetric is the processor.
- One API call deletes everything held about a person.

Performance:

- 5,018 bytes gzipped for the browser core, and the build fails if it grows past 5,120. Forms, clicks and speed capture load lazily, on your key pages only.
- Never blocks rendering. Never throws.
- At most 1,000 queued events; the oldest are dropped first.
- 3-second timeouts, 3 retries, then a 60-second pause. If Dripmetric’s API is down, that is Dripmetric’s problem, not your page’s.

## Pricing

Prices in US dollars.

- **Free — $0, forever.** Where and how much revenue leaks: full funnel and step timing; buying-intent score; all nine leaks, masked; instant masked alerts to Slack or Discord, plus an in-app feed; weekly leak report; tracking health and before-and-after proof; segment splits; 90 days of raw events, with daily summaries kept forever.
- **Starter — $39 a month (list $49), or $390 a year (list $490).** The launch price is held for 12 months for anyone who starts by 30 June 2027. Everything in Free, plus the name, email and id behind every masked tag; the signals behind each score; 13 months of raw events.
- **Founding seat — $390 a year, locked for life. First 25 founders only.** Starter’s yearly launch price, locked for life instead of for 12 months: a full year of Starter, a 45-minute guided setup call, and money back within 30 days of launch.
- **Funnel teardown — $299 (list $349).** A written teardown of one onboarding funnel, delivered in 48 hours and credited toward a setup.
- **Concierge setup — $499 (list $599).** A fixed-scope, done-for-you setup on a paid plan. A few slots a month.

## Frequently asked questions

### How long does setup take?

About 10–15 lines of code for a typical team product, most of which the AI-coder prompt writes for you in Cursor, Copilot or similar. The promise every feature is held to: a real drop-off number in under 10 minutes, from product events alone.

### Does Dripmetric email or nudge my users?

No. Dripmetric observes and reports to you; it never contacts your users. It sends no drip campaigns, recovery emails or in-app prompts. The only messages it sends are to you: alerts in Slack, Discord or the app, and your weekly report.

### What does the free plan include, and what does “masked” mean?

Free includes the full funnel and step timing, the buying-intent score, all nine leaks, instant alerts, the weekly leak report, tracking health, before-and-after proof and segment splits — free forever. Masked means each person appears as a stable tag such as `User A7F2C1` instead of a name, with coarse times like “this week”. Starter reveals the name, email and id behind the tag and the signals behind each score.

### How is the buying-intent score calculated?

It adds points for transparent signals, from 0 to 100: starting checkout +30, reaching activation +25, hitting a plan limit or paywall +20, asking to talk to someone +20, inviting a teammate +15, reading pricing +10 (and +10 more for weighing the plans), and smaller signals, with −20 for a throwaway email address. The score halves every quiet week. 30 and above is warm; 60 and above is high intent. Every point on screen names the rule that produced it.

### Will the SDK slow down my site or app?

No. The browser core is 5,018 bytes gzipped, and the build fails if it grows past 5,120. It sends in batches off the rendering path, never throws, keeps at most 1,000 events in memory and uses 3-second timeouts — so even a Dripmetric outage cannot slow a page load or break a request.

### What data does Dripmetric store?

The events you send: the event name, when it happened, the person’s id in your system, the page, and the properties you choose. Emails and name-like traits are encrypted at rest; IP addresses are never stored; there is no session replay or fingerprinting. Raw events are kept for 90 days on Free and 13 months on paid plans, with daily summaries kept forever. You are the data controller, and one API call deletes everything held about a person.

### Which languages and frameworks does it support?

The `dripmetric` npm package covers the browser and Node. The snippet generator covers Next.js App Router, Node/Express, Django, Flask, Rails, Laravel, Go net/http and plain HTTP. Python, Ruby, PHP and Go can use Segment’s open-source libraries pointed at Dripmetric’s host, any language can call the HTTPS API, and Segment, RudderStack or PostHog can forward events with no code.

## Measured facts

Measured on the shipping code, November 2026:

- Browser SDK core: 5,018 bytes gzipped; the build fails past 5,120.
- 76 canonical events, from Signed Up to Payment Failed.
- 9 leak rules, each written so you can read it.
- 8 stacks with a ready-made install snippet.
- 0 billing integrations to set up.

## What Dripmetric does not do

- It never connects to a billing provider; payment events arrive only because you send them.
- It never contacts your users: no drip campaigns, recovery emails or in-app prompts.
- It does not retry cards or run dunning.

## Contact

[hello@dripmetric.com](mailto:hello@dripmetric.com)
