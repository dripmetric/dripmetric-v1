# dripmetric.com — what only you can do

The code side is done and checked (`pnpm site:check`, `docs/decisions.md` 2026-11-25). The
site is live on Vercel at `https://dripmetric.com`, `www` already redirects to it with a
308, and every crawler, AI crawlers included, is allowed. Everything below needs your
accounts, and every step is free. Do it in this order: until the site is indexed, nothing
else can rank or be quoted.

Nobody can promise a ranking or a mention in ChatGPT, Perplexity, Gemini or Copilot. What
this list does is make Dripmetric findable, consistent everywhere it is described, and
mentioned on the pages those engines already trust.

## 1. This week — unblock indexing (about two hours in total)

- [ ] **1.1 Ship the site changes.** Merge the 25 Nov site changes (branch
      `claude/sharp-dijkstra-c32crt`) into `main` of `dripmetric/dripmetric-v1`; Vercel
      deploys it. Then run the checks in §5.
- [ ] **1.2 Google Search Console.** At <https://search.google.com/search-console> add a
      **Domain** property for `dripmetric.com`, verified with the DNS TXT record it gives you
      (add it where the domain's DNS is managed). Then:
  - Sitemaps → submit `https://dripmetric.com/sitemap.xml`.
  - URL Inspection → paste each URL → **Request indexing**, in this order (Google limits how
    many a day; carry the rest to tomorrow): `/`, `/about`, `/docs`, `/leaks`,
    `/guides/trial-to-paid-conversion`, `/compare/posthog`, `/buying-intent`, `/guides`,
    `/compare`.
  - Done when URL Inspection says "URL is on Google" for each.
- [ ] **1.3 Bing Webmaster Tools.** At <https://www.bing.com/webmasters> choose **Import from
      Google Search Console**, then submit the same sitemap. Bing's index also feeds
      Microsoft Copilot and several other AI answers. Then send every page through IndexNow
      (Bing, Yandex, Naver, Seznam and others), or ask Claude to run it:

      ```bash
      pnpm site:indexnow --submit
      ```

      After any later change, send only the changed paths: `pnpm site:indexnow --submit /docs`.

- [ ] **1.4 Vercel firewall.** In the site's Vercel project → Firewall: keep **Attack
      Challenge Mode off**, and if Bot Protection is on, make sure verified bots are allowed.
      A challenge page is all a crawler would see.
- [ ] **1.5 One real waitlist sign-up.** The form is open (checked 23 Nov). Join with your own
      address, then confirm it arrived: `pnpm waitlist:export`.

## 2. This week — remove the old identity from the web

Search and AI engines still describe Dripmetric from old pages. Each one below must either
disappear or say the one sentence: **"Dripmetric is a revenue-leak detector for self-serve
SaaS."** Never "drip", "email" or "onboarding emails".

- [ ] **2.1 onboardflow.xyz.** `www.onboardflow.xyz` still serves the old page ("Automate
      SaaS Onboarding Emails") from a Vercel project, and `onboardflow.xyz` fails TLS. In
      Vercel, open the old project that holds those domains → Settings → Domains → remove
      both. Add both to the dripmetric.com site project, and set each to **Redirect to
      `dripmetric.com`** with **308 Permanent**. Point their DNS where Vercel tells you.
      Done when `curl -sI https://www.onboardflow.xyz/` answers 308 to `https://dripmetric.com/`.
- [ ] **2.2 Delete the old Vercel project** once its domains are moved, so its
      `*.vercel.app` copy stops being served and crawled.
- [ ] **2.3 npm.** The old package is the first search result for "Dripmetric" and says
      "automate drip emails". It qualifies for deletion (5 downloads last week, one
      maintainer). Check nothing depends on it, then:

      ```bash
      npm unpublish dripmetric --force
      ```

      npm then blocks new versions for 24 hours, and its policy does not reserve the name
      for you after that. If you want to keep the name, run
      `npm deprecate dripmetric "No longer maintained."` instead.

- [ ] **2.4 Product Hunt.** The old **OnboardFlow** product says "mail dripping and cold
      mailing". Edit it to the sentence above, or ask Product Hunt support to remove it.
      Launch Dripmetric as a new product only when the beta opens (§3.3).
- [ ] **2.5 GitHub.** On both repositories, set the description to the sentence above, the
      website to `https://dripmetric.com`, and topics `revenue-leaks`, `saas`,
      `funnel-analytics`, `trial-conversion`, `product-analytics`.
- [ ] **2.6 Your personal site and old profiles.** Remove or rewrite any blurb that calls
      Dripmetric an email tool.
- [ ] **2.7 Decide on the public repositories.** Both GitHub repositories are public, and
      they hold the exact rules, intent points and your account name, which the site now
      keeps private. Make them private if that matters to you. First check that Vercel's
      free plan still deploys a private repository owned by an organisation; if not, deploy
      from a personal repository.

## 3. Weeks 1–8 — get mentioned where AI answers look

For "best tool for X" questions, AI answers mostly cite listicles, directories, Reddit and
YouTube, so be there, honestly. Link each mention to the page that answers the reader's
question, not always the home page. Claude can draft every text below; you post it, from
your own accounts.

- [ ] **3.1 Company profiles (week 1).** LinkedIn company page, X account, GitHub
      organisation profile README, Crunchbase. Product name only, the one sentence, link to
      `https://dripmetric.com`. Send Claude the URLs: they go into the site's structured
      data as `sameAs`.
- [ ] **3.2 Free directory listings (weeks 1–2).** SaaSHub, AlternativeTo (as an
      alternative to PostHog and Mixpanel for revenue-leak detection), Uneed, Peerlist,
      DevHunt, and the free vendor listings on G2 and Capterra. Read each one's terms first.
- [ ] **3.3 Launch posts (weeks 2–4).** Show HN led with the problem, linking `/leaks`; an
      Indie Hackers product page and post; a new Product Hunt product when the beta opens.
      Stay to answer every comment.
- [ ] **3.4 Reddit (weeks 2–8).** In r/SaaS, r/startups and r/indiehackers, answer
      trial-conversion and onboarding questions with real help, say who you are, and link
      the guide only where it answers the question. Follow each subreddit's rules.
- [ ] **3.5 "Best tools" lists (weeks 3–8).** Find current articles on PostHog
      alternatives, trial-conversion tools and SaaS funnel tools; send each author two
      accurate sentences and a link to `/compare/posthog` or `/leaks`. Never pay without a
      "sponsored" label.
- [ ] **3.6 YouTube (weeks 4–8).** Three short videos: "See your first revenue leak",
      "The nine revenue leaks", "Trial-to-paid benchmarks 2026". The page link goes first
      in each description.
- [ ] **3.7 Reviews (month 2 on).** Ask real beta users for G2 or Capterra reviews after
      real use. Never pay for reviews, write them or mark up ratings that don't exist.
- [ ] **3.8 Original data (month 3 on).** A short founder survey on trial conversion,
      published as a research page. Original numbers are what earn links and citations.

## 4. Every week — measure

There are no analytics on the site, by choice. These are free and enough.

| What                  | Where                                      | When                         | Act when                                                  |
| --------------------- | ------------------------------------------ | ---------------------------- | --------------------------------------------------------- |
| Pages indexed         | Search Console → Pages, URL Inspection     | Weekly until all are in      | A page sits in "Crawled – currently not indexed" 2+ weeks |
| Brand searches        | Search Console → Performance, "dripmetric" | Weekly                       | The old email-tool snippet still shows: inspect `/` again |
| Copilot / Bing AI     | Bing Webmaster Tools → AI Performance      | Weekly                       | A grounding query has no page: tell Claude to write one   |
| Impressions per guide | Search Console → Performance, by page      | Monthly, 28 days after index | Impressions but few clicks: rewrite only the title        |
| AI answers            | The prompts below, by hand                 | Monthly                      | An engine calls Dripmetric an email tool: fix its source  |

Ask each prompt in ChatGPT (search on), Perplexity, Google AI Mode, Gemini, Copilot and
Claude (web search on). Record the date, whether Dripmetric is mentioned, which URL is
cited and whether the answer is right. Answers vary between runs: read the trend.

1. What is Dripmetric?
2. Is Dripmetric an email marketing tool?
3. How much does Dripmetric cost?
4. Dripmetric vs PostHog
5. Tools that detect revenue leaks in a SaaS signup funnel
6. How do I find where trial users drop off before paying?
7. What is a good trial-to-paid conversion rate in 2026?
8. How do I score product-qualified leads for a self-serve SaaS?
9. Funnel analytics for Lemon Squeezy or Paddle without Stripe
10. A tool that alerts when a payment fails or a trial ends unpaid
11. Best PostHog alternatives for a small SaaS
12. What is an onboarding stall?

## 5. Checks after each deploy

| URL                                                                                                                                           | Expect                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `/`, `/about`, `/leaks`, `/buying-intent`, `/docs`, `/guides`, `/guides/trial-to-paid-conversion`, `/compare`, `/compare/posthog`, `/privacy` | 200                                                              |
| `https://www.dripmetric.com/`                                                                                                                 | 308 → `https://dripmetric.com/`                                  |
| `/pricing`, `/login`, `/signup`, `/dashboard`                                                                                                 | 308 → `https://dripmetric.com/`                                  |
| `/terms`, `/anything-else`                                                                                                                    | 404                                                              |
| `/robots.txt`, `/sitemap.xml`, `/llms.txt`                                                                                                    | 200                                                              |
| `/index.md`, `/about.md`, `/leaks.md`                                                                                                         | 200, `text/markdown`, with a `Link: <…>; rel="canonical"` header |
| `/c320416c6f9ba15a005d6b38edad1807.txt`                                                                                                       | 200, the IndexNow key                                            |

```bash
for u in / /about /guides /compare /docs /pricing /login /terms /llms.txt /about.md; do printf '%-12s ' "$u"; curl -s -o /dev/null -w '%{http_code} %{content_type} %{redirect_url}\n' "https://dripmetric.com$u"; done
```

## Keep it true

- Every number on the site is from a named, dated source. A wrong number repeated by an AI
  answer is hard to take back.
- Re-check the PostHog and benchmark facts every three months; the pages show the date.
- When the SDK is published at launch, lift the registry check in `tools/check.mjs` and
  put the install command back on `/docs`.
