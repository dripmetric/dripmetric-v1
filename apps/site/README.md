# dripmetric.com — the landing page

The marketing site for Dripmetric, on the same stack as the founder app: **Next.js 16
(App Router, Turbopack), React 19, TypeScript**, the same pinned versions as `apps/web`.
It is a separate app so that `dripmetric.com` never depends on the founder app's auth or
secrets — the founder app stays on `app.dripmetric.com`. Its one link to the database is
the waitlist endpoint, through a role that can add an address and do nothing else.

Every page is prerendered at build time (`○ Static` in the build output; the only dynamic
route is `ƒ /api/waitlist`), so search engines
and AI answer engines get the whole page as plain HTML without running JavaScript. There
are no third-party requests, no cookies and no analytics; fonts are self-hosted.

```
apps/site/
  src/app/              layout (fonts, shared metadata) · page.tsx (home) · privacy/ · not-found
                        leaks/ · buying-intent/ · docs/ · guides/… · compare/…
                        api/waitlist/route.server.ts (the one dynamic route; not in the export)
    globals.css         the design system: tokens, light + dark themes, every component
    fonts/              Geist and Geist Mono (SIL OFL 1.1, licences beside them)
  src/content/site.ts   the facts: leak rules, features, the waitlist endpoint — one
                        source for the home page AND the JSON-LD, each group naming the code it
                        is checked against
  src/content/pages.ts  the guide pages: search title, description, schema type, related pages
  src/content/waitlist-messages.ts  what a visitor reads after joining, one copy for both paths
  src/components/home/  one server component per home section: hero, problem, leaks,
                        features, how-it-works, faq, final-cta, header, footer
  src/components/       article-page (the guide layout) and the two client parts:
                        the waitlist form and the sticky phone bar
  src/lib/              structured data (JSON-LD), Markdown rendering, shared Open Graph,
                        waitlist-handler.ts (the endpoint, testable without Next.js)
  public/               robots.txt · sitemap.xml · og.png · icons · site.webmanifest
                        IndexNow key · llms.txt · sitemap.md · llm/topics/ · *.md (generated)
  content/              inventory.json (the canonical page list) · redirects.json (old v1 URLs)
                        index.body.md · privacy.body.md · pages/*.md (the guide pages)
  tools/                check · build-markdown · export · indexnow · render-images (+ og.html)
  next.config.ts        security headers, v1 redirects, Markdown/llms.txt content types
  vercel.json           the build command: builds @dripmetric/db first, then the site
  LAUNCH.md             everything outside the repo: domain switch, search engines, listings
```

## One page, one job

The home page exists to do one thing: get a work email onto the waitlist. It answers, in
order: what this is (the claim and the form), why it matters (the problem), how it works
(the nine rules), what you get when something leaks, how setup goes, the questions people
ask (including what Dripmetric never touches), and the ask again. Seven sections, and
nothing else. Depth lives on the pages below, each of which owns one topic and is linked
from the section that raises it.

Two rules hold the page honest:

- **Text only, and only what is true today.** No illustrations and no sample data: the
  first screen is the claim, one sentence of what Dripmetric is, and the form. The only
  non-prose element is the install code, because that is literally what a founder pastes.
  The verb is "see", not "fix" — Dripmetric finds and reports leaks; it does not act on
  them, and it does not message anyone's users (`docs/publishing.md`, "What is not built").
- **No prices anywhere before launch.** No plan names, no price, no Offer markup. `/pricing`
  is a permanent redirect to the home page (`content/redirects.json`).

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

To try the waitlist end to end, start the local database (`pnpm db:up && pnpm db:migrate`)
and put two lines in `apps/site/.env.local`:

```
WAITLIST_INTAKE=open
SITE_DATABASE_URL=postgres://dripmetric_site:dripmetric_site@localhost:54329/dripmetric
```

## The waitlist

The form posts to the site's own endpoint, `POST /api/waitlist`
(`src/app/api/waitlist/route.server.ts`, logic in `src/lib/waitlist-handler.ts`), which
writes to the **product's own Postgres**, the same database the founder app uses. When
signup opens, the people on this list are the first ones invited, and an invite is a join
on the email address rather than an import from a form service.

