A **revenue leak** is a moment between someone's first visit and their first payment — or a paying customer's next renewal — where a person who was likely to pay stops, with no error, complaint or event that says so. Dripmetric checks for nine of them. Each one is a written rule that the product runs exactly as worded on this page, so a number on your dashboard always means the same thing.

Four of the nine run on product events alone. Five more switch on when you send one paid event, such as `Subscription Started` from your billing webhook. No billing integration is needed for any of them.

## The nine leaks at a glance {#at-a-glance}

| Leak | The rule, in one line | Needs | Checked | You get |
|---|---|---|---|---|
| [Onboarding stall](https://dripmetric.com/leaks#onboarding-stall) | No progress on a step for longer than the step allows | Product events | Every 5 minutes | A count per step |
| [Step completion collapse](https://dripmetric.com/leaks#step-collapse) | A step's completions fell far below its own 14-day rate | Product events | Hourly | An instant alert |
| [Pricing quick exit](https://dripmetric.com/leaks#pricing-quick-exit) | A first look at pricing, a glance, then gone | Product events | Daily | A rate by source, device and country |
| [Cancelled or payment failed](https://dripmetric.com/leaks#cancelled-or-failed) | They cancelled, or a payment failed | The event itself | Every 5 minutes | Counts in the weekly report |
| [Last-moment drop](https://dripmetric.com/leaks#last-moment-drop) | Checkout started, no payment within 2 hours | A paid event | Every 5 minutes | An instant masked alert |
| [High-intent user went quiet](https://dripmetric.com/leaks#high-intent-quiet) | 60+ buying intent, then 7 days of nothing | A paid event | Every 5 minutes | An instant masked alert |
| [Trial ended unpaid](https://dripmetric.com/leaks#trial-ended-unpaid) | The trial end date passed with no payment | A paid event and trial dates | Daily | An instant masked alert |
| [Payer going quiet](https://dripmetric.com/leaks#payer-going-quiet) | A payer's active days halved against their own baseline | A paid event | Daily | An instant masked alert |
| [Limit reached, no upgrade](https://dripmetric.com/leaks#limit-reached) | Hit a plan limit, no upgrade within 7 days | A paid event | Every 5 minutes | An instant masked alert |

## How every leak behaves {#how-leaks-work}

- **Never about someone who already paid.** A leak stays quiet for anyone who has paid, been deleted or opted out (an `optedOut` trait or a deletion request). The two leaks that are *about* paying customers — payer going quiet, and cancelled or payment failed — skip only the "already paid" guard.
- **Once per episode.** A leak fires once per person per episode. Someone who comes back and stalls again starts a new episode, so it can fire again; the same episode never fires twice.
- **Off, never silently zero.** A leak whose data you don't send yet is switched off and says why — for example "we are not getting a paid event yet, so we cannot tell who paid". A leak shown as zero because its input is missing would be a number you believed and shouldn't.
- **Masked on the free plan.** Alerts about a person name them with a masked tag; the name, email and id behind it are on Starter. Step completion collapse is about a step, not a person, so it is never masked.
- **Worth a dollar figure only at your price.** See [what a leak is worth](https://dripmetric.com/leaks#money).

## Onboarding stall {#onboarding-stall}

**The rule:** Someone entered a step and made no progress for longer than the step allows — 24 hours by default, or the step's own slowest tenth once 20 people have finished it.

- **The threshold adapts to the step, not the rule.** Until 20 people have finished a step, a stall is 24 hours without progress. After that, the step's own 90th-percentile time is used, clamped between 1 and 72 hours. You can override it per step.
- **"No progress" is measured from their last event on that step**, so someone working slowly is not counted as stuck.
- **What you see:** a count per step on your dashboard and in the weekly report. There is no per-person alert for stalls — a stall is a pattern to fix, not a person to chase.

**What to do about it:** fix the step with the most people stuck, not the one with the worst percentage. Compare its typical time with the step before it. Long steps usually need splitting, a sensible default, or a "do this later" path; a step that people leave at the same rate however fast they go is usually one whose value isn't clear.

## Step completion collapse {#step-collapse}

**The rule:** A step's completions in the last 24 hours fell so far below its own 14-day rate that chance does not explain it.

- **The test:** every hour, the last 24 hours of completions are compared with the step's trailing 14-day rate using a one-sided Poisson test. It fires below p = 0.01, and only when at least 10 completions were expected.
- **Why a probability and not a percentage:** a step that normally gets 12 completions a day and got 6 is noise. The same halving on a step that gets 1,200 a day is an outage. A percentage can't tell those apart; a probability can.
- **What you see:** an instant, unmasked alert — it concerns a step, not a person. A collapse that is still there the next day is a new episode, so you hear about it again.

**What to do about it:** check whether tracking broke before assuming users vanished. A deploy that stops an event from firing looks exactly like a collapse; Dripmetric's tracking-health checks (missing events, shape drift, double-sends, late arrivals) are there to tell the two apart. Then check what shipped in the last day.

## Pricing quick exit {#pricing-quick-exit}

**The rule:** Someone opened your pricing page for the first time, glanced at it and left.

- **"Glanced" has a number.** Their active time on the page was under the attention bar — 10 seconds until your product has 50 pricing views of its own, then your own 25th percentile — and their session ended within 2 minutes.
- **Only the first view counts.** A returning visitor weighing plans is the opposite signal, and it scores [buying intent](https://dripmetric.com/buying-intent) instead.
- **What you see:** a rate by traffic source, device and country. No per-person alert.

**What to do about it:** look at which source sends the quick exits. A high rate from one channel is usually a promise in that channel that the pricing page doesn't keep. A high rate on phones is usually layout or speed.

## Cancelled or payment failed {#cancelled-or-failed}

**The rule:** They cancelled, or a payment failed.

- **It fires on the event itself**, whatever sends it: `Subscription Cancelled` or `Payment Failed` from your billing webhook, Stripe or not.
- **What you see:** counts in your weekly report, with the cancel reason when you send one.
- **What it is not:** Dripmetric detects these; it does not retry cards, send dunning emails or run cancel flows. Recovery tools do that. Failed payments matter: [Recurly's churn benchmarks](https://www.recurly.com/research/churn-rate-benchmarks) put involuntary churn at roughly a third of total SaaS churn (data as of July 2026).

**What to do about it:** separate failed payments from decisions to leave — they need different fixes. A failed card is a billing problem; a cancellation after a quiet month is a product problem that usually showed up earlier as [payer going quiet](https://dripmetric.com/leaks#payer-going-quiet).

## Last-moment drop {#last-moment-drop}

**The rule:** Someone started checkout and no payment arrived within 2 hours. A trial-only checkout does not count.

- **Needs a paid event**, so Dripmetric can tell who paid. Send `Checkout Started` from the server where you create the checkout session, and pass your user id to the billing provider so the payment can be matched.
- **What you see:** an instant masked alert, checked every 5 minutes.

**What to do about it:** these people chose a plan and stopped at the last step. Look for a declined card (`Checkout Payment Declined`), a surprise at the total (tax, currency, annual-only), or a discount-code field that sent them looking for a code. On Starter you see who, and a short personal note often recovers the sale.

## High-intent user went quiet {#high-intent-quiet}

**The rule:** Someone reached 60 or more on buying intent, then went 7 days without doing anything, and never paid.

- **60 is the high band** of the [buying-intent score](https://dripmetric.com/buying-intent): a person who has, for example, activated, hit a plan limit and read the pricing page.
- **Needs a paid event**, so "never paid" is a fact rather than a guess.
- **What you see:** an instant masked alert.

**What to do about it:** these are the people most worth a personal message, because they were convinced and something stopped them. The signals behind their score (on Starter) usually say what: a limit they hit, a teammate they invited, a pricing page they read twice.

## Trial ended unpaid {#trial-ended-unpaid}

**The rule:** Their trial end date passed and no payment arrived.

- **Needs a paid event and trial dates.** Send a `trialEndsAt` trait when a trial starts, or a `Trial Ended` event. If they never paid, a cancellation, a pause or a failed first invoice counts as unpaid, not as churn.
- **What you see:** an instant masked alert, checked daily.

**What to do about it:** look at what the unpaid trials have in common before the end date — most of them stalled or went quiet days earlier, which is when a nudge would still have worked. The [trial-to-paid guide](https://dripmetric.com/guides/trial-to-paid-conversion) shows where trials usually leak.

## Payer going quiet {#payer-going-quiet}

**The rule:** A paying customer's active days halved or worse against their own 4-week baseline, two weeks running.

- **Measured against themselves**, not against other customers: active days in each of the last two completed weeks are compared with their own average over the four weeks before.
- **Needs a paid event.** This is one of the two leaks about people who have paid.
- **What you see:** an instant masked alert, checked daily.

**What to do about it:** a payer whose usage falls for two weeks is often deciding whether to cancel. Ask what changed — a teammate who left, an integration that disconnected, a feature they stopped needing.

## Limit reached, no upgrade {#limit-reached}

**The rule:** They hit a limit of their plan and did not upgrade within 7 days.

- **Needs a paid event** and a `Plan Limit Reached` event at the moment the limit bites.
- **What you see:** an instant masked alert.

**What to do about it:** a limit is the clearest upgrade moment you have. If people hit it and don't upgrade, check what the upgrade path asks of them at that moment, and whether the next plan is priced for someone who just needed a little more.

## What a leak is worth {#money}

Dripmetric puts a money figure on a leak only when you have told it your list price, and it always shows the formula next to the number:

> potential revenue = people in the leak × your list price

For example, with simulated numbers: 12 people in "high-intent user went quiet" at a $49 monthly list price is 12 × $49 = $588 a month of potential revenue. It is potential, not lost: some of them would never have paid. With no price set there is no money figure at all, because a guessed price would be a made-up number on a screen whose promise is that every number can be checked.

## Frequently asked questions {#faq}

### What is a revenue leak in a SaaS funnel?

A revenue leak is a point between a visitor's first visit and their first payment, or a payer's renewal, where someone likely to pay stops without any error or complaint that says so — for example an onboarding step they never finish, a checkout with no payment, or a trial that ends unpaid.

### Which leaks work without payment data?

Four: onboarding stall, step completion collapse and pricing quick exit run on product events alone, and cancelled or payment failed fires on its own event. The other five need one paid event, such as `Subscription Started`, so Dripmetric can tell who paid.

### How is a revenue leak different from churn?

Churn is a paying customer leaving. Most leaks happen before anyone pays — in onboarding, at pricing, in checkout, at the end of a trial — so they never show up in a churn number. Two of the nine, payer going quiet and cancelled or payment failed, are about paying customers.

### Does Dripmetric fix the leaks or contact my users?

No. Dripmetric shows you where revenue leaks and how much; on Starter it also shows who and the signals behind each score. It never emails, nudges or messages your users.

### Can I change the thresholds?

The stall time can be overridden per step. The other rules run exactly as written on this page, so an alert means the same thing in every project.
