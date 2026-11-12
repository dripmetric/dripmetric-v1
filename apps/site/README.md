# dripmetric.com — the landing page

The marketing site for Dripmetric, on the same stack as the founder app: **Next.js 16
(App Router, Turbopack), React 19, TypeScript**, the same pinned versions as `apps/web`.
It is a separate app so that `dripmetric.com` never depends on the founder app's database,
auth or secrets — the founder app stays on `app.dripmetric.com`.

Every page is prerendered at build time (`○ Static` in the build output), so search engines
and AI answer engines get the whole page as plain HTML without running JavaScript. There
are no third-party requests, no cookies and no analytics; fonts are self-hosted.

```
apps/site/
  src/app/              layout (fonts, shared metadata) · page.tsx (home) · privacy/ · not-found
                        leaks/ · buying-intent/ · docs/ · pricing/ · guides/… · compare/…
    globals.css         the design system: tokens, light + dark themes, every component
    fonts/              Geist and Geist Mono (SIL OFL 1.1, licences beside them)
  src/content/site.ts   the facts: leak rules, intent points, plans, modules, comparison — one
                        source for the home page AND the JSON-LD, each group naming the code it
                        is checked against
  src/content/pages.ts  the guide pages: search title, description, schema type, related pages
  src/components/home/  one server component per home section: hero, facts, leaks,
                        how-it-works, plans, faq, final-cta, header, footer
  src/components/       article-page (the guide layout) and the two client parts:
                        the waitlist form and the sticky phone bar
  src/lib/              structured data (JSON-LD), Markdown rendering, shared Open Graph
  public/               robots.txt · sitemap.xml · og.png · icons · site.webmanifest
                        IndexNow key · llms.txt · sitemap.md · llm/topics/ · *.md (generated)
  content/              inventory.json (the canonical page list) · redirects.json (old v1 URLs)
                        index.body.md · privacy.body.md · pages/*.md (the guide pages)
  tools/                check · build-markdown · export · indexnow · render-images (+ og.html)
  next.config.ts        security headers, v1 redirects, Markdown/llms.txt content types
  LAUNCH.md             everything outside the repo: domain switch, search engines, listings
```

## One page, one job

The home page exists to do one thing: get a work email onto the waitlist. It answers, in
order, what this is, whether it is for you, why to believe it, what it costs and what to do
next — in seven sections, and nothing else. Depth lives on the pages below, each of which
owns one topic and is linked from the section that raises it.

`pnpm site:check` holds the home page to a budget (8 sections, 1,400 words of rendered
HTML). That is what stops it growing back one reasonable addition at a time: the version
it replaced had reached 14 sections and ~2,600 visible words. When something new has to be
said, say it on the page that owns the topic and link to it.

## The pages, and what each one is for

| Page                               | Owns searches like                                                       | Source                           |
| ---------------------------------- | ------------------------------------------------------------------------ | -------------------------------- |
| `/`                                | "dripmetric", "revenue leak detection SaaS"                              | `src/components/home/*`          |
| `/leaks`                           | "SaaS revenue leaks", "onboarding drop off", "checkout abandonment SaaS" | `content/pages/leaks.md`         |
| `/buying-intent`                   | "product qualified lead", "pql scoring", "buying intent score"           | `content/pages/buying-intent.md` |
| `/docs`                            | "install dripmetric", "lemon squeezy analytics", "paddle analytics"      | `content/pages/docs.md`          |
| `/pricing`                         | "dripmetric pricing" (and the v1 `/pricing` URL)                         | `content/pages/pricing.md`       |
| `/guides/trial-to-paid-conversion` | "trial to paid conversion rate benchmark"                                | `content/pages/guides/…`         |
| `/compare/posthog`                 | "posthog alternatives", "dripmetric vs posthog"                          | `content/pages/compare/…`        |
| `/privacy`                         | —                                                                        | `src/app/privacy/page.tsx`       |

A guide page's Markdown file is both the HTML page (rendered at build time by
`src/lib/markdown.ts`) and the Markdown copy served at the same path plus `.md`, so the
two cannot drift. Headings carry stable ids (`## Onboarding stall {#onboarding-stall}`);
other pages link to them. A `## Frequently asked questions {#faq}` section becomes the
page's FAQPage structured data, built from the same text.

## Run it locally

```bash
pnpm install
```

```bash
pnpm site:dev
```

Open <http://localhost:3001> (the founder app keeps `:3000`). To test exactly what will be
deployed — prerendered pages, production headers, real 404s:

```bash
pnpm site:build && pnpm site:start
```

## Before you deploy — set two values

Both are environment variables, read at build time (see `.env.example`; copy it to
`.env.local` to try them locally):