**It takes nothing until you say so.** Two switches, both off unless set exactly:

| Variable                 | Off (default, or anything else)                        | On                                                    |
| ------------------------ | ------------------------------------------------------ | ----------------------------------------------------- |
| `WAITLIST_INTAKE=open`   | Answers "The waitlist isn't open yet", stores nothing  | Stores each address                                   |
| `WAITLIST_AUTOMATION=on` | Sends nothing anywhere; addresses wait in the database | Hands each new address to the welcome-mail automation |

Vercel applies a variable change only to the next deployment: change it, then redeploy.

**What the site can do to the database.** It connects as `dripmetric_site` (migration
`0013_waitlist.sql`), a role that can call two functions, `waitlist_join` and
`waitlist_mark_forwarded`, and nothing else. It cannot read the list, not even the row it
just wrote, and it cannot reach any other table. If the site's credential leaked, someone
could add addresses, never read one. Row-level security is on, with no policy, as the
backstop.

**What the endpoint checks, in order:** the intake switch (before reading the body); that a
browser's `Origin` is this site; a body under 4 KB, form-encoded or JSON; the `_gotcha`
honeypot (filled = pretend success, store nothing); five tries per IP per ten minutes, held
in memory only, so no IP address is ever written down; the address (one `@`, a dotted
domain, no throwaway providers, the same rules as founder signup). A repeat address answers
exactly like a new one, so the form can't be used to test who has signed up. Log lines
never contain the address.

| Outcome                        | Status    | JSON `error`                         |
| ------------------------------ | --------- | ------------------------------------ |
| Stored, or already on the list | 200       | none (`{"ok":true}`)                 |
| Intake closed                  | 503       | `waitlist_closed`                    |
| Database not reachable         | 503       | `waitlist_unavailable`               |
| Not an address / throwaway     | 422       | `email_invalid` / `email_disposable` |
| Too many tries                 | 429       | `rate_limited` (+ `Retry-After`)     |
| Another site, bad body         | 403 / 400 | `request_refused`                    |

The form shows the matching sentence from `src/content/waitlist-messages.ts`. A browser
posting without JavaScript gets the same sentence as a small page (`noindex`).

### The welcome-mail automation (a placeholder today)

When `WAITLIST_AUTOMATION=on` and both `WAITLIST_AUTOMATION_URL` (https) and
`WAITLIST_AUTOMATION_SECRET` (32+ characters, `openssl rand -hex 32`) are set, each **new**
address is sent, after the visitor has their answer, as:

```
POST <WAITLIST_AUTOMATION_URL>
Content-Type: application/json
Idempotency-Key: waitlist-42
Dripmetric-Signature: t=1795000000,v1=<hex HMAC-SHA256 of "1795000000.<body>">

{"type":"waitlist.joined","id":42,"email":"founder@example.com","source":"hero","joined_at":"2026-11-20T10:00:00.000Z"}
```

Any 2xx counts as delivered and stamps `forwarded_at` on the row. To check a request is
really from the site, recompute the HMAC over `<t>.<raw body>` with the shared secret,
compare in constant time, and reject a `t` more than five minutes old. Zapier, Make, n8n
and Loops can all receive this. Make the automation idempotent on `email` or the
idempotency key: a resend is possible.

**Nothing is lost while it is off.** Every address waits with `forwarded_at` empty. Once
the automation exists, send the backlog (a dry run first; it only sends with `--send`):

```bash
pnpm waitlist:forward
```

```bash
pnpm waitlist:forward --send
```

A hand-off that fails is logged and left waiting; the same command sends it next time.

### Export, and the backup it gives you

```bash
pnpm waitlist:export
```

Writes every address to `waitlist-export-<date>.csv` (readable by you only, gitignored),
with formula-looking cells defused for spreadsheets. Both commands run as the database
owner (`ADMIN_DATABASE_URL`), the only role that can read the list. On Supabase Free there
are no backups, so this export is the backup: run it weekly until there are.

