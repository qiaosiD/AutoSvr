# Deploying AutoSvr to Vercel

The app is deploy-ready as-is. With **zero environment variables** it serves the
deterministic seeded data (90 days, `$511.77` accrued) and every page renders —
so you can get a live URL before RawTree, Nimble or Liquid are wired up.

## 1. Log in and link

```bash
npx vercel login
npx vercel link
```

`link` writes `.vercel/project.json`, which is already gitignored.

## 2. Ship a preview

```bash
npx vercel
```

This uploads the **working directory**, not your git HEAD — so uncommitted work
(`app/connect/`, `lib/plaid/`) ships too. That is what you want for a demo, and
it is the difference from the GitHub integration, which only ever builds what
has been pushed.

## 3. Promote to production

```bash
npx vercel --prod
```

## Environment variables

None are required. Add them only as each integration comes online:

```bash
npx vercel env add RAWTREE_API_KEY production
npx vercel env add RAWTREE_DATABASE production
npx vercel env add NIMBLE_API_KEY production
npx vercel env add LIQUID_API_KEY production
```

The dashboard badge flips from "Seeded demo data" to "Live data" once
`RAWTREE_API_KEY` is set and the backfill has run.

## The daily cron

`vercel.json` schedules `GET /api/cron/daily` at 14:00 UTC. It only runs a live
crawl when `NIMBLE_API_KEY` and `LIQUID_API_KEY` are both set; otherwise it
returns `{ skipped: true }` and changes nothing.

To protect it, set `CRON_SECRET`:

```bash
npx vercel env add CRON_SECRET production
```

Vercel then sends `Authorization: Bearer $CRON_SECRET` on every scheduled
invocation, which is exactly what the route checks. **Until you set it the
endpoint is publicly callable** — anyone who finds the URL can trigger a crawl
and a ledger write. Set it before the URL is public.

Hobby plans allow one cron a day; `0 14 * * *` is within that.

## Demoing the cron by hand

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-deployment>/api/cron/daily
```
