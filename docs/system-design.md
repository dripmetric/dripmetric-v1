# System design, taught through this product

A tutorial. It uses Dripmetric's Observe layer as the worked example, because a real
system is a better teacher than a clean one — the numbers are measured, the mistakes
are the ones actually made, and every claim points at a file you can open.

Read it in order the first time. After that, §8 (the scaling ladder) is the part you
will come back to.

**Contents**

1. [What kind of system this is](#1-what-kind-of-system-this-is)
2. [The one split that organises everything](#2-the-one-split-that-organises-everything)
3. [Six decisions, and the rule each one teaches](#3-six-decisions-and-the-rule-each-one-teaches)
4. [The architecture as built](#4-the-architecture-as-built)
5. [Writes: the ingest hot path, statement by statement](#5-writes-the-ingest-hot-path-statement-by-statement)
6. [Reads: why the dashboard does not touch raw events](#6-reads-why-the-dashboard-does-not-touch-raw-events)
7. [Scheduling: one cron for every timezone](#7-scheduling-one-cron-for-every-timezone)
8. [The scaling ladder](#8-the-scaling-ladder)
9. [The instrument panel](#9-the-instrument-panel)
10. [Traps this build actually fell into](#10-traps-this-build-actually-fell-into)

---

## 1. What kind of system this is

Before choosing any technology, name the shape of the problem. Three properties
decide almost every later question.

**It is write-heavy and read-light.** A founder's product sends an event per user
action, all day. The founder looks at the dashboard maybe twice a week. Writes
outnumber reads by something like 10,000:1. That single ratio rules out the obvious
instinct — "store it and query it later" — because the query cost is irrelevant and
the storage cost is everything.

**The writes are immutable facts, and the reads are questions about aggregates.**
Nobody ever asks "what is event 4,812,993?". They ask "what share of signups reached
activation last week, and how does that compare to the week before?". Immutable facts
plus aggregate questions is the definition of a case where you should _compute the
answers ahead of time_ and keep the facts only as the audit trail.

**The data is multi-tenant and the tenants are strangers.** Every row belongs to
exactly one project, and showing project A's row to project B is not a bug, it is an
incident. That has to be structural, not careful.

> **The general rule.** Classify the workload before choosing the stack. Write-heavy
>
> - immutable + aggregate-read is an _event system_, and event systems have a known
>   shape: a cheap append path, a derived layer computed in the background, and a read
>   path that never touches the append log. If you find yourself querying raw events to
>   render a screen, you have built an OLTP app with an event-shaped table, and it will
>   stop scaling at a size that surprises you.

---

## 2. The one split that organises everything

Every design decision in this codebase follows from a single line:

> **What must be true before I can reply 200?**

Answer it narrowly and almost everything else falls out. Here the answer is:

- the key is valid,
- the caller is within its rate limit,
- the events are stored durably and de-duplicated,
- the per-user step state is advanced.

That is all. Everything else — scores, leaks, aggregates, alerts, reports, the shadow
copy — happens _after_ the reply, driven off a queue.

```
                  ┌──────────────── the request path ────────────────┐
  SDK ──POST──▶   auth ▶ rate limit ▶ validate ▶ write ▶ advance state  ──▶ 200
                  └──────────────────────┬──────────────────────────┘
                                         │ queue follow-ups (after commit)
                  ┌──────────────────────▼──────────────────────────┐
                  │              the thinking path                   │
                  │  intent · leaks · aggregates · alerts · reports  │
                  │  recompute · retention · shadow copy · health    │
                  └─────────────────────────────────────────────────┘
```

Two properties make this worth the split:

**The request path has a latency budget; the thinking path has a deadline.** An SDK
flushing in the background does not care about 300ms versus 80ms, but it does care
about timing out. A weekly report does not care about 2 seconds versus 4 minutes. Put
work on the side of the line that matches how much time it is allowed to take, not
how important it feels.

**The thinking path may fail without anyone losing data.** If the intent scorer
crashes, the events are already stored and the score can be recomputed. If the
request path crashes, the event is gone forever. So: do the irreplaceable work
synchronously, and nothing else.

`packages/ingest/src/handler.ts` is where this line physically is. Its last section is
labelled _"Step 9: queue the heavy work, after the transaction commits"_ — and the
_after the transaction commits_ is load-bearing. Queueing inside the transaction
means a job can start before the rows it needs are visible, which is a race that
reproduces once a week and never in a test.

> **The general rule.** Draw the synchronous boundary at _durability and
> irreversibility_, not at importance. Then put the boundary somewhere a reader can
> see it — one function, one comment saying why — because the next person's instinct
> will be to add "just one more thing" to the fast path.

---

## 3. Six decisions, and the rule each one teaches

### 3.1 Make the dangerous query impossible to write

The naive multi-tenant discipline is _"always add `WHERE project_id = $1`"_. That
works until the one time it doesn't, and the failure mode is a cross-tenant leak.

Here, tenant access goes through exactly one door:

```ts
await withProject(projectId, async (db) => {
  /* every query in here is scoped */
});
```

`withProject` opens a transaction, sets a session variable, and hands back a `ScopedDb`.
There is no exported way to get a database handle without a project — the escape hatch
for worker-level work is a separate, named, deliberately awkward function:
`withoutProject('resolve-api-key', fn)`, which takes a _reason string_ so that every
unscoped query is self-documenting and greppable.

Behind that, Postgres Row-Level Security is switched on, deny-by-default, with
`FORCE ROW LEVEL SECURITY` so it applies to the application role too. That is a
_backstop_, not the mechanism. Two independent layers, and
`packages/db/src/__tests__/scoping.test.ts` exists to prove the first one cannot be
bypassed.

> **The general rule.** For any invariant that must never break, aim for _impossible
> to express_ rather than _carefully maintained_. The hierarchy, best to worst:
> the type system makes it unrepresentable → the API gives you no way to say it →
> a runtime check rejects it → a test catches it → a code review notices it →
> a comment asks nicely. Pick the highest rung you can afford. And then add a lower
> rung anyway, because the top rung has bugs too.

This decision is also what makes [stage 6](#stage-6--shard-by-project) cheap. Sharding
by tenant is a rewrite in a codebase where every function takes a connection, and a
change to one file in a codebase where every function takes a _project_.

### 3.2 Pay for bytes once

A naive event row — event name as text, user id as text, URL as text, a context blob
per event — costs about **405 bytes**. Measured, this schema costs **245 bytes**
including indexes. Three choices do the work (`packages/db/migrations/0002_events.sql`):

| Choice                                                        | Instead of                    | Saves                                                  |
| ------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------ |
| `name_id integer` into a per-project `event_names` dictionary | the name as text on every row | the string, every row                                  |
| `user_key integer` / `anon_key integer`                       | the external user id as text  | ~20 bytes, every row                                   |
| context (referrer, campaign, UA) stored once per **session**  | on every event                | the difference between ~215 and ~575                   |
| `message_hash uuid` (first 16 bytes of sha256)                | the client's text `messageId` | the varlena header and the text                        |
| `path_id` into a `paths` table                                | the URL as text               | lets URL rules run over hundreds of rows, not millions |

The dictionary trick generalises: **any column whose distinct values grow much more
slowly than the row count should be an integer pointing at a lookup table.** Event
names, paths, countries, source types. A project has maybe 80 event names and 10
million events.

The measurement is the interesting part, though:

| Part                           | Bytes/event |
| ------------------------------ | ----------- |
| heap (the row itself)          | 124.3       |
| `events_pkey`                  | 50.3        |
| `events_project_user_time_idx` | 39.3        |
| `events_project_name_time_idx` | 30.8        |
| `events_received_brin_idx`     | 0.1         |

**Half the cost is indexes.** That is the number to know before someone proposes a
fifth one — and note the BRIN index is essentially free, which is _why_ the retention
job deletes by time range rather than by id.

> **The general rule.** In a write-heavy system, the row layout _is_ the architecture;
> you will live inside it for years and it is the hardest thing to change later.
> Budget bytes per row explicitly, measure the real figure including indexes
> (`pnpm test -- storage-budget`), and treat each index as a permanent tax on every
> write, not a free read optimisation.

### 3.3 Derive the idempotency key, then let the database enforce it

Networks retry. SDKs retry. A mobile client comes back from a tunnel and flushes a
queue it already flushed. So the same event _will_ arrive twice, and "accept it twice"
means the founder's funnel numbers are wrong in a way nobody can explain.

The design: the client sends a `messageId`; the server stores
`message_hash = sha256(messageId)[0:16]` as a uuid, and the primary key is
`(project_id, message_hash)`. A replayed batch changes nothing. No lookup, no
"have I seen this?" query — the constraint _is_ the check, and it is correct under
concurrency, which an application-level check is not.

The deeper version of this appears in the leak engine. "Alert once per episode"
sounds like it needs a flag you set and clear. Instead, the episode key is _derived
from the facts of the episode_, so a unique index on it becomes the guarantee. Two
workers racing on the same episode produce the same key; one inserts, one gets a
conflict, and the outcome is correct without a lock.

> **The general rule.** Prefer an idempotency key you can _compute from the data_ over
> one you have to _remember_. Computed keys survive restarts, retries, concurrency and
> replays; remembered state has to be kept correct by code that runs exactly once,
> which is the thing distributed systems are worst at. Then put the key in a unique
> index and let the database be the referee.

This is also what makes [stage 3](#stage-3--separate-accepting-from-processing) safe.
Moving to an at-least-once queue is terrifying in a system without idempotent writes
and routine in one with them.

### 3.4 Time is a parameter

Every function in `packages/engine` takes `now` as an argument. There are no clock
reads inside the engine, and an ESLint rule fails the build on `Date.now()` or
`new Date()` there — plus a check for clock reads in SQL (`now()`) in the directories
where that would hide one.

This is not purity for its own sake. It buys three concrete things:

- **Testability without mocks.** "What does this look like at 09:00 on a Monday in
  Auckland?" is a function call, not a fake timer.
- **Determinism.** The simulator can replay six weeks of history and get the same
  answer every time, which is what lets it score the engine against known truth.
- **Reprocessing.** `recompute` can re-derive last Tuesday's state _as of_ last
  Tuesday. A hidden clock read makes historical recomputation silently wrong.

> **The general rule.** Hidden inputs are the enemy of a system you can reason about,
> and the clock is the most common one — followed by the random seed, the environment
> variable read deep in a call stack, and the current user. Pass them in. If you want
> to know whether a codebase is testable, grep it for clock reads; the count is a
> remarkably good proxy.

### 3.5 Derived state is rebuildable

Step state, intent scores, leaks, aggregates and summaries are all _derived_. The rule
is that they must be reproducible from raw events plus settings, by an idempotent
`recompute` job (`packages/ingest/src/recompute.ts`).

What this is really buying is **the right to be wrong**. The intent scoring model
changes; the funnel definition changes; a leak rule had an off-by-one. In a system
where derived state is the only state, each of those is a data migration and a
support conversation. Here it is a job run.

It also makes a whole class of bug survivable. If the sweep that computes leaks has a
defect for a week, the leaks are wrong for a week and then correct forever, because
the facts were never damaged.

The cost is honest and worth stating: you store the facts _and_ the conclusions, you
write the recompute path and keep it working, and you accept that derived state is
eventually consistent with the events. In exchange, **nothing derived is precious.**

> **The general rule.** Separate _facts_ from _conclusions_. Facts are append-only,
> never edited, and are the only thing you must not lose. Conclusions are a cache with
> a rebuild button. When you cannot tell which a table is, you have a problem — that
> is the table you will be afraid to touch.

### 3.6 Encode the rule in the code, not in your memory

A rule from the brief becomes a named constant with a comment naming its source:

```ts
const SWEEP_INTERVAL_SECONDS = 5 * 60; // brief section 8.3: sweeps every 5 minutes
const MIN_USERS_PER_WINDOW = 100; // brief section 9.1
const STARTER_PRICE_MINOR = 2_499;
```

Mundane, and the highest-leverage habit in this repo. Six months later nobody
remembers whether 100 was a considered threshold or a number somebody typed. The
comment is the difference between a constant you can change and a constant you are
afraid of.

> **The general rule.** Every magic number is a decision someone made with context
> you will not have. Write the context next to it. The same applies to the inverse —
> when a comment explains _what_ the code does, delete it; when it explains _why this
> number_, it is the most valuable line in the file.

---

## 4. The architecture as built

```
 ┌─────────────┐   ┌─────────────┐   ┌──────────────────────┐
 │  browser    │   │  server     │   │ Segment/Rudderstack/ │
 │  dripmetric │   │  dripmetric │   │ PostHog webhooks     │
 │  /browser   │   │  /server    │   │ (M12 adapters)       │
 └──────┬──────┘   └──────┬──────┘   └──────────┬───────────┘
        │  5,018 B gz     │                     │ signature-verified,
        │  beacon,        │                     │ deny-by-default
        │  text/plain     │                     │ field allow-list
        └────────┬────────┴─────────────────────┘
                 ▼
   ┌──────────────────────────────────────────────┐
   │  apps/web  ·  POST /v1/batch                 │   Next.js route handler —
   │  a thin adapter: no logic lives here         │   a transport shim only
   └───────────────────────┬──────────────────────┘
                           ▼
   ┌──────────────────────────────────────────────┐
   │  packages/ingest  ·  handleBatch()           │   framework-agnostic.
   │  auth → rate limit → validate → write        │   MUST NOT import next/*
   └───────┬──────────────────────────┬───────────┘
           │                          │ follow-ups, after commit
           ▼                          ▼
   ┌───────────────┐        ┌────────────────────────────┐
   │ packages/db   │        │ pg-boss queue (same PG)    │
   │ withProject() │◀───────│ apps/worker                │
   │ + RLS backstop│        │ 20 queues, 11 cron sweeps  │
   └───────┬───────┘        └─────────────┬──────────────┘
           │                              │
           ▼                              ▼
   ┌───────────────┐        ┌────────────────────────────┐
   │   Postgres    │        │ packages/engine            │
   │  48 tables    │        │ pure functions, take `now`,│
   │  245 B/event  │        │ no I/O, no clock, no db    │
   └───────────────┘        └────────────────────────────┘
```

**The package boundaries are enforced, not aspirational.** `packages/ingest` may not
import `next/*`, so the pipeline can run in a Lambda, a test, or the simulator without
a web framework. `packages/engine` may not import `db` or read a clock, so it is
testable as arithmetic. `ingest` is the _only_ package allowed to touch both `db` and
`engine` — it is the composition layer, and naming one place where the wiring lives
stops wiring from spreading everywhere.

> **The general rule.** A dependency rule that is written down is a suggestion; one
> that fails the build is a boundary. If your architecture diagram has arrows that
> the code does not enforce, the diagram is describing last year's codebase.

The layer that most often gets this wrong in real projects is the HTTP route. Here
`apps/web/src/app/v1/batch/route.ts` is deliberately thin: read the body as text,
hand it to `handleBatch`, map the result to a `Response`. Business logic in a route
handler is business logic you cannot test without the framework, cannot reuse from a
queue consumer, and cannot move to the edge.

---

## 5. Writes: the ingest hot path, statement by statement

The measured cost of one batch: **about 38 SQL statements across 5 transactions**. So
ingest is **round-trip bound, not CPU bound** — which is the single most useful fact
about it, and it determines where every future optimisation has to go.

What the five transactions are:

| #   | Transaction                                               | Why it is separate                                                                     |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | resolve the API key                                       | unscoped — we do not know the project yet                                              |
| 2   | consume rate-limit tokens                                 | must commit even if the batch is later rejected, or a hostile caller gets free retries |
| 3   | read project settings + entitlements                      | scoped; could be merged into 4, and [stage 2](#stage-2--collapse-the-round-trips) does |
| 4   | **the write** — per-message prepare, then batched inserts | the only one that must be atomic                                                       |
| 5   | `touch` the key's `last_used_at`                          | cosmetic; a candidate for deletion under load                                          |

Inside transaction 4 there are two phases, and the split matters:

**Phase one, per message:** resolve the event name to a `name_id`, the user to a
`user_key`, the path to a `path_id`, attach the session. Every lookup is **cached for
the batch**, so 1,000 events from 100 people cost 100 user lookups rather than 1,000.
That per-batch cache is the difference between linear and quadratic behaviour on the
thing that actually varies.

**Phase two, batched:** one multi-row `INSERT` each for the events, the step state,
the tracked-user rows and the daily counters. Four statements regardless of batch
size.

A few details that are easy to get wrong and are worth copying:

- **The body is read as text and parsed by hand.** Browser beacons send
  `text/plain` to avoid a CORS preflight, so `Content-Type` cannot be trusted. Any
  framework convenience that parses JSON based on the header is a bug here.
- **Size limits are checked before parsing** — 500 KB, 1,000 messages. Parsing a
  50 MB body to discover it is too big is a denial-of-service you built yourself.
- **Authentication comes before the empty-batch shortcut**, so an unauthenticated
  request gets 401 whatever it carries. Otherwise the endpoint confirms to someone
  holding no key that their request was well formed, which is a free oracle.
- **The IP is never stored.** Country is derived from the platform's header
  (`x-vercel-ip-country`, `cf-ipcountry`) and the IP is dropped. Not collecting is the
  only data protection that cannot fail.
- **The reply is indexed by batch position**, so results come back in arrival order
  even for a message so malformed it has no id to sort by.

### The two serialization points

Worth knowing before they bite, because both are single rows that every batch touches:

**The rate-limit bucket.** `rate_buckets` is one row per API key, and
`consumeTokens` does an `INSERT … ON CONFLICT DO UPDATE` that locks it. Postgres is
the obviously-wrong-and-currently-right choice: it is already there, it survives a
restart, and at this volume two small statements cost less than running Redis. It is
in its own short transaction, so the lock is held briefly — but it _is_ a point where
concurrent batches for one key queue up behind each other.

**`api_keys.last_used_at`.** Transaction 5 updates one row per batch. This is the
classic hot-row counter, and it is the first thing to go when a single key gets busy:
make it a sampled write (1 in 100), or move it to the thinking path, or drop it.

> **The general rule.** In any write path, find the rows that _every_ write touches.
> They are your real concurrency limit, and they are usually something incidental — a
> counter, a `last_seen` timestamp, a sequence — rather than the data you were
> thinking about.

---

## 6. Reads: why the dashboard does not touch raw events

The dashboard has eight modules and renders from **pre-aggregated tables**, not from
`events`:

| Table                | Grain                          | Written by                            |
| -------------------- | ------------------------------ | ------------------------------------- |
| `step_hourly`        | project × step × hour          | hourly sweep                          |
| `step_daily`         | project × step × day           | nightly sweep                         |
| `step_segment_daily` | project × step × segment × day | nightly sweep                         |
| `daily_summaries`    | project × day                  | nightly, **before** retention deletes |
| `daily_event_counts` | project × event name × day     | written at ingest                     |
| `user_step_state`    | project × user                 | ingest, in the write transaction      |
| `leak_instances`     | project × leak × episode       | 5-minute sweep                        |
| `intent_state`       | project × user                 | queued per person after ingest        |

This is the write-heavy/read-light ratio cashed in. A funnel chart is a query over a
few hundred rows. The same chart computed from raw events is a scan over millions,
every time anyone opens a laptop.

Two consequences that are easy to miss:

**Summaries are computed before retention deletes.** The nightly job does summaries
_first_, then the batched deletes. Get that order wrong and the first night retention
runs, you silently lose the history you were keeping summaries for. The ordering is
the whole reason the two live in one job rather than two.

**`user_step_state` is order-insensitive by construction.** It keeps the _earliest_
entered and _earliest_ completed time for each step, so a late or out-of-order event
can never corrupt it. This is a deliberate choice of a commutative update over a
sequential one: `LEAST(existing, incoming)` does not care what order it sees things.

> **The general rule.** When you can choose the shape of an update, choose one that is
> commutative and idempotent — `LEAST`, `GREATEST`, `max`, set union, counter
> increment. Then event order stops being a correctness requirement, and you have
> deleted an entire category of bug that is otherwise very hard to test for.

---

## 7. Scheduling: one cron for every timezone

The worker runs 20 queues on 11 cron schedules (`apps/worker/src/queue.ts`,
`apps/worker/src/main.ts`):

```
recompute-sweep            * * * * *        every minute
leak-sweep-fan-out         */5 * * * *      every 5 minutes
alert-fan-out              2-59/5 * * * *   every 5 minutes, offset by 2
funnel-sweep               7 * * * *        hourly
report-fan-out             19 * * * *       hourly
collapse-fan-out           23 * * * *       hourly
tracking-health-fan-out    41 * * * *       hourly
daily-summaries-sweep      11 2 * * *       nightly
retention-fan-out          17 3 * * *       nightly
unclaimed-sweep            43 3 * * *       nightly
reconcile-shadow           23 4 * * *       nightly
```

Three patterns in that table, all of which generalise.

### 7.1 Fan-out, not one big job

Every sweep is a pair: a `*-fan-out` job that asks "which projects need this?" and
enqueues one job per project, and a `*-for-one-project` job that does the work. The
reason is **failure isolation**: one project with pathological data fails its own job
and retries, instead of taking down the sweep for everyone. The alternative — a single
job looping over tenants — means every tenant shares one failure domain and one retry.

Queue policies back this up. `recompute` and `recompute-intent` are declared `short`:
_one pending job per key at a time_, because ingest queues a follow-up per person per
batch, and a busy person would otherwise pile up a hundred recomputes that all read
the same facts and reach the same score. Deduplicating at the _queue_ rather than in
the consumer is cheaper and cannot be forgotten.

### 7.2 Offsets, not round numbers

Look at the minutes: 7, 11, 17, 19, 23, 41, 43. All prime, none on the hour, none at
midnight. Two reasons:

- **Thundering herd.** Everybody's nightly job runs at midnight, which is when the
  database is busiest and the platform slowest.
- **Deliberate ordering.** `alert-fan-out` runs at `2-59/5` — two minutes after the
  leak sweep at `*/5` — so a leak found at 10:00 is alertable at 10:02 rather than
  waiting for the next cycle. The offset _is_ the dependency, expressed in the only
  language cron has.

### 7.3 "Monday 08:00 in the founder's timezone" cannot be one cron

This is the pattern worth stealing. The requirement is a weekly report at Monday
morning _local_ time, for founders in any timezone. There is no cron expression for
that.

The solution: run the fan-out **hourly**, have it ask each project _"is it Monday
08:00 there yet?"_, and make the answer idempotent with a unique index on
`report_runs` keyed by the founder's own local date. Twenty-four chances a day to be
right once.

Two generalisations fall out:

- **Convert "do X at local time T" into "check hourly whether it is T there, and
  dedupe".** The index is what makes a check that runs 24× produce one report.
- **Quiet hours need the same care.** `packages/engine/src/alerts/quiet-hours.ts`
  steps forward hour by hour to find the next morning rather than adding 24 hours,
  because a DST night is 23 or 25 hours long. Timezone arithmetic by addition is
  wrong twice a year, in a way that reaches customers.

> **The general rule.** Anything involving local time is a _per-tenant_ question, and
> a scheduler only knows UTC. Make the schedule frequent and dumb, make the decision
> per tenant, and make the action idempotent. The unique index is doing the real work.

---

## 8. The scaling ladder

The question this section answers: _as customers arrive, what breaks, in what order,
and what do you do about each one?_

Two rules before the stages.

**Climb one rung at a time, and only when a measurement says to.** Every stage below
costs complexity that you pay for forever, and a stage climbed early is strictly
worse than not climbing it — you get the operational burden with none of the relief.
Stage 3 in particular (a durable log in front of ingest) is the one everyone wants to
build on day one, and it is the wrong answer for a product with eleven customers.

**Know what you are rate-limited by, which is probably not what you think.** The
measured per-project ceiling is **200 events/second sustained** — and that is a
_policy_, the token bucket's refill rate, not a capacity. The pipeline's own ceiling
is still unmeasured, because the limiter stops the ramp first. The one honest pipeline
number is from concurrency 1: **p50 282ms for a 100-event batch**, so roughly
**355 events/second per connection** while tokens last. See
[§10.1](#101-a-rate-limiter-makes-every-short-load-test-optimistic) for how that number
was nearly a factor of two wrong.

### Where you are now

| Dimension                           | Current                   | Comfortable to                                      |
| ----------------------------------- | ------------------------- | --------------------------------------------------- |
| Events per project per month        | —                         | ~1M on Supabase Free, ~10M on Pro                   |
| Sustained events/second per project | 200 (policy)              | raise the bucket; the pipeline is untested above it |
| Storage                             | 245 B/event incl. indexes | 500 MB Free ≈ 2M events; 8 GB Pro ≈ 32M             |
| Raw retention                       | 90 days on Free           | summaries are forever and negligible                |
| Projects                            | a few hundred             | several thousand before the worker is the issue     |

Supabase Free's 500 MB with 90-day retention means a project doing **1M events/month**
is at the 400 MB switch trigger within two months. That is the first wall most
products hit, and it is a billing question, not an engineering one.

---

### Stage 1 — Co-locate, then pool

**Trigger.** p95 on `/v1/batch` above ~500ms with no 429s. Or, simply: the app and the
database are in different regions.

**What breaks.** Nothing breaks; everything is just slow. 38 statements × round-trip
time is the whole latency budget. At 5ms RTT that is 190ms of pure waiting; at 60ms —
an app in Virginia, a database in Frankfurt — it is **2.3 seconds**, and the SDK starts
timing out.

**The change.**

1. Put the app and the database in the same region. This is the single highest-leverage
   deployment decision in the product and it costs nothing.
2. Put a transaction-mode pooler in front (Supavisor, PgBouncer). Serverless functions
   open a connection per invocation; Postgres allocates ~10 MB of backend per
   connection and falls over somewhere around a few hundred.

**Cost.** Configuration only. **Readiness: done** — the code holds no connection
across a request, and `withProject` is a transaction, which is what transaction-mode
pooling requires. (If you adopt a pooler, note that session-level features — `SET`
outside a transaction, prepared statements, `LISTEN` — stop working. `withProject`
sets its variable _inside_ the transaction precisely so this is safe.)

---

### Stage 2 — Collapse the round trips

**Trigger.** Latency divided by statement count is approximately your RTT. That means
you are paying for conversation, not work. Concretely: batch latency barely changes
when you halve the batch size.

**What breaks.** Nothing — this is pure headroom. 38 statements → under 10 is a
~4× latency improvement for free.

**The change, in order of return:**

1. **Merge transactions 3 and 4.** Project settings and entitlements can be read in
   the same transaction as the write.
2. **Cache the dictionaries in process.** `event_names` and `paths` per project are
   small, slow-changing and already cached per batch — promote that to a process-level
   cache with a short TTL and a version bump on mapping change. This is the biggest
   single win: it removes most of phase one.
3. **Fold phase one into one round trip.** Pass arrays and resolve name/user/path/
   session in a single statement with CTEs and `UNNEST` instead of a lookup per
   distinct value.
4. **Delete transaction 5**, or sample it. `last_used_at` is not worth a round trip or
   a row lock on every batch.

**Cost.** Real work in `packages/ingest/src/pipeline/`, and a process cache is a new
invalidation problem — which is why it needs the version bump, not a bare TTL.
**Readiness: good.** The per-batch cache already exists and is the right shape; this
widens its scope.

---

### Stage 3 — Separate accepting from processing

**Trigger.** Either (a) stage 2 is exhausted and the request path is still too slow,
or (b) you need to survive a database failover without dropping events, or (c) one
customer's traffic spike is hurting everyone else.

This is the big architectural rung. Be sure before you climb it.

**What breaks without it.** The request path's availability is exactly the database's
availability. A 30-second failover is 30 seconds of lost events, forever, with no
record that they existed.

**The change.** The request does **one** durable write and returns:

```
POST /v1/batch
  ├─ validate shape only (no I/O)          ~1ms
  ├─ rate-limit                             1 statement
  ├─ append the raw batch to a log          1 statement
  └─ 200 Accepted
                 │
                 ▼
     a consumer runs the existing pipeline, at its own pace
```

The log can be, in increasing order of commitment:

- **An append-only Postgres table** (`event_intake`: project_id, received_at, body).
  One insert, no parsing, no joins. Keeps the stack as it is; still dies with the
  database, but turns 38 statements into 2. Often enough.
- **A managed queue** — SQS, Cloud Tasks, Upstash. Cheap, operationally trivial, no
  ordering guarantee, and you get retries and a dead-letter queue for free.
- **A log** — Kafka, Redpanda, Kinesis. Ordered per partition (partition by
  `project_id`), replayable, and the right answer when you want to add a second
  consumer later. Also the heaviest thing on this list to run.

**What you give up, and this is the part that is usually skipped:** the API can no
longer return per-message results. Today the response says, per message, `ok` or
`duplicate` or `invalid_*`. After this change it can only say "accepted". That is an
**API contract change**, so it needs either a version, or a split — validate _shape_
synchronously (cheap, no I/O, catches the founder's typo during setup, which is the
case that actually matters) and process _semantics_ asynchronously.

**Cost.** A consumer to operate, a new failure mode (the queue backs up and the
dashboard goes stale — so you need lag monitoring), and at-least-once delivery.
**Readiness: high, because of [§3.3](#33-derive-the-idempotency-key-then-let-the-database-enforce-it).**
At-least-once delivery is only safe with idempotent writes, and the dedupe key is
already derived from the message, not remembered. This is what that decision was for.

---

### Stage 4 — Partition `events` by time

**Trigger.** Any of: the nightly retention delete no longer finishes inside its
window; autovacuum is permanently behind on `events`; table bloat after deletes is
material; `events` is past roughly 100M rows.

**What breaks.** Retention is `DELETE` by time range, batched 24 hours at a time with
a 40-batch cap. `DELETE` writes a dead tuple for every row removed, which autovacuum
then has to reclaim. At scale the job stops keeping up, the table grows despite the
deletes, and every scan gets slower.

**The change.** `PARTITION BY RANGE (received_at)`, monthly. Then:

- retention becomes `DROP TABLE events_2026_07` — **instant, no dead tuples, no vacuum**
- the BRIN index is replaced by partition pruning, which is strictly better
- old partitions can go to cheaper storage

**The wrinkle, stated honestly:** Postgres requires the partition key to be part of
every unique constraint. The primary key is `(project_id, message_hash)` and the
partition key would be `received_at`, so the PK has to become
`(project_id, message_hash, received_at)` — which **weakens dedupe to "once per
partition"**, since the same `messageId` arriving in July and August would be two
rows. Options: accept it (a replay 30 days later is not a real scenario), or keep a
separate narrow dedupe table partitioned the same way, or partition by a hash of
`project_id` instead of by time and lose `DROP PARTITION` for retention. There is no
free version; pick deliberately and write down which.

**Cost.** A migration on the largest table, and partition maintenance
(`pg_partman` or a cron job that creates next month's). **Readiness: partial.** The
retention job already deletes by time range so its logic survives, but the PK question
above is a real decision, not a mechanical change.

---

### Stage 5 — Split the read path

**Trigger.** Dashboard p95 above ~1s despite indexes, _and_ the slow queries are
aggregates over `events` rather than over summary tables.

**Be suspicious of this trigger.** [§6](#6-reads-why-the-dashboard-does-not-touch-raw-events)
means the dashboard already reads pre-aggregated tables. If an aggregate is slow, the
first question is "why is this not pre-computed?" — adding a column to
`step_daily` is a day's work and adding ClickHouse is a quarter's. This stage is much
further away than it looks, and that is by design.

**When it is genuinely right:** the product starts offering _ad-hoc_ analysis —
arbitrary breakdowns, custom date ranges, funnels the founder defines on the fly. You
cannot pre-aggregate questions you do not know yet, and that is exactly the workload
a columnar store exists for.

**The change.** Postgres stays the source of truth for identity, config, state and
anything transactional. Events additionally stream to ClickHouse (or DuckDB over
Parquet in object storage, which is much cheaper and perfectly good for a read-only
analytical copy). Aggregate reads move there.

**Cost.** Two stores to keep consistent, which is the real price — plus a second
schema to migrate whenever the event shape changes. **Readiness: good as a bolt-on**,
because stage 3's log gives you a second consumer for free. Do not do this without
stage 3.

---

### Stage 6 — Shard by project

**Trigger.** A single primary is write-saturated and vertical scaling is exhausted. Or
a commercial reason: an enterprise customer requires physical isolation or a specific
region.

**What breaks.** One database's write capacity. Note this comes _after_ stages 1–4,
which between them are worth something like 10–20×; most products never get here.

**The change.** `project_id` is in every key and every query goes through
`withProject`, so the routing decision has exactly one home: the pool lookup in
`packages/db/src/pool.ts` resolves a project to a shard before opening the
transaction. Business logic does not change at all — no query in the codebase can
accidentally span two tenants, because none of them can span two tenants _today_.

Keep one small global database for the things that are not per-project: accounts,
founder users, sessions, the project → shard map.

**Cost.** Shard rebalancing, cross-shard reporting for your own internal metrics, and
schema migrations that now run N times. **Readiness: structurally excellent** — this
is [§3.1](#31-make-the-dangerous-query-impossible-to-write)'s dividend. The tenancy
discipline that looked like bureaucracy at M1 is what makes a terrifying migration
into a routing change.

---

### Stage 7 — Regional ingest

**Trigger.** Founders with users on another continent, and SDK latency or data
residency becomes a sales objection.

**The change.** Accept events at a regional edge into a regional log, replicate
asynchronously to the project's home region for processing. The dashboard stays in
one region. The reason this works is that ingest is _write-only and tolerant of
delay_, which is the rare property that makes geographic distribution tractable.

**Cost.** Cross-region replication, cost and lag. **Readiness: needs stage 3.**

---

### The ladder on one page

| Stage                    | Trigger (measured)          | First thing that breaks          | Gain                   | Ready?               |
| ------------------------ | --------------------------- | -------------------------------- | ---------------------- | -------------------- |
| 1 · Co-locate + pool     | p95 > 500ms, no 429s        | latency = 38 × RTT               | 3–10×                  | ✅ done              |
| 2 · Collapse round trips | latency/statement ≈ RTT     | nothing; pure headroom           | ~4×                    | ✅ good              |
| 3 · Accept ≠ process     | DB failover loses events    | request-path availability        | availability, spikes   | ✅ dedupe is derived |
| 4 · Partition by time    | retention misses its window | autovacuum, then bloat           | retention becomes free | ⚠️ PK decision       |
| 5 · Split read path      | ad-hoc analysis arrives     | aggregates you cannot precompute | read scale             | ⚠️ needs 3           |
| 6 · Shard by project     | one primary saturated       | write capacity                   | linear                 | ✅ `withProject`     |
| 7 · Regional ingest      | another continent           | edge latency                     | locality               | ⚠️ needs 3           |

**The order is not arbitrary.** 1 and 2 are configuration and refactoring with no new
moving parts, and together they are worth more than most teams expect — which is why
they come first. 3 is the hinge: it is the first stage that changes the API contract
and adds a component to operate, and stages 5 and 7 depend on it. 4 is independent and
can be done whenever its trigger fires. 6 is last because the stages before it are
cheaper per unit of relief.

> **The general rule.** Write the ladder down _before_ you need it, with the trigger
> for each rung expressed as a number you actually collect. Then scaling stops being a
> panic and becomes a checklist — and, just as valuably, you can tell when someone is
> proposing a rung you have not earned yet.

---

## 9. The instrument panel

A ladder is useless without the numbers that tell you which rung you are on. These are
the ones worth collecting, and nothing else — a dashboard with forty graphs is a
dashboard nobody reads.

**Four that tell you about right now:**

| Metric                         | Why                                                                 | Act at                                            |
| ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------- |
| p95 on `POST /v1/batch`        | the only latency a customer's SDK feels                             | > 500ms → stage 1, then 2                         |
| 429 share per project          | distinguishes "we are slow" from "they are over quota"              | > 1% sustained → raise the bucket or talk to them |
| queue depth and oldest job age | the thinking path falling behind; the dashboard goes stale silently | oldest > 15 min                                   |
| failed jobs by queue           | one project with pathological data                                  | any sustained non-zero                            |

**Three that tell you about next quarter:**

| Metric                           | Why                                                        |
| -------------------------------- | ---------------------------------------------------------- |
| bytes/event, recomputed monthly  | the storage forecast, and it drifts when columns are added |
| events/month per project, top 10 | who hits a wall first, and who to talk to about a plan     |
| statements per batch             | the stage-2 trigger; rises silently as features are added  |

The last one is the sleeper. Nobody notices a feature adding one query to the hot
path, and six features later ingest is twice as slow with no single commit to blame.
Assert it in a test, the way the SDK's size budget is asserted at 5,120 bytes and
fails CI at 5,018.

> **The general rule.** For every architectural property you care about, put a number
> on it and fail the build when it regresses. A property defended only by intention
> degrades at exactly the rate people join the team.

---

## 10. Traps this build actually fell into

The most useful part of a design document is the list of things that were wrong. These
all happened here.

### 10.1 A rate limiter makes every short load test optimistic

The M13 report said **391 events/second sustained**, about **33.8M events a day**.
Both numbers were wrong, and the day figure was out by 2×.

A project's token bucket holds **2,000 tokens** and refills at **200/s**, so it stores
**10 seconds** of silence and can spend it all at once. The load test ran **4-second
levels**. The number it printed was the reservoir draining.

The script already refused to trust a level that was mostly 429s — a defect it had
caught once before. But levels 1 and 2 saw **zero** 429s, because the reservoir was
paying the bill. The guard asked _"was I refused?"_ when the question was _"was I
refused yet?"_ The bucket emptied during level 2, and level 3 took the whole invoice:
568 of 581 requests refused, which read like a cliff in the system and was really a
bill arriving.

**The generalisation:** if your measurement window is shorter than
`burst ÷ refill_rate`, you are measuring the reservoir, not the rate. Everything
bucket-shaped has this property — API quotas, cloud CPU credits, disk burst credits,
network burst allowances. And idle time before the test makes it worse, because the
reservoir is full. Fixed in `scripts/load-test.mjs`, which now reports peak and
sustained separately and will not call anything steady state unless the levels ran at
least 3× the reservoir window.

### 10.2 A check that cannot fail is worse than no check

`reconcile()` compared the shadow copy against the primary and reported CLEAN against
_any_ shadow, including an empty one. It counted the primary through the request pool
— the non-owner role, under `FORCE ROW LEVEL SECURITY`, with no project set — so it
counted **zero, every time**, and compared 0 against 0.

It was invisible until the test ran against a database with rows in it, because an
empty primary and an empty shadow genuinely do match. And the consequence was worse
than a missing feature: it would have invited a restore that lost everything while
looking like it had verified the backup.

**The generalisation:** for every check, write the test that makes it **fail**. A
passing test proves the happy path; only a failing-on-purpose test proves the check
is wired up. This applies hardest to things that are _supposed_ to be quiet —
backups, alerts, health checks, reconciliation. Silence is indistinguishable from
broken unless you have deliberately broken it once.

### 10.3 Security headers are a feature, and features need tests

A Content-Security-Policy of `script-src 'self'` blocked Next's own inline bootstrap.
Hydration never ran. **Five of the eight dashboard modules were invisible to every
user** — and every test passed, because the tests exercised the components, not the
page.

What found it was `pnpm screens`, which screenshots every module and scans the HTML
for leaked identity. It was built for masking and caught a rendering failure instead.

**The generalisation:** a change that is invisible to your test suite will be visible
to your users. CSP, CORS, cache headers, cookie flags and redirects all share this
shape — they are configuration that silently changes behaviour, and the only test
that catches them is one that drives the real thing end to end. One such test is worth
a hundred unit tests for this class of bug.

### 10.4 Prove the command by running the command

`pnpm licenses` never ran the licence check — `licenses` is a pnpm built-in, and it
shadowed the script. The check had been "passing" by not existing.

Now every script name has a colon (`check:licenses`, `check:names`) so a built-in
cannot shadow it, and `pnpm check:names` fails the build if anyone adds one that
could.

**The generalisation:** verify the thing you will actually run, not its parts. "I ran
the steps inside `verify`" is not the same as "I ran `verify`", and the gap between
them is where this class of bug lives. Related: the root `build` script filtered to
`./packages/**`, so `next build` never ran in CI and the failure only appeared once a
job depended on the app being built. Locally it passed, on a stale `.next` directory.

### 10.5 Deletion means every table, and you cannot remember them all

`deleteUser` left rows in `leak_instances` and `alerts` — a real privacy bug, because
those tables carry a `subject_key` identifying a person.

The fix that matters was not adding two deletes. It was rewriting the test to query
`information_schema` for every table with a user-identifying column and assert that
none of them still holds the deleted user. Now adding a table with a `subject_key`
and forgetting to delete from it **fails the test**.

**The generalisation:** when a requirement is "all of X", enumerate X from the
schema at test time rather than from a list in your head. Hand-maintained lists of
"all the places" are wrong the first time someone adds a place, and nothing tells you.

### 10.6 Two NULLs are distinct, and partial indexes need their predicate repeated

Two small Postgres facts that each cost an afternoon:

- A unique index does **not** prevent two rows with `NULL` in the unique column —
  `NULL` is not equal to itself. If "at most one row with no dedupe key" is the rule,
  the index will not enforce it.
- `ON CONFLICT (project_id, dedupe_key)` does not match a _partial_ unique index
  unless the statement repeats the index's `WHERE` predicate. Without it you get a
  runtime error that reads like the index does not exist.

**The generalisation:** constraints are the cheapest correctness mechanism you have
and they are worth learning properly. The time spent reading your database's docs on
unique indexes, `NULL` semantics and upsert matching is repaid the first time a
constraint catches a bug that would otherwise have been a data-integrity incident.

---

## Appendix · the shortest version

If you remember six things from this document:

1. **Classify the workload first.** Write-heavy + immutable + aggregate-read is an
   event system, and it has a known shape. Don't rediscover it.
2. **Ask what must be true before you reply 200**, and put everything else on a
   queue — after the transaction commits.
3. **Separate facts from conclusions.** Facts are append-only and precious.
   Conclusions are a cache with a rebuild button.
4. **Make the dangerous thing impossible to express**, not merely discouraged. One
   door, enforced, plus a backstop.
5. **Derive your idempotency keys** so a unique index can be the referee. It is what
   makes queues, retries and at-least-once delivery safe later.
6. **Put a number on every property you care about, and fail the build when it
   regresses** — bytes per event, statements per batch, bundle size, p95.

And one about measurement, because it cost the most here: **a number you have not
tried to break is a guess.** Write the test that makes the check fail, and ask of any
throughput figure whether the window was longer than the reservoir.
