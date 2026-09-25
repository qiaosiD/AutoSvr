# AutoSvr

**Your savings account, always at the best rate in the country.**

Link your savings account once. Every morning AutoSvr crawls US high-yield
savings rates, and when another bank beats where your money currently sits by
enough to be worth the transfer, it moves the money. You see where your money
has been, what it earned at each bank, and the blended APY you actually got.

Built at the Long Horizon Agents Hack, September 2026.

> **Sandbox.** All balances and transfers here are simulated. Pooling customer
> deposits and sweeping them between banks requires a partner bank, an FBO
> account structure, and per-bank deposit agreements. Nothing in this repo moves
> real money.

## How it works

```
  Nimble          Liquid AI              Tinybird              Next.js
  ──────          ─────────              ────────              ───────
  crawl bank  →   parse HTML into    →   rate history,    →    dashboard
  rate pages      structured rates       ledger, accruals       + timeline
     │
     └─→ raw crawl blobs ──→ file (default) or RawTree
```

- **Nimble** — bank rate pages are JS-rendered and rate-limit hard; plain
  `fetch` returns a challenge page. Nimble gets the actual HTML.
- **Liquid AI** — an LFM call with a strict output shape survives the layout
  changes that break regex extraction, and correctly separates promotional
  rates from ongoing ones.
- **Tinybird** — everything time-shaped: rate history per bank per day, sweep
  events, daily accruals. Each dashboard panel is one published pipe.

Raw crawl payloads land in a schemaless sink before anything interprets them,
so a wrong rate on screen can be traced back to the exact bytes that produced
it. Defaults to local files; set `RAW_SINK=rawtree` to use RawTree instead.

## The number that matters

Money sits at a different bank on different days, earning a different APR each
day. The honest headline is the annualized daily-compounded chain, not the
average of those APRs:

```
APY = ( ∏ (1 + apr_d / 365) ) ^ (365 / nDays) − 1
```

Averaging overstates a rising-rate path and understates a falling one — and
since the entire product is "we move you to the best rate," the difference
lands exactly where the claim is being made. See `lib/apy.ts`.

**Sweeps are not free.** ACH settlement takes 1–3 business days and money in
flight earns nothing, so AutoSvr only moves when the new bank beats the current
one by more than 25bp (`SWEEP_THRESHOLD_APR` in `lib/engine.ts`). On the seeded
90-day history that captures 5.01% against a perfect-daily-chase ceiling of
5.05% — ~96% of the theoretical upside, without pointless transfers.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. **No API keys needed** — the app serves a
deterministic 90-day seeded history, so the dashboard is never empty. Keys
progressively light up real behavior:

| Variable | Unlocks |
|---|---|
| `TINYBIRD_TOKEN` | Live ledger instead of seeded data |
| `NIMBLE_API_KEY` | Real crawls of bank rate pages |
| `LIQUID_API_KEY` | Real rate parsing |
| `PLAID_*` | Account linking + simulated ACH |
| `RAW_SINK=rawtree` | RawTree as the raw crawl landing zone |

Copy `.env.example` to `.env.local` and fill in what you have.

## Tinybird setup

```bash
npm i -g @tinybirdco/tinybird
tb login
tb push tinybird/datasources/*.datasource tinybird/pipes/*.pipe
```

`tb push` creates an `autosvr_ingest` token from the `TOKEN ... APPEND` lines
in the datasource files — the Events API rejects writes without that scope.
Put it in `.env.local` as `TINYBIRD_TOKEN`, along with your workspace's
regional `TINYBIRD_HOST`.

Then load the seeded history so the live dashboard isn't empty:

```bash
npx tsx scripts/backfill.mts --dry-run   # inspect first
npx tsx scripts/backfill.mts             # send it
```

The datasources are MergeTree and do not deduplicate, so the script refuses to
run against a non-empty ledger — backfilling twice would double every number on
the dashboard. Truncate and re-run, or pass `--force` deliberately.

## Verify the math

```bash
npx tsx scripts/check.mts    # headline numbers + hand-computed cross-check
npx tsx scripts/audit.mts    # realized vs theoretical rate distributions
```

`audit.mts` asserts the two invariants worth trusting: realized APY must sit
below the perfect-chase ceiling, and realized mean APR must fall inside the
observed rate band.

## Daily job

`GET /api/cron/daily` runs crawl → parse → decide → sweep → accrue → record.
Wired to Vercel Cron at 14:00 UTC via `vercel.json`. Set `CRON_SECRET` to
require a bearer token once deployed.

## Layout

```
lib/apy.ts          the APY math, isolated and testable
lib/engine.ts       sweep decision + threshold
lib/banks.ts        bank universe with FDIC cert numbers
lib/rates/          nimble crawl → liquid parse → raw sink
lib/tinybird.ts     ingest + pipe queries
lib/data.ts         single read path; live or seeded, same shape
lib/demo/seed.ts    deterministic history, replayed through the real engine
tinybird/           datasource + pipe definitions
app/                dashboard and the daily cron route
```

The demo timeline is generated by running the same `decideSweep()` that would
run in production over seeded rates — so the threshold behavior on screen is
the real behavior, not a mock.
