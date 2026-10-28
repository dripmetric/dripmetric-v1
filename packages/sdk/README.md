# dripmetric

See where revenue leaks between a visitor's first visit and their first payment.

```bash
npm install dripmetric
```

Two entry points: `dripmetric/browser` for your website and app, `dripmetric/server`
for your backend. Send `Signed Up`, `Activated`, `Checkout Started` and billing events
from the server where you can — ad blockers and a declined consent banner cannot stop
those, and they are the events every number depends on.

## In the browser

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

### Consent

By default the library stores nothing on the visitor's device and sends nothing — not
even a settings request — until you call `dripmetric.consent(true)`. Events wait in
memory with their original timestamps and go out when consent arrives; if it never
arrives they are discarded.

```js
dripmetric.init('pk_live_…'); // waits for consent
onBannerAccepted(() => dripmetric.consent(true));
onBannerRejected(() => dripmetric.consent(false)); // forgets everything
```

If your audience needs no banner, say so and the generated snippet will carry
`requireConsent: false`. Check with your own counsel first.

### Options

| Option           | Default | What it does                                                                       |
| ---------------- | ------- | ---------------------------------------------------------------------------------- |
| `requireConsent` | `true`  | Store and send nothing until `consent(true)`                                       |
| `host`           | our API | A first-party route through your own domain, so ad blockers do not drop page views |
| `marketingHosts` | `[]`    | Hosts where page titles may be sent. Titles are never sent from inside your app    |
| `debug`          | `false` | Log problems to the console instead of staying silent                              |

### What it captures on its own

Page views including single-page-app route changes, time actually spent on a page,
sessions, and — on your key pages only, loaded lazily after the page is idle — form
starts, submits, abandons and errors, rage clicks, dead clicks, slow pages and pricing
interactions.

Where a guess would be weak, use an attribute instead:

```html
<button data-dripmetric-plan="pro" data-dripmetric-interval="month">Choose Pro</button>
<button data-dripmetric-interval-toggle="annual">Annual</button>
```

### Script tag

```html
<script src="https://cdn.dripmetric.com/v2/dripmetric.js"></script>
<script>
  dripmetric.init('pk_live_…');
</script>
```

## On your server

```js
import { Dripmetric } from 'dripmetric/server';

const dm = new Dripmetric({ secretKey: process.env.DRIPMETRIC_SECRET_KEY });

dm.track(user.id, 'Signed Up', { method: 'google' });
dm.track(user.id, 'Activated');
dm.track(user.id, 'Checkout Started', { plan: 'pro', amount: 2900, currency: 'usd' });

// Before a script or a serverless invocation exits.
await dm.shutdown();
```

A call only adds to an in-memory queue and returns, so it never slows a request. The
background timer does not keep your process alive.

### Verifying identity

A browser can claim to be any user id. With identity verification switched on for
your project, sign the id on your server and pass it along:

```js
import { signUserId } from 'dripmetric/server';
const userIdHmac = signUserId(process.env.DRIPMETRIC_SECRET_KEY, user.id);
// then in the browser:
dripmetric.identify(user.id, { email: user.email, userIdHmac });
```

## Promises this library keeps

- **It never blocks your app.** Sending happens off the rendering path, in batches.
- **It never throws.** Every call is wrapped. Turn on `debug` to see problems.
- **Bounded memory.** At most 1,000 queued events; the oldest are dropped first.
- **Short timeouts.** 3 seconds a request, 3 retries with jittered backoff, then a
  60-second pause. If our API is down, that is our problem, not your page's.
- **Small.** The browser core is under 5 KB gzipped, and the build fails if it grows
  past it. Forms, clicks and speed capture load separately, only where they are used.

## Other languages

We publish browser and Node libraries. Python, Ruby, PHP and Go are covered by
Segment's own open-source libraries with the host pointed at ours; everything else can
use plain HTTP against our OpenAPI spec.

## Licence

MIT.