**Removing someone** who asks (the privacy page promises it), in the Supabase SQL editor:
`DELETE FROM waitlist WHERE lower(email) = lower('them@example.com');`

### Without a server

The static export (`pnpm site:export`, for GitHub Pages) cannot run the endpoint, so it is
left out of that build (`.server.ts` files only build on a server; see `next.config.ts`).
There the form posts to `NEXT_PUBLIC_WAITLIST_ENDPOINT` if you set one, any service that
answers a form POST of `email` and `source` with a 2xx (Formspree, Loops, Tally), and
otherwise opens a pre-filled email to `hello@dripmetric.com`.

## The design system

`src/app/globals.css` is the whole of it: tokens first, then components in page order.

- **Colour has three jobs.** Ink carries the text. One water-teal is the brand _and_ the
  action. Coral is reserved for the leak — the drop in the mark, the word "leaks" in the
  headline, the edge of the problem's examples — and appears nowhere else, so the leak is
  always what you see first. Every text pair passes WCAG 2.2 AA in both themes.
- **Two faces, 52 KB**: Geist for everything a person reads, Geist Mono for code. Both are self-hosted (the product promises the IP is
  never stored, so the site does not hand visitors' IPs to a font CDN).
- **Dark mode is a real theme**, not an inversion: its own surfaces, a brighter teal that
  can carry text on near-black, and every pair re-checked.
- No JavaScript is needed to read the page. The only two client components are the waitlist
  form and the sticky phone bar.

## Deploy (Vercel, like the founder app) — the production choice

1. New Vercel project from this repository. **Root Directory: `apps/site`.** Vercel detects
   Next.js and the pnpm workspace (pnpm 10.28.0 from the root `packageManager` field).
   `apps/site/vercel.json` sets the build command, `pnpm --filter @dripmetric/site... run
build`, which builds `@dripmetric/db` (the waitlist's database code) before the site;
   leave the dashboard's build, install and output settings at their defaults.
2. **Node.js 22.x** (Settings → Build and Deployment). The root `package.json` needs
   `>=22.12.0`; `apps/site/package.json` declares no engines, so set it explicitly.
3. Production branch: `main`. Merge the site work there; every other branch gets a preview.
4. Add the waitlist's variables (`.env.example` and "The waitlist" above):
   `SITE_DATABASE_URL`, `DATABASE_CA_CERT`, and `WAITLIST_INTAKE` when you are ready to
   take addresses. Leave `NEXT_PUBLIC_WAITLIST_ENDPOINT` empty, and never set
   `SITE_STATIC_EXPORT` or `SITE_BASE_PATH` on Vercel: they are for GitHub Pages only.
5. Add the domain `dripmetric.com` as the **primary** domain and redirect `www` to it with
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
   `SITE_PAGES_ENABLED` = `true`. Add `NEXT_PUBLIC_WAITLIST_ENDPOINT` here too when you
   have it (it ends up in the public page, so a variable is fine — no secret involved).

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
  claim or a rule cannot differ between them.
- **Every sample is labelled simulated.** The home page has none. The guide pages' worked
  examples (for example "12 people at a $49 list price" on `/leaks`) say they are simulated.
- **Every feature on the home page names its code.** `FEATURES` in `src/content/site.ts`
  lists the module behind each one; nothing there is planned work.
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
pnpm site:export     # static export to apps/site/out (GitHub Pages / any static host);
                     # builds @dripmetric/db first, so it works from a clean checkout
pnpm site:indexnow   # dry run of an IndexNow submission; --submit sends it (after deploying)
pnpm site:check      # sitemap, robots, llms.txt, images, Markdown sync; plus the rendered
                     # pages (title, canonical, one h1, JSON-LD prices, links) after a build
pnpm site:markdown   # regenerate llms.txt, sitemap.md, topic maps and the .md copies
pnpm site:images     # regenerate og.png and the icons (needs Playwright's Chromium)
pnpm waitlist:export # every waitlist address to a CSV (owner connection)
pnpm waitlist:forward # how many addresses wait for the automation; --send sends them
```

`pnpm verify` runs `site:check`; CI runs `site:check --require-build` after `pnpm build`.
