# Launching dripmetric.com — what only you can do

The code side is done: eight prerendered pages, each owning one researched search topic,
with structured data, a Markdown copy for AI clients, permanent redirects for the old v1
URLs and an IndexNow script. Everything below needs your accounts, your domain or your
decisions. It is in the order it should happen.

Nobody can promise a ranking or a mention in ChatGPT, Perplexity, Gemini or Copilot —
anyone who does is guessing. What this list does is make Dripmetric the clearest,
best-sourced answer to its questions, make sure every engine can read it, and get it into
the places those engines quote. The research behind each step is summarised at the end.

## 1. Fix these before the domain switches

- [ ] **Publish SDK v2 to npm as `3.0.0`, then retire the v1 line.** npm already has
      `dripmetric` 2.0.0, 2.1.0 and 2.1.1 — the v1 drip-email SDK — so the repo's
      `packages/sdk` (version 2.0.0) cannot be published as it is. Today
      `npm install dripmetric` installs v1, which has no `dripmetric/browser` entry point,
      so the install snippet on the site fails for anyone who tries it. npm is also the
      first search result for "Dripmetric", and it still says "automate drip emails".
      Bump the version, publish, then:

      ```bash
      npm deprecate dripmetric@"<3.0.0" "This is the retired v1 drip-email SDK. Dripmetric v2: https://dripmetric.com/docs"
      ```

- [x] **The Starter price agrees everywhere.** `STARTER_PRICE_MINOR = 2_499`
      (`packages/engine/src/reports/weekly.ts:26`), the `starter` row in migration 0001 and
      the site all say $24.99 a month (12 Nov 2026 decision — see `docs/decisions.md`).
      There is no yearly price and no founding seat until one is set.
- [ ] **Decide what happens to v1 users.** The v1 product (sign-in, dashboard, drip emails)
      is what dripmetric.com serves today. Once v2 takes the domain, `/login`, `/signup`
      and `/dashboard` redirect to `https://app.dripmetric.com/login`. If anyone still uses
      v1, tell them before the switch.
- [ ] **Deploy the founder app to `app.dripmetric.com` first.** The redirects for `/login`
      and `/terms` land there (`/terms` → `/legal/terms`). Until it is live they lead to a 404.
- [ ] **Get real terms before you take money.** The product's terms and privacy pages in
      `apps/web/src/app/legal/` say they are placeholders. Have them reviewed before the
      first paid plan, and before any founding seat is offered again.
- [ ] **Set `NEXT_PUBLIC_WAITLIST_ENDPOINT`** on the site's host: an HTTPS endpoint that
      accepts a form POST with an `email` field. Without it, the button opens the visitor's
      email app instead of capturing the address. The contract is in `README.md`.

## 2. Switch the domain (Vercel)

The domain already lives on Vercel, and only Vercel (or `next start`) can send the
redirects and security headers. Use GitHub Pages as a preview only.

- [ ] Create a Vercel project from this repository with **Root Directory `apps/site`**.
      Open its preview URL and run the checks in step 2.5 on it first.
- [ ] Move `dripmetric.com` and `www.dripmetric.com` from the v1 project to the new one.
- [ ] **Make the apex the primary domain.** Today `dripmetric.com` sends a _307
      (temporary)_ redirect to `www`. Every page, sitemap entry and structured-data URL
      in v2 uses `https://dripmetric.com/`, so in Vercel → Domains set `dripmetric.com` as
      primary and `www.dripmetric.com` to redirect to it with **308 (permanent)**.
- [ ] **Redirect the old brand domain.** `www.onboardflow.xyz` serves a copy of the v1
      page, and `onboardflow.xyz` fails TLS. Point both at `https://dripmetric.com/` with
      a permanent redirect for every path, wherever that domain is hosted.
- [ ] **2.5 Check the live site.** Each of these should answer as shown:

