Setting up Dripmetric means a few lines in your website and app, and a few on your server. A typical team product needs about 10–15 lines of code. Product events alone show where people stall before paying; one paid event from your billing webhook switches on the rest. There is no billing integration to connect.

Dripmetric is in private beta: the install steps for your stack and your project keys (`pk_live_…` for the browser, a secret key for the server) come with your invite. [Join the waitlist](https://dripmetric.com/#waitlist).

## 1. What to send, and from where {#overview}

Send `Signed Up`, `Activated`, `Checkout Started` and billing events from your server where you can: ad blockers and a declined consent banner cannot stop those, and they are the events every number depends on.

## 2. In the browser {#browser}

```js
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

// Your own events. Use a standard name where one fits, or your own name and map it later.
dripmetric.track('Invoice Sent');
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
// On your server:
const userIdHmac = signUserId(process.env.DRIPMETRIC_SECRET_KEY, user.id);
// then in the browser:
dripmetric.identify(user.id, { email: user.email, userIdHmac });
```

## 5. Paid events from any billing provider {#paid-events}

Dripmetric never connects to Stripe, Paddle, Lemon Squeezy or any other billing provider. You send the payment events yourself, from the webhook handler you already have, with the same `track()` call as any other event — so every provider, and a billing table of your own, works the same way.

**One event switches on the payment leaks:** `Subscription Started`, sent the first time someone actually pays. Amounts are in minor units (cents), with a currency code.

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

The snippet generator writes ready-made installs for Next.js App Router, Node/Express, Django, Flask, Rails, Laravel, Go net/http and plain HTTP, and the setup includes a prompt you can paste into Cursor, Copilot or a similar AI coder to write the integration for you. Python, Ruby, PHP and Go can also use Segment's open-source libraries with the host pointed at Dripmetric, and Segment, RudderStack or PostHog can forward events with no code. Anything else can send events to Dripmetric's HTTPS API; the address and an example come with your invite.

## 7. Promises the library keeps {#promises}

- **It never blocks your app.** Sending happens off the rendering path, in batches.
- **It never throws.** Every call is wrapped. Turn on `debug` to see problems.
- **Bounded memory.** At most 1,000 queued events; the oldest are dropped first.
- **Short timeouts.** 3 seconds a request, 3 retries with jittered backoff, then a 60-second pause.
- **Small.** The browser core is about 5 KB gzipped. Forms, clicks and speed capture load separately, only where they are used.
- **MIT licensed.**

## 8. Event names {#events}

Dripmetric has its own standard events, such as `Signed Up`, `Activated`, `Checkout Started` and `Subscription Started`. Use those names where they fit; where your product already has its own name for something, keep it and map it once. Invited founders get the full list, with what each event is used for.

## Frequently asked questions {#faq}

### How do I set up Dripmetric?

Call `init()` once in your page shell and `identify()` at signup, and send `Signed Up`, `Activated` and `Checkout Started` from your server. A typical team product needs about 10–15 lines of code. The install steps for your stack and your keys come with your invite, and the setup includes a prompt that lets an AI coder write the lines for you.

### Do I need Stripe or a billing integration?

No. Dripmetric never connects to a billing provider. Send `Subscription Started` from the webhook handler you already have — Stripe, Paddle, Lemon Squeezy, Chargebee, Razorpay, RevenueCat or your own billing table all work the same way.

### Will ad blockers or consent banners lose my data?

They can stop browser events, which is why the events every number depends on — `Signed Up`, `Activated`, `Checkout Started` and billing events — should come from your server. The browser library also supports a first-party `host` route through your own domain.

### Does it work with Next.js?

Yes. The snippet generator has a ready-made Next.js App Router install, and the same server library covers Node/Express.

### Can I keep my own event names?

Yes. Use a standard name where one fits; otherwise send your own name and map it once in the event dictionary. Nothing in your code has to change.
