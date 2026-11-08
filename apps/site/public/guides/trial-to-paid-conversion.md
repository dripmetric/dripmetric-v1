# Trial-to-paid conversion rate: 2026 benchmarks, formula and where trials leak

Canonical: [Trial-to-paid conversion rate: 2026 benchmarks, formula and where trials leak](https://dripmetric.com/guides/trial-to-paid-conversion)

Locale: en

Purpose: How to calculate trial-to-paid conversion, the 2026 free-to-paid benchmarks with sources and limits, activation, where trials leak and how to measure it with events

Content updated: 2026-11-08

Source revision: site-2026-11-08

Maintenance owner: Dripmetric (hello@dripmetric.com)

[Topic map](https://dripmetric.com/llm/topics/guides.md) · [Complete scoped map](https://dripmetric.com/sitemap.md)

**Trial-to-paid conversion rate** is the share of people who start a free trial and go on to pay. Across software products the median free-to-paid conversion rate is **8%**; free trials that **require a credit card** convert at about **30%**, more than five times trials that don't. Those figures come from the [*SaaS Conversion Report*](https://chartmogul.com/reports/saas-conversion-report/) by Kyle Poyar with ChartMogul and ProductLed (published 4 February 2026; 200 products surveyed in January 2026; conversion counted within six months of signup). This guide gives the formula, the benchmarks with their limits, and the places where trials most often leak before anyone pays.

## The formula {#formula}

> trial-to-paid conversion rate = trials that became paying customers ÷ trials started × 100

Three choices decide whether your number means anything:

- **Count by cohort.** Take everyone who started a trial in the same week or month, and count how many of *them* paid — not this month's payments over this month's trials, which mixes different people.
- **Fix the window.** Decide how long after the trial starts a payment still counts — for example the trial length plus 7 days. The benchmark below counts payments within six months of signup, which is generous.
- **Count real payments only.** A trial that starts with a zero-amount invoice is not a payment; the first charge above zero is.

A worked example, with simulated numbers: 400 people started a trial in March; by the end of their window, 36 of them had paid. 36 ÷ 400 × 100 = **9%**.

## Benchmarks (2026) {#benchmarks}

From the [*SaaS Conversion Report*](https://chartmogul.com/reports/saas-conversion-report/) (Kyle Poyar with ChartMogul and ProductLed, 4 February 2026):

| Model | Good | Great |
|---|---|---|
| Free trial, card required | 25–35% | 50–60% |
| Free trial (products that lead with a trial) | 4–6% | 10–15% |
| Reverse trial | 4–6% | 8–12% |
| Freemium, self-serve | 3–5% | 8–12% |

Other figures from the same report:

- The **median** free-to-paid conversion rate across all products was **8%** — and very few products actually sit at 8%.
- Free trials that require a credit card **see 30% free-to-paid conversion**, more than five times trials that don't.
- **20%** of free-trial products ask for a card upfront; the other 80% do not.
- The most common trial length is **14 days** (62% of products), then 7 days (14%) and 30 days (14%). The report does not break conversion down by trial length.
- B2B-focused products see somewhat higher conversion than B2C or hybrid products.

**Read them with their limits:** the report is a self-reported survey of 200 products, conversion is counted within six months, and every company defines a "trial" and a "paying customer" a little differently. Use the bands to ask whether you are far off, not to set a target to the decimal.

## Activation comes first {#activation}

A trial rarely converts before the product has worked for someone — the moment called activation. In Userpilot's [*SaaS Product Metrics Benchmark Report 2025*](https://userpilot.com/saas-product-metrics/), the average activation rate across 62 B2B SaaS companies was 37.5% (median 37.04%). If roughly six in ten new users never activate, no pricing change will fix your trial-to-paid rate; the onboarding steps will.

## Where trials leak {#where-trials-leak}

A trial that ends unpaid has often stopped days earlier, at one of a few points. Each of these is a rule Dripmetric checks:

1. **They stall in onboarding.** A step they started and never finished — [onboarding stall](https://dripmetric.com/leaks#onboarding-stall).
2. **They glance at pricing and leave.** A first visit to the pricing page that lasts seconds — [pricing quick exit](https://dripmetric.com/leaks#pricing-quick-exit).
3. **They were convinced, then went quiet.** Buying intent of 60 or more, then a week of nothing — [high-intent user went quiet](https://dripmetric.com/leaks#high-intent-quiet).
4. **They start checkout and don't finish.** No payment within 2 hours — [last-moment drop](https://dripmetric.com/leaks#last-moment-drop).
5. **They hit a limit and don't upgrade.** The clearest upgrade moment, missed — [limit reached, no upgrade](https://dripmetric.com/leaks#limit-reached).
6. **The trial simply ends.** The end date passes with no payment — [trial ended unpaid](https://dripmetric.com/leaks#trial-ended-unpaid).

The first two show up in product events alone. The rest need one paid event, so "didn't pay" is a fact rather than a guess.

## How to measure it with events {#measure}

You need four events, sent from your server where you can:

| Event | Sent when |
|---|---|
| `Trial Started` | the trial begins (or send a `trialEndsAt` trait) |
| `Activated` | the product first works for them |
| `Checkout Started` | they begin paying |
| `Subscription Started` | the first payment above zero arrives |

With those, the conversion rate per weekly cohort, the time from trial start to activation, and the share of trials that reach each step are all countable. See the [install guide](https://dripmetric.com/docs#paid-events) for where each event usually comes from in Stripe, Paddle and Lemon Squeezy.

## How to improve it {#improve}

Start with the leak that holds the most people, not the one with the worst percentage:

- **Shorten the path to activation.** Remove or defer every onboarding step that isn't needed for the first result; a step people abandon at the same rate however fast they go is usually one whose value isn't clear.
- **Reach the convinced people personally.** Someone with high buying intent who went quiet for a week is worth a short, personal note more than any automated email.
- **Make limits an upgrade moment.** When someone hits a plan limit, the next plan should be one click away and priced for someone who needs a little more.
- **Decide on the card deliberately.** Asking for a card raises conversion and lowers sign-ups; the report found card-required trials convert at about 30%, and cautions that asking for a card can blunt sign-ups.

## Frequently asked questions {#faq}

### What is a good trial-to-paid conversion rate?

For products that lead with a free trial, 4–6% is good and 10–15% is great; when the trial requires a credit card, 25–35% is good and 50–60% is great. The median across all products is 8%. These bands come from the 2026 SaaS Conversion Report by Kyle Poyar with ChartMogul and ProductLed.

### Does requiring a credit card improve trial conversion?

It raises the conversion rate — card-required trials convert at about 30%, more than five times trials without a card — but it lowers the number of people who start a trial, so the number of paying customers may not rise.

### How do you calculate trial-to-paid conversion rate?

Divide the number of people from a trial cohort who paid within a fixed window by the number who started a trial in that cohort, and multiply by 100. Count only payments above zero.

### How long should a free trial be?

Fourteen days is the most common length (62% of products in the 2026 report), followed by 7 and 30 days. The report does not show that one length converts better, so choose the shortest trial in which a typical user reaches activation.

### What is the difference between activation rate and trial-to-paid conversion?

Activation rate is the share of new users who reach the point where the product first works for them; trial-to-paid conversion is the share who go on to pay. Activation usually comes first, so a low activation rate caps the conversion rate.

## Sources {#sources}

- Kyle Poyar with ChartMogul and ProductLed, [*The SaaS Conversion Report*](https://chartmogul.com/reports/saas-conversion-report/), 4 February 2026 — 200 products, survey run in January 2026. Accessed 8 November 2026.
- Userpilot, [*SaaS Product Metrics Benchmark Report 2025*](https://userpilot.com/saas-product-metrics/) — 62 B2B SaaS companies. Accessed 4 November 2026.
