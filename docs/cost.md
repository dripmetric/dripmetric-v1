# Measured size and cost

Every number here was measured on this codebase, not estimated. The commands that
produce them are given so they can be re-run and disagreed with.

Measured 29 October 2026, on one dev container: 4 vCPU, Postgres 16 in Docker on the
same machine. **A deployed setup adds a network between the app and the database**, so
treat the shapes as real and the absolutes as a floor.

---

## The SDK, gzipped

`pnpm sdk:build`

| Entry                             | Raw      | Gzipped     | Budget               |
| --------------------------------- | -------- | ----------- | -------------------- |
| `dripmetric/browser` core         | 14,039 B | **5,018 B** | 5,120 B              |
| lazy chunk (forms, clicks, speed) | 3,774 B  | 1,556 B     | reported, not capped |
| script tag (everything)           | 18,262 B | 6,532 B     | —                    |
| `dripmetric/server`               | 3,378 B  | 1,556 B     | —                    |

The core is at **98% of its budget**, and CI fails the build if it goes over (brief §6:
"CI enforces the size budgets"). That is deliberately uncomfortable: the next feature
added to the core has to earn its bytes or go in the lazy chunk.

---

## Storage per event

`pnpm test -- storage-budget`

**245 bytes per event** over 200,000 events, against a 215-byte target with a ±20%
tolerance (172–258). Inside the tolerance, near the top of it.

| Part                           | Bytes/event |
| ------------------------------ | ----------- |
| heap (the row itself)          | 124.3       |
| `events_pkey`                  | 50.3        |
| `events_project_user_time_idx` | 39.3        |
| `events_project_name_time_idx` | 30.8        |
| `events_received_brin_idx`     | 0.1         |

**Half the cost is indexes**, which is worth knowing before anyone proposes a fifth
one. The BRIN index on `received_at` is effectively free, which is why retention scans
use it.

What this means in practice:

| Events/month | Raw storage | Against Supabase Free's 500 MB                   |
| ------------ | ----------- | ------------------------------------------------ |
| 100,000      | ~25 MB      | fine                                             |
| 1,000,000    | ~245 MB     | at the switch trigger (400 MB) within two months |
| 5,000,000    | ~1.2 GB     | needs Pro, or shorter retention                  |

Free keeps 90 days of raw events, so a project's steady state is roughly three months
of its monthly volume. Summaries are kept forever and are negligible — one row per
project per day.

---

## Ingest throughput

`pnpm load --key sk_… --seconds 30 --budget 2000`

**200 events/second sustained for one project** — about **17.3 million events a day**.
That is the project's token-bucket refill rate (`DEFAULT_RATE_LIMIT_PER_SECOND` in
`packages/catalog/src/limits.ts`), and it is the number to plan with.

A peak of **391 events/second** was measured at concurrency 2, p95 540ms for a
100-event batch. **That peak is not a rate.** The bucket holds a 2,000-token burst
reservoir and refills at 200/s, so it can absorb 10 seconds of silence and spend it
all at once. The levels in that run were 4 seconds long, so the figure includes the
reservoir draining — which is also why the next level up saw 568 of 581 requests
refused: the reservoir was already spent.

| Level | Spent | Bucket after | 429s |
| ----- | ----- | ------------ | ---- |
| 1     | 1,400 | ~600         | 0    |
| 2     | 1,700 | empty        | 0    |
| 4     | 1,300 | empty        | 568  |

The first report called 391/s "sustained" and extrapolated 33.8M events/day from it,
which was out by 2x. **Zero 429s on a level does not mean the limiter was not the
constraint** — a short level is refused nothing and the level after it pays. `pnpm load`
now reports peak and sustained separately, derives the day figure from the sustained
one, and refuses to call anything steady state unless the levels ran at least three
times the reservoir window.

**The pipeline's own ceiling is still unmeasured.** The rate limiter stops the ramp
first, which is correct behaviour for one founder's traffic and useless for sizing the
system. What concurrency 1 does tell us: p50 282ms for a 100-event batch, so one
connection moves ~355 events/second **when tokens are available**. Finding the real
pipeline ceiling needs the per-project limit raised, or several projects' keys driven
in parallel. That is a named later exercise, not a measurement we have.

A batch costs about **38 SQL statements across 5 transactions**, so ingest is
round-trip bound rather than CPU bound. The practical consequence: latency between
the app and the database multiplies almost linearly, which is the single biggest
deployment decision. Keep them in the same region.

`docs/load-test.json` holds the full ladder from the last run.

---

## What this costs to run

Monthly, for a product with a few hundred founders and a million events a month.
These are list prices looked at on 29 October 2026 and they move; the point is the
shape, which is that **the database is the only line that scales with usage**.

| Line                            | Plan                                     | Cost    |
| ------------------------------- | ---------------------------------------- | ------- |
| Vercel                          | Pro                                      | $20     |
| Supabase                        | Pro (backups, 8 GB)                      | $25     |
| Resend                          | 3,000 emails/month free, then paid       | $0–20   |
| Anthropic (mapping suggestions) | per call, Haiku                          | pennies |
| Shadow copy                     | a small VM, or a second Supabase project | $5–25   |

The AI line is small by design: a mapping suggestion runs once per unmapped event
name per project, not per event, and the prompt is capped at 40 names.

**Supabase Pro is the one that is not optional**, and not for the storage: Free has no
backups, and settled decision 1 gates real founder data on backups existing. The
shadow copy is the alternative to paying for it, which is why it was built.

---

## Re-running all of it

```
pnpm sdk:build
```

```
pnpm test -- storage-budget
```

```
pnpm load --key "$(your secret key)" --seconds 5 --budget 2000
```