| Variable                        | What to put there                                                                                                                                                               | If you leave it empty                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_WAITLIST_ENDPOINT` | An HTTPS endpoint that accepts a form `POST` with an `email` field — Formspree, Loops, Buttondown, Tally, Basin, your own API. Fields sent: `email`, `source`, `founding_seat`. | "Join the waitlist" opens the visitor's email app with a pre-filled message to `hello@dripmetric.com`. |
| `NEXT_PUBLIC_FOUNDING_SEAT_URL` | The payment link for founding seats, used by the button on `/pricing`.                                                                                                          | "Claim a founding seat" goes to the waitlist form, which records the request and says so.              |

## The design system

`src/app/globals.css` is the whole of it: tokens first, then components in page order.

- **Colour has three jobs.** Ink carries the text. One water-teal is the brand _and_ the
  action, so what you can press and the flow through the funnel look like one thing. Coral
  is reserved for the leak — the drop in the mark, the people who stopped, the money at
  stake — and appears nowhere else, so the leak is always what you see first. Every text
  pair passes WCAG 2.2 AA in both themes, and the hatched "lost" bar in the funnel reads as
  missing without relying on colour.
- **Two faces, 52 KB**: Geist for everything a person reads, Geist Mono for code and for
  figures inside the product samples. Both are self-hosted (the product promises the IP is
  never stored, so the site does not hand visitors' IPs to a font CDN).
- **Dark mode is a real theme**, not an inversion: its own surfaces, a brighter teal that
  can carry text on near-black, and every pair re-checked.
- No JavaScript is needed to read the page. The only two client components are the waitlist
  form and the sticky phone bar.

## Deploy (Vercel, like the founder app) — the production choice

1. New Vercel project from this repository. **Root Directory: `apps/site`.** Vercel detects
   Next.js and the pnpm workspace; no `vercel.json` is needed.
2. Add the two environment variables above.
3. Add the domain `dripmetric.com` as the **primary** domain and redirect `www` to it with
   a 308. (Today the v1 site redirects the other way, with a 307 — see `LAUNCH.md` §2.)

`next.config.ts` sends the security headers, serves the `.md` files as `text/markdown`
with a `rel="canonical"` Link header pointing at their HTML page, serves `llms.txt` as
`text/plain`, and permanently redirects the v1-only URLs listed in
`content/redirects.json` (`/login`, `/signup`, `/dashboard`, `/terms`). Those redirects are
why production belongs on Vercel: dripmetric.com has served v1 for months, and its old
URLs are indexed.

**Moving the domain from v1 to v2 is a site migration.** Follow `LAUNCH.md` — it lists
the order (npm, founder app, terms, domain, search engines) and what to check live.

**About the Content-Security-Policy:** Next.js bootstraps App Router pages with inline
scripts, so this site's `script-src` allows `'unsafe-inline'`. The founder app uses a
per-request nonce instead, which makes every page dynamic; for a public, prerendered page
with no user input and no third-party scripts, static CDN caching is worth more. The rest
of the policy is same-origin only.

## Deploy on GitHub Pages

GitHub Pages serves static files only, so it gets a static export of the same site
(`pnpm site:export` → `apps/site/out`). The workflow `.github/workflows/site-pages.yml`
builds that export on every push to `v2-observe` that touches the site, and **publishes
only once you switch it on** — until then it just checks that the export builds.

To test the export locally first:

```bash
pnpm site:export && npx serve apps/site/out
```

(`serve` maps `/privacy` to `privacy.html` the way Pages does; a bare
`python -m http.server` does not.)

**One-time setup, in the GitHub repository's Settings:**

1. **Pages** → Build and deployment → Source: **GitHub Actions**.
2. **Environments** → `github-pages` → Deployment branches and tags: make sure
   **`v2-observe`** is allowed. (The environment appears once Pages uses Actions; if only
   the default branch is allowed, the deploy fails with "Branch "v2-observe" is not
   allowed to deploy to github-pages due to environment protection rules".)
3. **Secrets and variables → Actions → Variables** → New repository variable:
   `SITE_PAGES_ENABLED` = `true`. Add `NEXT_PUBLIC_WAITLIST_ENDPOINT` and
   `NEXT_PUBLIC_FOUNDING_SEAT_URL` here too when you have them (they end up in the
   public page, so variables are fine — no secrets involved).

**Publish:** push a change under `apps/site` to `v2-observe`, or open
Actions → "Landing page → GitHub Pages" → the latest run → **Re-run all jobs**. The manual
"Run workflow" button only appears for workflows on the default branch (`main`); until
`v2-observe` is merged there, the CLI does the same:

```bash
gh workflow run site-pages.yml --ref v2-observe
```

The first deploy lands on `https://harshit110927.github.io/dripmetric-v1/` — the workflow
reads that `/dripmetric-v1` base path from GitHub and builds for it.

