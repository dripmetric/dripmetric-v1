Dripmetric installs with one npm package, `dripmetric`, which has two entry points: `dripmetric/browser` for your website and app, and `dripmetric/server` for your backend. A typical team product needs about 10–15 lines of code. Product events alone give you the funnel, step timing, the buying-intent score and four of the nine leaks; one paid event from your billing webhook switches on the other five. There is no billing integration to connect.

Dripmetric is in private beta: your project keys (`pk_live_…` for the browser, a secret key for the server) come with your invite. [Get early access](https://dripmetric.com/#get-access).

## 1. Install {#install}

```bash
npm install dripmetric
```

Send `Signed Up`, `Activated`, `Checkout Started` and billing events from your server where you can: ad blockers and a declined consent banner cannot stop those, and they are the events every number depends on.

## 2. In the browser {#browser}

```js
import * as dripmetric from 'dripmetric/browser';

// Once, in your page shell. Captures page views, time on page and sessions.
dripmetric.init('pk_live_…');

// At signup and on every app load. Traits are sent only when they change.
dripmetric.identify(user.id, {
  email: user.email,
  createdAt: user.createdAt,
  signupMethod: 'google',
});

// For team products.
dripmetric.group(account.id, { name: account.name, domain: 'acme.com' });

// Your own events. Use a catalog name where one fits, or your own name and map it later.
dripmetric.track('Invoice Sent');
```

Prefer a script tag?

```html
<script src="https://cdn.dripmetric.com/v2/dripmetric.js"></script>
<script>
  dripmetric.init('pk_live_…');
</script>
```

**What it captures on its own:** page views including single-page-app route changes, time actually spent on a page, sessions, and — on your key pages only, loaded lazily after the page is idle — form starts, submits, abandons and errors, rage clicks, dead clicks, slow pages and pricing interactions. Where a guess would be weak, mark the element:

```html
<button data-dripmetric-plan="pro" data-dripmetric-interval="month">Choose Pro</button>
<button data-dripmetric-interval-toggle="annual">Annual</button>
```

## 3. Consent {#consent}

By default the library stores nothing on the visitor's device and sends nothing — not even a settings request — until you call `dripmetric.consent(true)`. Events wait in memory with their original timestamps and go out when consent arrives; if it never arrives they are discarded.

```js
dripmetric.init('pk_live_…'); // waits for consent
onBannerAccepted(() => dripmetric.consent(true));
onBannerRejected(() => dripmetric.consent(false)); // forgets everything
```

If your audience needs no banner, the generated snippet can carry `requireConsent: false`. Check with your own counsel first.

| Option | Default | What it does |
|---|---|---|
| `requireConsent` | `true` | Store and send nothing until `consent(true)` |
| `host` | Dripmetric's API | A first-party route through your own domain, so ad blockers do not drop page views |
| `marketingHosts` | `[]` | Hosts where page titles may be sent. Titles are never sent from inside your app |
| `debug` | `false` | Log problems to the console instead of staying silent |

## 4. On your server {#server}

```js
import { Dripmetric } from 'dripmetric/server';

const dm = new Dripmetric({ secretKey: process.env.DRIPMETRIC_SECRET_KEY });

dm.track(user.id, 'Signed Up', { method: 'google' });
dm.track(user.id, 'Activated');
dm.track(user.id, 'Checkout Started', { plan: 'pro', amount: 2900, currency: 'usd' });

// Before a script or a serverless invocation exits.
await dm.shutdown();
```

A call only adds to an in-memory queue and returns, so it never slows a request, and the background timer does not keep your process alive.

**Verifying identity.** A browser can claim to be any user id. With identity verification switched on, sign the id on your server and pass it along:

```js
import { signUserId } from 'dripmetric/server';
const userIdHmac = signUserId(process.env.DRIPMETRIC_SECRET_KEY, user.id);
// then in the browser:
dripmetric.identify(user.id, { email: user.email, userIdHmac });
```

## 5. Paid events from any billing provider {#paid-events}

Dripmetric never connects to Stripe, Paddle, Lemon Squeezy or any other billing provider. You send the payment events yourself, from the webhook handler you already have, with the same `track()` call as any other event — so every provider, and a billing table of your own, works the same way.

**One event switches on five leaks:** `Subscription Started`, sent the first time someone actually pays. Amounts are in minor units (cents), with a currency code.

```js
// In your billing webhook handler, after you have verified the webhook.
dm.track(userId, 'Subscription Started', { plan: 'pro', amount: 4900, currency: 'usd' });
```

Where each canonical event usually comes from:

| Dripmetric event | Stripe | Paddle Billing | Lemon Squeezy |
|---|---|---|---|
| `Subscription Started` (the paid event) | the first `invoice.paid` with an amount above zero | the first `transaction.completed` with an amount above zero | the first `subscription_payment_success` |
| `Trial Started` | `customer.subscription.created` with status `trialing` | `subscription.trialing` | `subscription_created` for a subscription that starts on a trial |
| `Payment Failed` | `invoice.payment_failed`, after at least one payment | `transaction.payment_failed` | `subscription_payment_failed` |
| `Subscription Cancelled` | `customer.subscription.deleted`, after at least one payment | `subscription.canceled` | `subscription_expired` |
| `Cancellation Scheduled` | `cancel_at_period_end` turning true | a scheduled cancel on `subscription.updated` | `subscription_cancelled` (access continues to the period end) |

Two details that matter: trials create zero-amount invoices, so only count a payment above zero as `Subscription Started`; and send `Checkout Started` from the server where you create the checkout session, passing your user id to the provider (in Stripe, as `client_reference_id`) so the payment can be matched to the person. Check your provider's own reference for your setup: [Stripe event types](https://docs.stripe.com/api/events/types), [Paddle webhooks](https://developer.paddle.com/webhooks/overview), [Lemon Squeezy webhook events](https://docs.lemonsqueezy.com/help/webhooks/event-types).

**Trial dates** switch on [trial ended unpaid](https://dripmetric.com/leaks#trial-ended-unpaid): send a `trialEndsAt` trait when a trial starts, or a `Trial Ended` event.

**Your list price** turns leak counts into money: set it during setup, and every leak shows `people × list price` with the formula beside the number. See [what a leak is worth](https://dripmetric.com/leaks#money).

## 6. Other stacks {#stacks}

The snippet generator writes ready-made installs for Next.js App Router, Node/Express, Django, Flask, Rails, Laravel, Go net/http and plain HTTP, and the setup includes a prompt you can paste into Cursor, Copilot or a similar AI coder to write the integration for you. Python, Ruby, PHP and Go can also use Segment's open-source libraries with the host pointed at Dripmetric, and Segment, RudderStack or PostHog can forward events with no code. Anything else can call the HTTPS API directly:

```bash
curl https://api.dripmetric.com/v1/batch \
  -H "Authorization: Bearer $DRIPMETRIC_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"batch":[{"type":"track","messageId":"evt-1","userId":"user_123","event":"Signed Up"}]}'
```

## 7. Promises the library keeps {#promises}

- **It never blocks your app.** Sending happens off the rendering path, in batches.
- **It never throws.** Every call is wrapped. Turn on `debug` to see problems.
- **Bounded memory.** At most 1,000 queued events; the oldest are dropped first.
- **Short timeouts.** 3 seconds a request, 3 retries with jittered backoff, then a 60-second pause.
- **Small.** The browser core is 5,018 bytes gzipped, and the build fails if it grows past 5,120. Forms, clicks and speed capture load separately, only where they are used.
- **MIT licensed.**

## 8. The event catalog {#events}

Dripmetric reads 76 canonical events. Use these names where they fit; where your product already has its own name for something, keep it and map it once in the event dictionary. Events marked *secret key only* can never be sent from a browser.

### Visits and sessions (3)

| Event | How it arrives | What Dripmetric uses it for |
|---|---|---|
| Page Viewed | Captured by the browser SDK | Steps, pricing, journeys. |
| Page Left | Captured by the browser SDK | Step timing and the pricing quick exit. Stored for key pages; elsewhere it only adds to session totals. |
| Signed In | One line of code | Returns, and trouble getting in. |

### Signup, onboarding and activation (12)

| Event | How it arrives | What Dripmetric uses it for |
|---|---|---|
| Signup Started | Captured by the browser SDK | Signup abandonment by device and browser. |
| Signed Up | One line of code | Starts the funnel; cohorts. Send from the server: ad blockers and declined consent cannot stop it. |
| Email Verified | One line of code | Funnel step and filter. |
| Onboarding Step Viewed | A page rule you set | The entered time for step timing; stalls. |
| Onboarding Step Completed | One line of code | The completed time; the funnel. |
| Onboarding Step Skipped | One line of code | Stall risk; step highlights. |
| Form Started | Captured by the browser SDK | Step diagnosis. Key pages only. |
| Form Submitted | Captured by the browser SDK | Step diagnosis. Key pages only. |
| Form Abandoned | Captured by the browser SDK | Step diagnosis. Key pages only. |
| Form Error | Captured by the browser SDK | Step diagnosis. Field names only, never what was typed. |
| Activated | One line of code | Funnel; time to value; intent +25. Send from the server where possible. |
| Onboarding Completed | Worked out by Dripmetric | Funnel. Derived from the last Key step, or sent as a line. |

### Value and usage (10)

| Event | How it arrives | What Dripmetric uses it for |
|---|---|---|
| Core Action | One line of code | Intent +10 at 3 in 14 days; the payer path. Mapped once from the founder’s own name. |
| Feature Used | One line of code | What paying users did differently. For the 5 to 10 features that matter. |
| Data Imported | One line of code | Intent +10, shared with Integration Connected. |
| Integration Connected | One line of code | Intent +10, shared with Data Imported. |
| Integration Disconnected | One line of code | Risk: a disconnected integration often comes before a cancellation. |
| Result Shared | One line of code | Depth. kind is link, report or view-only invite. |
| API Key Created | One line of code | Activation for developer tools. From the server. |
| First API Call | One line of code | Activation for developer tools. From the server. |
| Plan Limit Approached | One line of code | The upgrade moment. Sent at 80% of a limit. |
| Plan Limit Reached | One line of code | Intent +20 (shared with a paywall view); the leak "limit reached without upgrading". |

### Teams and accounts (4)

| Event | How it arrives | What Dripmetric uses it for |
|---|---|---|
| Account Created | One line of code | The account funnel. |
| Invite Sent | One line of code | Intent +15. |
| Account Added User | One line of code | Account score: +10 with two members active. |
| Account Removed User | One line of code | Risk: an account losing members is an account on its way out. |

### Buying intent and checkout (15)

| Event | How it arrives | What Dripmetric uses it for |
|---|---|---|
| Pricing Viewed | A page rule you set | Intent +10 after 10 s of active time; the quick-exit rule. In the app and on the marketing site. |
| Pricing Interaction | Captured by the browser SDK | Deliberation. kind is toggle, plan-card, faq or comparison. |
| Plan Selected | Captured by the browser SDK | One step before checkout. Stored as evidence; 0 points until calibration. |
| Upgrade Prompt Viewed | One line of code | A paywall view counts as the paywall hit: +20, shared with Plan Limit Reached. |
| Upgrade Prompt Clicked | One line of code | Upgrade-moment diagnosis. |
| Upgrade Prompt Dismissed | One line of code | Three dismissals flag a price objection: a different problem, not lower intent. |
| Billing Page Viewed | A page rule you set | Context for paying or cancelling. |
| Evaluation Page Viewed | A page rule you set | Team buyers check security, compliance, integrations and API docs. 0 points for now. |
| Checkout Started | One line of code | Intent +30 except trial checkouts; the last-moment drop. Send from the server where the Stripe session is created, and pass the user id to Stripe as client_reference_id. |
| Checkout Abandoned | Worked out by Dripmetric, secret key only | Leak. Our 2-hour rule after Checkout Started; Stripe checkout.session.expired is only a fallback. |
| Checkout Payment Declined | Your billing webhook (server), secret key only | Diagnosis; rescue. Stripe payment_intent.payment_failed with the bank’s decline code. |
| Payment Method Added | Your billing webhook (server), secret key only | Intent +15 when a card is saved before the trial ends and the trial began without one. |
| Discount Code Entered | One line of code | Price sensitivity (splits). |
| Sales Contact Requested | One line of code | Intent +20; routing. |
| Trial Extension Requested | One line of code | Trial signal. Stored as evidence; 0 points until calibration. |

### Revenue (from your billing webhook) (18)

| Event | How it arrives | What Dripmetric uses it for |
|---|---|---|
| Trial Started | Your billing webhook (server), secret key only | Starts the trial clock. Stripe customer.subscription.created with status trialing. |
| Trial Ending Soon | Your billing webhook (server), secret key only | Alert timing. Stripe customer.subscription.trial_will_end; ignored if the trial already ended. |
| Trial Ended | Your billing webhook (server), secret key only | The "trial ended unpaid" leak. If never paid, a cancellation, a pause or a failed first invoice counts as unpaid, not churn. |
| Checkout Completed | Your billing webhook (server), secret key only | Funnel. Stripe checkout.session.completed with an amount above zero. |
| Subscription Started | Your billing webhook (server), secret key only | THE PAID EVENT: conversion, and "intent but didn’t pay". The first invoice.paid with an amount above zero; trials create zero-amount invoices. |
| Subscription Renewed | Your billing webhook (server), secret key only | Retention. Each later invoice.paid. |
| Plan Upgraded | Your billing webhook (server), secret key only | Revenue movement. Stripe customer.subscription.updated, price changed. |
| Plan Downgraded | Your billing webhook (server), secret key only | Revenue movement. Stripe customer.subscription.updated, price changed. |
| Seats Changed | Your billing webhook (server), secret key only | Revenue movement. Stripe customer.subscription.updated, quantity changed. |
| Billing Interval Changed | Your billing webhook (server), secret key only | Retention. Monthly to annual or back. |
| Cancellation Scheduled | Your billing webhook (server), secret key only | Churn decided, money not yet lost: a risk alert. cancel_at_period_end turning true, or cancel_at set. |
| Cancellation Reversed | Your billing webhook (server), secret key only | A save. cancel_at_period_end turning false, or cancel_at cleared. |
| Subscription Cancelled | Your billing webhook (server), secret key only | Churn; leak counts. Stripe customer.subscription.deleted, after at least one payment. |
| Payment Failed | Your billing webhook (server), secret key only | Involuntary churn; leak. Stripe invoice.payment_failed after at least one payment. |
| Payment Recovered | Your billing webhook (server), secret key only | Proof. Stripe invoice.paid after a failure. |
| Refund Issued | Your billing webhook (server), secret key only | Risk: revenue already counted and given back. Stripe charge.refunded. |
| Dispute Opened | Your billing webhook (server), secret key only | Risk: a chargeback costs the fee as well as the revenue. Stripe charge.dispute.created. |
| Card Expiring Soon | Your billing webhook (server), secret key only | Risk. Derived from the saved card’s expiry month. |

### Friction and risk (12)

| Event | How it arrives | What Dripmetric uses it for |
|---|---|---|
| Rage Click | Captured by the browser SDK | Step diagnosis; step highlights. Three clicks, each within 1 s and 30 px of the previous one. Key pages only. |
| Dead Click | Captured by the browser SDK | Diagnosis. A click followed by no change on the page. Key pages only. |
| Slow Page | Captured by the browser SDK | Diagnosis; the quick-exit rule. Main content over 4 s on a full page load, or a reply to a click over 500 ms. |
| Error Shown | One line of code | Stall cause; diagnosis. For errors the user sees. |
| Help Viewed | A page rule you set | Stall context. |
| Support Contacted | One line of code | Stall context; payer risk. |
| Password Reset Requested | One line of code | Risk: trouble getting in is a stall cause that looks like churn. From the server. |
| Login Failed | One line of code | Risk: repeated failures are a stall cause, not disinterest. From the server. |
| Cancel Flow Started | A page rule you set | Risk alert. |
| Cancel Reason Given | One line of code | The weekly report. |
| Data Exported | One line of code | Risk: a bulk export is often the last thing a leaving customer does. |
| Account Deletion Requested | One line of code | Risk: the clearest possible churn signal. |

### Segment compatibility (2)

| Event | How it arrives | What Dripmetric uses it for |
|---|---|---|
| Signed Out | One line of code | Accepted from Segment’s B2B spec and stored. No rule uses it yet. |
| Account Deleted | One line of code | Accepted from Segment’s B2B spec and stored. No rule uses it yet. |

## Frequently asked questions {#faq}

### How do I install Dripmetric?

Run `npm install dripmetric`, call `init()` once in your page shell and `identify()` at signup, and send `Signed Up`, `Activated` and `Checkout Started` from your server. A typical team product needs about 10–15 lines of code, and the setup includes a prompt that lets an AI coder write them.

### Do I need Stripe or a billing integration?

No. Dripmetric never connects to a billing provider. Send `Subscription Started` from the webhook handler you already have — Stripe, Paddle, Lemon Squeezy, Chargebee, Razorpay, RevenueCat or your own billing table all work the same way.

### Will ad blockers or consent banners lose my data?

They can stop browser events, which is why the events every number depends on — `Signed Up`, `Activated`, `Checkout Started` and billing events — should come from your server. The browser library also supports a first-party `host` route through your own domain.

### Does it work with Next.js?

Yes. The snippet generator has a ready-made Next.js App Router install, and the same package covers Node/Express on the server.

### Can I keep my own event names?

Yes. Use a catalog name where one fits; otherwise send your own name and map it to the canonical event once in the event dictionary. Nothing in your code has to change.