| URL                                                                                                                 | Expect                                                               |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `https://dripmetric.com/`                                                                                           | 200, title "Dripmetric — Revenue-leak detection for self-serve SaaS" |
| `https://www.dripmetric.com/`                                                                                       | 308 → `https://dripmetric.com/`                                      |
| `/leaks`, `/buying-intent`, `/docs`, `/pricing`, `/guides/trial-to-paid-conversion`, `/compare/posthog`, `/privacy` | 200                                                                  |
| `/login`, `/signup`, `/dashboard`                                                                                   | 308 → `https://app.dripmetric.com/login`                             |
| `/terms`                                                                                                            | 308 → `https://app.dripmetric.com/legal/terms`                       |
| `/robots.txt`, `/sitemap.xml`                                                                                       | 200                                                                  |
| `/llms.txt`                                                                                                         | 200, `text/plain`                                                    |
| `/index.md`, `/leaks.md`, `/docs.md`                                                                                | 200, `text/markdown`, with a `Link: <…>; rel="canonical"` header     |
| `/c320416c6f9ba15a005d6b38edad1807.txt`                                                                             | 200, the IndexNow key                                                |
| `/anything-else`                                                                                                    | 404 page                                                             |

```bash
for u in / /leaks /docs /pricing /login /terms /llms.txt /leaks.md; do printf '%-12s ' "$u"; curl -s -o /dev/null -w '%{http_code} %{content_type} %{redirect_url}\n' "https://dripmetric.com$u"; done
```

- [ ] **Check Vercel isn't blocking crawlers.** If Bot Protection, Attack Challenge Mode
      or a firewall rule is on, make sure `Googlebot`, `bingbot`, `OAI-SearchBot`,
      `Claude-SearchBot` and `PerplexityBot` still get 200s (Vercel → Firewall logs).

## 3. Search engines (launch day)

- [ ] **Google Search Console.** Add a _Domain_ property for `dripmetric.com` (DNS TXT
      record) so it covers apex, `www` and `app`. Submit `https://dripmetric.com/sitemap.xml`.
      In URL Inspection, request indexing for `/`, `/docs` and `/pricing` first (Google
      already knows those URLs from v1), then `/leaks`, `/buying-intent`,
      `/guides/trial-to-paid-conversion` and `/compare/posthog`. No "Change of address":
      the domain isn't changing, only what it serves.
- [ ] **Bing Webmaster Tools.** Import the site from Search Console, submit the sitemap,
      then send every page through IndexNow (it reaches Bing, which also grounds Microsoft
      Copilot, plus Yandex, Naver, Seznam and others):

      ```bash
      pnpm site:indexnow --submit
      ```

      Run it again after every content change, with just the changed paths, for example
      `pnpm site:indexnow --submit /docs /pricing`. Without `--submit` it shows what it
      would send and sends nothing. It refuses to submit until the key file is live.

- [ ] **Bing AI Performance report** (Bing Webmaster Tools, public preview since February
      2026): check it weekly. It is the only first-party report of how often Copilot cites
      your pages, and for which grounding queries.
- [ ] **Watch the old v1 snippet disappear.** Search `site:dripmetric.com` after a week. If
      Google still shows "Automate SaaS Onboarding Emails", inspect `/` again and request
      indexing.

## 4. Say the same thing everywhere

Search and answer engines currently describe Dripmetric from v1 sources (npm, pkgstats,
the OnboardFlow listing, the old page). Replace every one with the same words. Long form:

> Dripmetric is a revenue-leak detector for self-serve SaaS. It shows where and how much
> revenue leaks between a visitor's first visit and their first payment — nine readable
> leak rules, a transparent buying-intent score and masked alerts — with no billing
> integration.

Short form (under 160 characters): _Revenue-leak detection for self-serve SaaS: where, how much
and who revenue leaks between first visit and first payment. No billing integration._

- [ ] npm package description, keywords and README (with the v2 publish above).
- [ ] GitHub: organisation profile README, repository descriptions and topics
      (`revenue-leaks`, `saas`, `funnel-analytics`, `trial-conversion`, `product-analytics`).