**Point dripmetric.com at it:**

1. Verify the domain first (GitHub → your account Settings → Pages → Add a domain; it
   gives you a TXT record), so nobody else can claim it.
2. Repository Settings → Pages → Custom domain: `dripmetric.com` → Save. No `CNAME` file
   is needed with an Actions deploy.
3. At your DNS provider, for the apex `dripmetric.com`:
   - `A` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `AAAA` → `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`,
     `2606:50c0:8003::153`
   - `www` → `CNAME` → `harshit110927.github.io`

   Leave `app.dripmetric.com` pointing at the founder app.

4. Once the DNS check passes, tick **Enforce HTTPS** (GitHub can take up to 24 hours to
   offer it).
5. Re-run the workflow once: with the custom domain set, the base path becomes empty and
   the site is rebuilt for `https://dripmetric.com/`.

**What GitHub Pages cannot do:** send custom response headers or real redirects. The
security headers in `next.config.ts` (Content-Security-Policy, frame protection, HSTS
value) and the `rel="canonical"` Link headers on the `.md` copies only apply on Vercel or
`next start`. For the v1 URLs, the export writes stub pages (`login.html` and so on) with
an instant meta refresh, which search engines treat as a permanent redirect — a fallback,
not an equal. It also writes each page as both `page.html` and `page/index.html`, so the
page loads however the host resolves `/page`. The pages themselves still carry their
canonical tags, structured data and everything else. Use Pages as a preview, and Vercel
for dripmetric.com.

## After it is live

Everything outside the repository — the domain switch from v1, Search Console, Bing and
IndexNow, the npm package, listings, launch posts and how to measure AI answers — is in
**[LAUNCH.md](LAUNCH.md)**, in order. Also test the share card with a link preview (Slack,
X, LinkedIn) and the structured data with Google's Rich Results Test and the Schema.org
validator. The SoftwareApplication markup describes the product; it will not show a rich
result until there are genuine ratings or reviews, and FAQ rich results no longer exist in
Google Search.

## Keeping it true

- **Facts live in `src/content/site.ts`**, copied from the Ground Truth and checked against
  the code; each group names its source file. The page and the JSON-LD both read it, so a
  price or a rule cannot differ between them.
- **Every sample is labelled simulated** — the funnel, the alert and the revealed person.
  The funnel and the alert on the home page are the product's own: the alert's title and
  fields come from `packages/engine/src/alerts/payload.ts`, its sentence from
  `packages/engine/src/leaks/rules.ts` and its rule from `packages/engine/src/leaks/types.ts`.
- **Edit the page, then the Markdown copy.** `content/index.body.md` restates the home page
  for AI clients. When a fact changes, change it there too, then run `pnpm site:markdown`.
  The guide pages have no second copy: edit `content/pages/*.md` and run the same command.
- **The pages are checked against the code.** `pnpm site:check` fails if a leak rule in
  `packages/engine/src/leaks/types.ts`, an intent rule or its points in
  `packages/engine/src/intent/points.ts`, or an event in `packages/catalog/src/events.ts`
  no longer appears on the page that explains it — and the leak rules are checked against
  `src/content/site.ts` too, because the home page quotes three of them in full.
- **Facts about other companies are dated.** The PostHog comparison and the benchmark guide
  say when they were checked and link their sources. Re-check them every three months.
- **New page:** add `content/pages/<slug>.md`, a row in `content/inventory.json`, an entry in
  `src/content/pages.ts` and a three-line route in `src/app/<slug>/page.tsx` (copy one), then
  `pnpm site:markdown && pnpm site:check`. After it is deployed,
  `pnpm site:indexnow --submit /<slug>`.
- **Crawlers.** `robots.txt` allows every crawler. Blocking AI training crawlers (for
  example `GPTBot` or `Google-Extended`) is a business decision with a visibility
  trade-off; make it deliberately, against each vendor's current documentation.

## Commands

```bash
pnpm site:dev        # next dev on :3001
pnpm site:build      # next build — every page prerendered
pnpm site:start      # next start on :3001, production headers
pnpm site:export     # static export to apps/site/out (GitHub Pages / any static host)
pnpm site:indexnow   # dry run of an IndexNow submission; --submit sends it (after deploying)
pnpm site:check      # sitemap, robots, llms.txt, images, Markdown sync; plus the rendered
                     # pages (title, canonical, one h1, JSON-LD prices, links) after a build
pnpm site:markdown   # regenerate llms.txt, sitemap.md, topic maps and the .md copies
pnpm site:images     # regenerate og.png and the icons (needs Playwright's Chromium)
```

`pnpm verify` runs `site:check`; CI runs `site:check --require-build` after `pnpm build`.
