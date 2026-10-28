# Decisions

Two parts. **Part 1 is settled by the founder and closed** — do not reopen; if one looks
wrong, say so in the milestone report and keep building as written. **Part 2** is the
engineering log: every choice I make, with date, choice, reason, in 2–5 lines.

---

## Part 1 — Settled product decisions (brief §3, copied 2026-10-28)

Numbers in brackets are decision numbers in the Observe spec.

| Topic | Settled answer |
|---|---|
| Repo | `harshit110927/dripmetric-v1`, branch `v2-observe`. Held only a README on 28 Oct 2026, so build fresh unless v1 code appears. |
| Free and paid | The table in brief §2 (the "latest plan": segment splits are free). |
| Database [1] | Supabase Free now, plain Postgres features only, so leaving is a dump and a restore. Plus a parallel self-managed **shadow copy** (M13): dual writes through the worker, shadow reads that log differences and latency, daily reconciliation, monthly drills. Switch triggers: storage > 400 MB of 500 MB, p95 dashboard query > 1 s, or real data needing backups we control. **Gate: no real founder data until the shadow copy or Supabase Pro backups exist.** |
| Event table [3] | The compact design (brief §4): dictionary-encoded event names, integer user keys, context stored once per session, ~215 bytes per event. |
| Retention [4] | Free keeps 90 days of raw events, paid keeps 13 months, daily summaries kept forever. |
| Alert channels [5] | Instant masked alerts to Slack **or** Discord (founder's choice) plus an always-on in-app feed. Founders with neither get one email digest a day, only on days with alerts. |
| Masking [6] | A 6-character tag from an HMAC of the user id under a per-project secret; coarse times. |
| Intent score [7] | Defaults in brief §8.2. The "didn't pay" window is a **manual per-project setting, default 14 days**. Leave `TODO(decision-7)` where the window is read. Do not build trial-aware logic. |
| Leaks [8] | Defaults in brief §8.3: 24-hour stalls (adaptive per step once data exists), a 2-hour checkout window, 7 days quiet. |
| Paid event [9] | **Required to finish setup**: `Subscription Started`, or a Stripe connection later. The dashboard works before it arrives; "intent but didn't pay" and potential revenue stay off, with a plain note, until it does. |
| Event matching [10] | Built from day one: an event dictionary, an Inbox for unmapped events, AI-suggested mappings the founder confirms. Founders map to ~a dozen fixed meanings only. |
| Libraries [11] | We build the **browser and Node libraries only**. We accept Segment's message format, so Segment's own open-source libraries (Python, Ruby, PHP, Go) work pointed at our host. Any other language uses plain HTTP. |
| No-code feeds [12] | Adapters for Segment, RudderStack and PostHog. |
| Consent [13] | Where consent is required, the browser SDK stores nothing on the device and sends nothing — not even a config fetch — until `consent(true)`. Events wait in memory and go out only if consent arrives. Server events are unaffected. |
| Potential revenue [14] | Always shown, with its formula on screen. |
| Event catalog [16] | Settled. Brief Appendix A is the list. |
| Deferred | Database choice at relaunch [2] and the tier-plan update [15]. Ignored. |

### Settled stack (technical design D1–D6)

- Next.js on Vercel for the founder app. The public API starts as Next.js route handlers,
  but ingest code must be framework-agnostic so it can move to its own service later.
- Supabase Postgres, plain-SQL migrations. Postgres only: no ClickHouse. A per-user
  step-state table. Partition events by month later (pg_partman), not now.
- One always-on Node worker running pg-boss on the same Postgres. Keep pg-boss behind a
  thin queue adapter so it can be swapped.
- Server-only database access. Every query scoped by project through one helper, RLS on as
  a backstop. The browser never holds a database key.
- App-level envelope encryption (AES-256-GCM) for stored secrets and end-user emails, with
  a key id stored beside each ciphertext. Not Supabase Vault, not pgsodium.
- Our own system email (login links, alert digests, reports) through Resend.
- A small, cheap Anthropic model for event-mapping suggestions. Model id in config.
- Sentry plus structured JSON logs.
- TypeScript everywhere, strict mode. Ingest hot path: plain parameterised SQL, batched
  inserts, no ORM.

### Assumptions carried from the brief (§12), flagged for the founder

Working hours Mon–Fri 09:00–18:00 local · quiet hours 22:00–08:00 · a median needs 20
activations · the `optedOut` trait · timestamps more than 24 h in the future are rejected ·
the `type` property on `Checkout Started` · the two "didn't pay" counts (past the window,
still inside it) · the weekly subject counts users who reached high intent last week and
have not paid yet.

---

## Part 2 — Engineering decisions

### 2026-10-28 · Repo state: build fresh

`harshit110927/dripmetric-v1` on `main` is a single `README.md` (45 bytes, commit
`38c6ded`). No v1 SDK, no Next.js app, no cron. Brief Step 0 says: if still empty, build
fresh. Building fresh. Nothing from v1 was reused because there is nothing there.

### 2026-10-28 · Background pages: all reachable

All six claude.ai pages in brief Appendix C resolve and are readable through the Claude
Docs connector (they are Claude Docs documents, not plain artifacts). The Observe spec
`12g68usntWGs9pvMmS2QA2` has two tabs: the spec and the Event catalog. There is **no
Projects tool** in this session, so the project-document copies (`claude/*.md`) and the
PDF prints are not reachable — but every one of them has a live page that is, so nothing
is lost. I read them on demand, not up front.

### 2026-10-28 · Toolchain versions (verified against the npm registry today)

Node 22.22.0 · pnpm 10.28.0 · Docker 29.9.2 / Compose 5.6.1 · Postgres 16.15 client.
Checked today: `pg-boss` 12.38.0 (MIT, needs Node ≥ 22.12 — we have it) · `next` 16.4.3
(MIT) · `zod` 4.6.7 (MIT) · `vitest` 5.0.5 (MIT) · `pg` 8.23.1 (MIT) · `pino` 10.4.0 (MIT)
· `eslint` 10.13.0 (MIT) · `prettier` 3.9.10 (MIT) · `@playwright/test` 1.64.1 (Apache-2.0).

### 2026-10-28 · TypeScript pinned to 6.0.3, not 7.x

`typescript@latest` is 7.0.2 (the native compiler), but `typescript-eslint@8.72.1` still
peer-requires `typescript >=4.8.4 <6.1.0`. Linting a TS 7 codebase would be unsupported.
6.0.3 is the newest version inside that range, so we get current language features and a
working lint toolchain. Revisit when typescript-eslint ships TS 7 support.

### 2026-10-28 · No `ua-parser-js`: a 120-line parser of our own

`ua-parser-js@2.0.10` is **AGPL-3.0-or-later** — confirmed against the registry, exactly as
the brief warned. It cannot ship in the web app. We need only three facts (device type,
OS, browser + major version) and we prefer the low-entropy client hints when the browser
sends them, so the user-agent string is a fallback. A small parser of our own in
`packages/ingest/src/enrich/user-agent.ts` is MIT-clean, has no supply chain, and is
testable against fixtures. `bowser` (MIT) is the fallback if ours proves too weak.

### 2026-10-28 · Postgres driver: `pg` (node-postgres), not `postgres` (porsager)

`pg` is MIT; `postgres` is Unlicense (fine, but less common in audits). More important:
pg-boss is built on `pg`, so one driver and one pool serve both. `pg` only uses prepared
statements when a query is given a `name`, and we never name one — so the same code works
through Supabase's transaction pooler (port 6543), which does not support them. No ORM
anywhere; plain parameterised SQL through the scoped helper.

### 2026-10-28 · Test runner: vitest; lint: eslint flat config + prettier

Vitest 5 runs the same TypeScript the app does with no build step, has first-class
`vi.useFakeTimers` for the time-travel tests the engines need, and one config covers unit
and integration. ESLint 10 flat config with `typescript-eslint`. Prettier for formatting,
checked in CI so no diff is ever about whitespace.

### 2026-10-28 · Migrations: plain SQL files + a 60-line runner, no migration library

Settled decision D2 says plain-SQL migrations. A library would add a dependency and its own
table format for something that is `ls`, `sort`, `BEGIN`, run, record. `packages/db/migrations/NNNN_name.sql`
run in filename order inside one transaction each, recorded in `schema_migrations`.
Migrations are forward-only; a mistake is corrected by a new migration.
