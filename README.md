# Dripmetric v2 — Observe layer

Shows early-stage SaaS founders where, and how much, revenue leaks between a
visitor's first visit and their first payment. **Observe** is the free level: it shows
_where_ and _how much_. Paid plans add _who_, _why_ and _what to do_.

Work in progress on branch `v2-observe`. See `docs/progress.md` for what is built.

## Getting started

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts Postgres in Docker, applies the migrations and runs the founder app
on <http://localhost:3000> alongside the worker. There is no email account to set up:
with no `RESEND_API_KEY`, sign-in links are printed to the console and listed at
<http://localhost:3000/dev/mailbox>.

Then: sign in, create a project, copy the keys, and send an event from anywhere.

```bash
curl http://localhost:3000/v1/batch \
  -H "Authorization: Bearer $DRIPMETRIC_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"batch":[{"type":"track","messageId":"test-1","userId":"user_123","event":"Signed Up"}]}'
```

## Commands

```bash
pnpm dev          # Postgres, migrations, web (:3000) and worker
pnpm test         # 111 tests: unit and integration (needs Postgres)
pnpm verify       # everything CI runs: lint, format, typecheck, licences, tests
pnpm db:reset     # drop, recreate and migrate
```

## What is here

| Package            | What it is                                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/catalog` | The settled event catalog as typed data: 76 events, 18 context fields, 20 computed signals, the dozen canonical meanings, and the Zod schemas for the wire format |
| `packages/ingest`  | The ingest pipeline, framework-agnostic: auth, limits, dedupe, filters, enrichment, identity, batched writes                                                      |
| `packages/db`      | Plain-SQL migrations, the scoped query helper, envelope encryption, `can(project, feature)`                                                                       |
| `packages/engine`  | Pure funnel, intent and leak functions (M6–M8)                                                                                                                    |
| `apps/web`         | The founder app and the public API route handlers                                                                                                                 |
| `apps/worker`      | pg-boss jobs behind a thin queue adapter                                                                                                                          |

## Documentation

- `docs/openapi.yaml` — the ingest API, also served at `/v1/openapi.json`
- `docs/progress.md` — the milestone plan and what is proven
- `docs/decisions.md` — the settled product decisions and every engineering decision
- `CLAUDE.md` — the working rules and the hard invariants
