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
  Nimble          Liquid AI              RawTree               Next.js
  ──────          ─────────              ───────               ───────
  crawl bank  →   parse HTML into    →   rate history,    →    dashboard
  rate pages      structured rates       ledger, accruals       + timeline
     │                                         ▲
     └─────────→ raw crawl blobs ──────────────┘
```

- **Nimble** — bank rate pages are JS-rendered and rate-limit hard; plain
  `fetch` returns a challenge page. Nimble gets the actual HTML.
- **Liquid AI** — an LFM call with a strict output shape survives the layout
  changes that break regex extraction, and correctly separates promotional
  rates from ongoing ones.
- **RawTree** — the ledger: rate history per bank per day, sweep events, daily
  accruals. It is ClickHouse underneath, so the compounding math runs in SQL.

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
| `RAWTREE_API_KEY` | Live ledger instead of seeded data |
| `NIMBLE_API_KEY` | Real crawls of bank rate pages |
| `LIQUID_API_KEY` | Real rate parsing |
| `PLAID_*` | Account linking + simulated ACH |
| `RAW_SINK=rawtree` | Send raw crawl blobs to RawTree too |

Copy `.env.example` to `.env.local` and fill in what you have.

## RawTree setup

Create a Read/write key in the RawTree dashboard and put it in `.env.local`:

```
RAWTREE_API_KEY=rt_...
RAWTREE_DATABASE=default
```

The database must already exist — a read/write key can insert into one but
cannot create one, and RawTree reports that as `400 Database not found`. List
the ones your key can reach:

```bash
curl -H "Authorization: Bearer $RAWTREE_API_KEY" https://api.rawtree.com/v1/databases
```

Confirm the whole setup, then load the seeded history:

```bash
npm run rawtree:check
npm run backfill -- --dry-run
npm run backfill
```

Tables are created on first insert, so there is nothing to migrate. Because
ingestion is schemaless every column arrives as ClickHouse `Dynamic`, which
most aggregates refuse to touch — `lib/queries.ts` casts every column
explicitly, and `argMax` fails without it.


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
lib/rawtree.ts      insert + query client
lib/queries.ts      the SQL behind every dashboard number
lib/data.ts         single read path; live or seeded, same shape
lib/demo/seed.ts    deterministic history, replayed through the real engine
app/                dashboard and the daily cron route
```

The demo timeline is generated by running the same `decideSweep()` that would
run in production over seeded rates — so the threshold behavior on screen is
the real behavior, not a mock.