- [ ] Product Hunt: the existing **OnboardFlow** product says "mail dripping and cold
      mailing". Update or retire it, then launch Dripmetric as a new product when the
      public beta opens — it is a different product, which is what a relaunch needs.
- [ ] Create the profiles you will keep up: LinkedIn company page, X, GitHub
      organisation, Crunchbase. Then add their URLs as `sameAs` on the `organization`
      node in `src/lib/structured-data.ts` and link them in the footer.
- [ ] Never describe Dripmetric as an email or drip tool anywhere. The name already invites
      it ("Drip" is an email company; Bing suggests "dripmatic" and "dimetric" for it).

## 5. Get into the places AI answers quote

The studies in the research summary agree on one thing: for "best tool for X" questions,
answers mostly cite listicles, Reddit threads and YouTube videos, and only rarely a brand's
own homepage. So earn those, honestly.

- [ ] **Launch posts, one per channel, written for that audience:**
  - Show HN — lead with the rules, not the pitch: _"Show HN: Dripmetric – nine readable
    rules that find revenue leaks in a SaaS funnel"_, linking `/leaks`. Stay to answer.
  - Product Hunt (new product, see §4).
  - Indie Hackers product page and a launch post.
  - Reddit: r/SaaS, r/startups, r/indiehackers, r/SideProject. Read each sub's
    self-promotion rules; posting the trial-to-paid benchmarks as a useful thread will
    get further than an announcement.
- [ ] **Directories:** SaaSHub, AlternativeTo (as an alternative to PostHog and Mixpanel,
      described accurately), Uneed, Peerlist Launchpad, DevHunt, MicroLaunch, BetaList
      (now paid), G2 and Capterra/GetApp (free listings). Check each one's current terms
      first.
- [ ] **Reviews:** ask real beta users for G2 or Capterra reviews once they have used it.
      Never pay for them, never write them yourself, and never add ratings to the
      structured data that aren't real.
- [ ] **Listicle inclusion:** find current articles on "best PostHog alternatives", "tools
      to improve trial-to-paid conversion" and "SaaS revenue leak tools" (ThriveStack, Tiny
      Startups and Toolradar publish them), and send each author two accurate sentences
      plus a link to `/compare/posthog` or `/leaks`.
- [ ] **YouTube, three short videos:** a 10-minute setup demo ("see your first leak"),
      "The nine revenue leaks", and "Trial-to-paid benchmarks 2026". YouTube is the
      most-cited site in Google AI Overviews in the 2026 panel. Put the canonical page link
      first in each description.

## 6. Keep publishing (next eight weeks)

Each page owns one topic; add them the same way as the existing ones (a file in
`content/pages`, a row in `content/inventory.json` and `src/content/pages.ts`, then
`pnpm site:markdown`, `pnpm site:check` and `pnpm site:indexnow --submit /new-path`).

1. Dripmetric vs Mixpanel, and Dripmetric vs Amplitude — dated and sourced like the
   PostHog page.
2. "Time to first value: how to measure it" (people search "time to first value metric").
3. "Product-qualified leads for self-serve: a transparent PQL score" (searched as
   "product qualified lead" and "pql scoring").
4. "Involuntary churn: what to catch before recovery" — clear that Dripmetric detects
   and does not recover.
5. A public changelog, once there are real releases.
6. Once there is consented production data: a benchmark report from Dripmetric's own
   aggregated numbers. It is the asset most likely to earn links and citations, because
   nobody else has it.

## 7. Measure it

- **Search Console (28 days after indexing):** queries containing "dripmetric", and
  impressions per guide page. Rewrite a title only when a page has impressions but no
  clicks.
