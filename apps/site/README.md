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
    globals.css         the design system: tokens, light + dark themes, every component
    fonts/              Newsreader, Schibsted Grotesk, JetBrains Mono (SIL OFL, licences beside)
  src/content/site.ts   the facts: leak rules, intent points, plans, modules, comparison — one
                        source for the page AND the JSON-LD, each group naming the code it is
                        checked against
  src/components/home/  one server component per section
  src/components/       the interactive parts (client components): code tabs, calculator,
                        sign-up form, founding-seat link, mobile sticky bar, scroll reveal
  src/lib/              structured data (JSON-LD) and shared Open Graph metadata
  public/               robots.txt · sitemap.xml · og.png · icons · site.webmanifest
                        llms.txt · sitemap.md · index.md · privacy.md · llm/topics/ (generated)
  content/              inventory.json (the canonical page list) + the Markdown bodies
  tools/                check · build-markdown · render-images (+ og.html)
  next.config.ts        security headers, and the Markdown/llms.txt content types
```

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

| Variable                        | What to put there                                                                                                                                                               | If you leave it empty                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_WAITLIST_ENDPOINT` | An HTTPS endpoint that accepts a form `POST` with an `email` field — Formspree, Loops, Buttondown, Tally, Basin, your own API. Fields sent: `email`, `source`, `founding_seat`. | "Get early access" opens the visitor's email app with a pre-filled message to `hello@dripmetric.com`. |
| `NEXT_PUBLIC_FOUNDING_SEAT_URL` | The payment link for founding seats.                                                                                                                                            | "Claim a founding seat" scrolls to the sign-up form and ticks the founding-seat box.                  |

## Deploy (Vercel, like the founder app)

1. New Vercel project from this repository. **Root Directory: `apps/site`.** Vercel detects
   Next.js and the pnpm workspace; no `vercel.json` is needed.
2. Add the two environment variables above.
3. Add the domain `dripmetric.com` (and redirect `www` to it).

`next.config.ts` sends the security headers, serves the `.md` files as `text/markdown`
with a `rel="canonical"` Link header pointing at their HTML page, and serves `llms.txt` as
`text/plain`.

**About the Content-Security-Policy:** Next.js bootstraps App Router pages with inline
scripts, so this site's `script-src` allows `'unsafe-inline'`. The founder app uses a
per-request nonce instead, which makes every page dynamic; for a public, prerendered page
with no user input and no third-party scripts, static CDN caching is worth more. The rest
of the policy is same-origin only.

## After it is live (in this order)

1. Open `https://dripmetric.com/`, `/privacy`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`
   and `/index.md`; each should return 200 with the right content type.
2. Add the domain to **Google Search Console** and **Bing Webmaster Tools**, verify it,
   submit `https://dripmetric.com/sitemap.xml` in both, and request indexing for the home
   page in Search Console.
3. Test the share card with a link preview (Slack, X, LinkedIn) and the structured data
   with Google's Rich Results Test and the Schema.org validator. The SoftwareApplication
   markup describes the product; it will not show a rich result until there are genuine
   ratings or reviews, and FAQ rich results no longer exist in Google Search.
4. When SDK v2 is published to npm, check the package page: today it still carries the v1
   description ("automate drip emails"), and search and AI answers currently describe
   Dripmetric from it.
5. Add profile links you control (X, LinkedIn, GitHub organisation, Product Hunt) to the
   `Organization` node in `src/lib/structured-data.ts` as `sameAs`, and to the footer.

## Keeping it true

- **Facts live in `src/content/site.ts`**, copied from the Ground Truth and checked against
  the code; each group names its source file. The page and the JSON-LD both read it, so a
  price or a rule cannot differ between them.
- **Every sample is labelled simulated** — the alert, the funnel, the score, the report.
- **Edit the page, then the Markdown copy.** `content/index.body.md` restates the page for AI
  clients. When a fact changes, change it there too, then run `pnpm site:markdown`.
- **Crawlers.** `robots.txt` allows every crawler. Blocking AI training crawlers (for
  example `GPTBot` or `Google-Extended`) is a business decision with a visibility
  trade-off; make it deliberately, against each vendor's current documentation.

## Commands

```bash
pnpm site:dev        # next dev on :3001
pnpm site:build      # next build — every page prerendered
pnpm site:start      # next start on :3001, production headers
pnpm site:check      # sitemap, robots, llms.txt, images, Markdown sync; plus the rendered
                     # pages (title, canonical, one h1, JSON-LD prices, links) after a build
pnpm site:markdown   # regenerate llms.txt, sitemap.md, topic maps and the .md copies
pnpm site:images     # regenerate og.png and the icons (needs Playwright's Chromium)
```

`pnpm verify` runs `site:check`; CI runs `site:check --require-build` after `pnpm build`.
