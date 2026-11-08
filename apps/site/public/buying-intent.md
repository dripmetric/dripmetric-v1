# How the buying-intent score works

Canonical: [How the buying-intent score works](https://dripmetric.com/buying-intent)

Locale: en

Purpose: The 0-100 buying-intent (PQL) score: every signal and its points, bands, weekly decay, fit-point cap, pricing attention, team accounts and calibration

Content updated: 2026-11-08

Source revision: site-2026-11-08

Maintenance owner: Dripmetric (hello@dripmetric.com)

[Topic map](https://dripmetric.com/llm/topics/product.md) · [Complete scoped map](https://dripmetric.com/sitemap.md)

Dripmetric's **buying-intent score** is a number from 0 to 100 that says how close someone is to paying, built from transparent rules: every point names the behaviour that earned it. It is a product-qualified-lead (PQL) score for self-serve software — no machine learning, no hidden weights, and it never re-weights itself. Scores of 60 or more are "high intent", which is where two leaks and the "intent but didn't pay" count start.

## The points table {#points}

Each signal counts once unless its row says otherwise. Signals marked *shared* cannot both fire.

| Signal | Points | The rule |
|---|---|---|
| Started checkout | +30 | Started checkout, except a checkout that only starts a card-up-front trial. |
| Reached activation | +25 | Reached activation. Once. |
| Hit a plan limit or a paywall | +20 | Hit a plan limit, or saw an upgrade prompt at a paywall. Counted once, shared. |
| Asked to talk to someone | +20 | Asked to talk to someone. |
| Invited a teammate | +15 | Invited someone. Once. |
| Added a card early | +15 | Added a payment method before the trial ended, on a trial that started without a card. |
| Read the pricing page | +10 | Looked at pricing for longer than the attention threshold. |
| Weighed the plans | +10 | Weighed the plans: long enough on pricing, a second visit, the annual toggle, a plan click or the FAQ. |
| Connected an integration or imported data | +10 | Connected an integration or imported data. Once, shared. |
| Used the core feature early | +10 | Did the core action three or more times in the first 14 days after signing up. |
| Keeps coming back | +10 | Active on three or more of the last seven days. |
| Activated fast | +10 | Reached activation faster than your median time to value. |
| Looks like a buyer | +5 each, up to +10 | Five points for each sign they look like a buyer, up to ten in total. |
| Throwaway email address | −20 | Signed up with a throwaway address. |

The score is capped at 100 and never goes below 0.

## Bands, and why 60 {#bands}

| Band | Score |
|---|---|
| Low | 0 to 29 |
| Warm | 30 to 59 |
| High | 60 to 100 |

60 is the number that matters. It is where [high-intent user went quiet](https://dripmetric.com/leaks#high-intent-quiet) starts counting, where "intent but didn't pay" is measured from, and what calibration reports precision and recall for. It takes several real buying signals to get there — for example reaching activation (+25), hitting a plan limit (+20) and reading the pricing page (+10) is 55, still warm; weighing the plans (+10) makes it 65.

## Intent fades when people go quiet {#decay}

Intent halves after each quiet week — a 7-day half-life. Someone who scored 70 and then did nothing for a week reads 35, and half that again after another quiet week. A score describes how ready someone is *now*, not how ready they once were.

## "Looks like a buyer": the fit points {#fit}

Five separate signs, each worth +5, capped at +10 in total:

- Signed up with a work address.
- Signed up on a desktop (team products only; off for mobile-first products).
- Signed up during working hours on a weekday.
- Arrived from a review or comparison site, or from a search for your product by name.
- Visited two or more times before signing up.

The cap is the point. Five weak facts about a person must not add up to half of the high-intent threshold on their own; behaviour inside your product has to do the rest.

## How the pricing signals are measured {#pricing-attention}

- **Read the pricing page** means active time on the page above the attention bar: 10 seconds until your product has 50 pricing views of its own, then your own 25th percentile.
- **Weighed the plans** means one of: long enough on pricing, a second visit of 10 seconds or more within 7 days, the annual toggle, a plan click, or opening the pricing FAQ. Mark your plan buttons and annual toggle with a `data-dripmetric-plan` or `data-dripmetric-interval-toggle` attribute where a guess would be weak.
- **A first glance and a quick exit** is not intent at all — it is the [pricing quick exit](https://dripmetric.com/leaks#pricing-quick-exit) leak.
- **Three dismissed upgrade prompts** set a *price objection* flag and add no points. Someone repeatedly saying no to a price is interested in the product and unhappy with the number — a different problem from low intent.

## Signals stored with no points yet {#zero-points}

These are recorded on the person as evidence and add 0 points until calibration shows what they are worth for your product: Plan Selected, Evaluation Page Viewed, Trial Extension Requested, Upgrade Prompt Clicked, Plan Limit Approached, Trial Started, Signed In and Data Exported. Inventing points for them would make the score less honest, not more accurate.

## Team accounts {#accounts}

For team products, an account's score is its highest member's score, plus 10 when two or more members were active that week (still capped at 100). The highest member, not the average: one person at a company deciding to buy is the company deciding to buy, and averaging them with colleagues who logged in once would hide exactly that.

## Calibration: suggested, never automatic {#calibration}

Once your product has 30 paying conversions, Dripmetric reports two numbers for the 60 threshold:

- **Recall** — the share of payers who crossed 60 before paying.
- **Precision** — the share of people above 60 who went on to pay.

It also reports each signal's lift (conversion with the signal against conversion without it). When a signal's lift disagrees with its points, it suggests new weights for you to approve. It never applies them automatically: a score that re-weighted itself would stop being the transparent rule set you were shown, and you would have no way to tell.

## What you see on each plan {#plans}

On Free, you get the score and its band for everyone, the high-intent counts and the masked alerts. On Starter, you also see the name, email and id behind each masked tag and the signals behind each score. See [pricing](https://dripmetric.com/pricing).

## Frequently asked questions {#faq}

### What is a product-qualified lead (PQL)?

A product-qualified lead is someone whose behaviour inside the product — activating, hitting a limit, inviting a teammate, reading pricing — shows they are likely to buy. Dripmetric's buying-intent score is a PQL score for self-serve software: 60 or more counts as high intent.

### How is the buying-intent score calculated?

By adding the points of each rule the person has met — such as +30 for starting checkout, +25 for reaching activation and +20 for hitting a plan limit — capping the total at 100, and halving it after each quiet week. Every point is shown with the rule that earned it.

### Does the score use machine learning?

No. It is a fixed, published points table. After 30 paying conversions Dripmetric suggests new weights based on each signal's lift, and you decide whether to apply them.

### What score counts as high intent?

60 to 100. Warm is 30 to 59 and low is 0 to 29.

### Can I see why someone scored what they did?

Yes, on Starter: each score comes with the signals behind it. On Free you see the score and its band, with the person masked.