- **Bing AI Performance:** citations and grounding queries, weekly.
- **AI answers, monthly.** Ask the same prompts in ChatGPT (search on), Perplexity,
  Google AI Mode, Gemini, Microsoft Copilot and Claude (web search on). For each, record
  the date, whether Dripmetric is mentioned, which URL is cited, and whether the answer is
  accurate. Answers vary between runs, so read the trend, not one result:
  1. What is Dripmetric?
  2. Is Dripmetric an email marketing tool?
  3. How much does Dripmetric cost?
  4. Dripmetric vs PostHog
  5. Tools that detect revenue leaks in a SaaS signup funnel
  6. How do I find where trial users drop off before paying?
  7. How do I get alerted when a high-intent trial user goes quiet?
  8. Best PostHog alternatives for a small SaaS
  9. What is a good trial-to-paid conversion rate in 2026?
  10. Does requiring a credit card increase trial conversion?
  11. How do I calculate trial-to-paid conversion rate?
  12. How do I score product-qualified leads for a self-serve SaaS?
  13. Funnel analytics for Lemon Squeezy or Paddle without Stripe
  14. How do I detect checkout abandonment in a SaaS?
  15. What is an onboarding stall?
  16. How do I know which free users are ready to buy?
  17. A tool that alerts when a payment fails or a trial ends unpaid
  18. How do I measure time to first value?
  19. Revenue leakage detection for subscription software
  20. Tools that track onboarding drop-off with Slack alerts
- **Referrals from AI apps** (chatgpt.com, perplexity.ai and others) need analytics, and
  the site deliberately has none. If you want them, a cookieless option such as Vercel Web
  Analytics is the smallest step — a product and cost decision, and the privacy page
  would need to say so.
- **Crawler visits:** Vercel's logs show which bots fetch which pages. A visit is not a
  citation, but no visits after a few weeks means something is blocking them.

## 8. Keep it true

- The guide pages are `content/pages/*.md` — the same file is the HTML page and its
  Markdown copy. `pnpm site:check` fails if a leak rule, an intent point or a catalog
  event in the code stops matching what a page says.
- Every number on the site is measured, from the code, or from a named source with a date.
  Keep it that way; a wrong number repeated by an AI answer is hard to take back.
- Re-check the PostHog and benchmark facts every three months; the pages show the date
  they were checked.

## The research behind this (checked 8 November 2026)

- **Where the brand stands:** "Dripmetric" has no search suggestions yet; search results
  lead with the v1 npm package. dripmetric.com serves the v1 drip-email site with a 307 to
  `www`; `www.onboardflow.xyz` serves a copy of it.
- **What people search** (Google autocomplete, US): "trial to paid conversion rate
  (benchmark)", "free trial conversion rate benchmarks", "saas activation rate benchmark",
  "time to first value", "product qualified lead", "pql scoring", "involuntary churn",
  "posthog alternatives", "mixpanel alternatives", "funnel analytics tools",
  "saas revenue leakage", "lemon squeezy analytics", "paddle analytics". Each has, or is
  planned to get, one page that owns it.
- **What AI answers cite:** an analysis of the Search Arena dataset (UC Berkeley and
  LMArena, 24,069 conversations) and a 2026 panel of 723 Google AI Overviews found that
  48% of recommendation answers cited a "best/top" listicle, 43% cited Reddit or YouTube,
  brand homepages were 3.2% of citations, and AI Overviews mostly cite pages already
  ranking in the top 10 ([Paradigm, _AI Search Citation Study 2026_](https://paradigmmedianetworks.com/ai-search-citation-study-2026/)).
- **Competition for "leaks":** ThriveStack publishes about 26 "growth leak" pages with
  unsourced statistics; billing-side tools own "revenue leak" wording. Dripmetric's edge is
  exact rules from its own code and sourced numbers.
- **Platform rules:** Google needs nothing special for AI Overviews or AI Mode beyond
  normal indexing and snippet eligibility; it stopped showing FAQ rich results on 7 May 2026. ChatGPT search uses `OAI-SearchBot`, Claude uses `Claude-SearchBot`, Perplexity
  uses `PerplexityBot`; the site's robots.txt allows them all. Blocking the training
  crawlers (`GPTBot`, `ClaudeBot`, `Google-Extended`) is your call — it keeps your text out
  of future models, which also means future models know less about Dripmetric.
