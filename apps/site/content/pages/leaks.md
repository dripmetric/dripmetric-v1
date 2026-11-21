A **revenue leak** is a moment between someone's first visit and their first payment, or a paying customer's next renewal, where a person who was likely to pay stops, with no error, complaint or event that says so. Dripmetric watches for nine of them, from the events you already send, with no billing integration.

## Before they activate {#activate}

### Onboarding stall {#onboarding-stall}

Someone starts a step in your onboarding and stops making progress.

### Step completion collapse {#step-collapse}

Far fewer people than usual finish a step, which usually means something broke.

## Before they pay {#pay}

### Pricing quick exit {#pricing-quick-exit}

Someone opens your pricing page for the first time and leaves almost at once.

### High-intent user went quiet {#high-intent-quiet}

Someone who looked ready to buy stops using the product and never pays.

### Last-moment drop {#last-moment-drop}

Someone starts checkout and no payment follows.

### Trial ended unpaid {#trial-ended-unpaid}

A trial reaches its end date without a payment.

### Limit reached, no upgrade {#limit-reached}

Someone hits a limit of their plan and doesn't upgrade.

## After they pay {#stay}

### Payer going quiet {#payer-going-quiet}

A paying customer starts using the product much less than they used to.

### Cancelled or payment failed {#cancelled-or-failed}

A customer cancels, or a payment fails.

## Why these leaks matter {#research}

- Most new users never reach the point where the product works for them: the average activation rate across 62 B2B SaaS companies was 37.5%. — [Userpilot, SaaS Product Metrics Benchmark Report 2025](https://userpilot.com/saas-product-metrics/)
- Most trials end without a payment: the median free-to-paid conversion rate across 200 software products was 8%. — [Kyle Poyar with ChartMogul and ProductLed, The SaaS Conversion Report, February 2026](https://chartmogul.com/reports/saas-conversion-report/)
- About a third of SaaS churn is a payment that failed, not a customer who chose to leave. — [Recurly, churn rate benchmarks, July 2026 data](https://www.recurly.com/research/churn-rate-benchmarks)

Third-party research, not Dripmetric data. The [trial-to-paid guide](https://dripmetric.com/guides/trial-to-paid-conversion) has the benchmarks in more depth.

## What a leak is worth {#money}

Each leak shows what it is worth at your own prices, with the working beside the number. It is labelled potential revenue, because it counts people who might have paid, not money that arrived. With no price set there is no money figure at all.

## Frequently asked questions {#faq}

### What is a revenue leak in a SaaS funnel?

A revenue leak is a point between a visitor's first visit and their first payment, or a payer's renewal, where someone likely to pay stops without any error or complaint that says so — for example an onboarding step they never finish, a checkout with no payment, or a trial that ends unpaid.

### How is a revenue leak different from churn?

Churn is a paying customer leaving. Most leaks happen before anyone pays — in onboarding, at pricing, in checkout, at the end of a trial — so they never show up in a churn number. Two of the nine, payer going quiet and cancelled or payment failed, are about paying customers.

### Do I need payment data?

Not to start. Some leaks, such as an onboarding stall, work from product events alone. The ones about not paying need one payment event from your billing webhook, such as `Subscription Started`, so Dripmetric can tell who paid. No billing integration is needed.

### Does Dripmetric fix the leaks or contact my users?

No. Dripmetric shows you where revenue leaks and what it is worth. It does not email, nudge or message your users: what happens next is your call.
