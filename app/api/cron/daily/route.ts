// The once-a-day job. Crawl -> parse -> decide -> sweep -> accrue -> record.
// Wire to Vercel Cron (see vercel.json) or hit it manually during the demo.

import { NextResponse } from 'next/server';
import { crawlAll, nimbleConfigured } from '@/lib/rates/nimble';
import { liquidConfigured, parseRates } from '@/lib/rates/parse';
import { decideSweep } from '@/lib/engine';
import { DEMO_CUSTOMER } from '@/lib/demo/seed';
import { buildAccrual } from '@/lib/engine';
import { insert, rawtreeConfigured, TABLES } from '@/lib/rawtree';
import { getDashboardData } from '@/lib/data';
import type { RateObservation } from '@/lib/types';

export const maxDuration = 60;

export async function GET(request: Request) {
  // Vercel Cron sends this header; reject anything else once the secret is set.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!nimbleConfigured() || !liquidConfigured()) {
    return NextResponse.json(
      { skipped: true, reason: 'NIMBLE_API_KEY and LIQUID_API_KEY required for a live run' },
      { status: 200 },
    );
  }

  const crawls = await crawlAll();
  const parsed = await Promise.allSettled(crawls.map(parseRates));
  const observations: RateObservation[] = parsed.flatMap((p) =>
    p.status === 'fulfilled' ? p.value : [],
  );

  if (observations.length === 0) {
    return NextResponse.json({ error: 'no rates parsed', crawled: crawls.length }, { status: 502 });
  }

  // Where the money is right now, per the ledger.
  const current = await getDashboardData(DEMO_CUSTOMER.id);
  const today = new Date().toISOString().slice(0, 10);
  const decision = decideSweep(
    current.currentBankId || null,
    current.currentApr,
    observations,
    DEMO_CUSTOMER.principalCents,
    today,
  );

  const landingBank = decision.shouldMove ? decision.targetBankId : current.currentBankId;
  const landingApr = decision.shouldMove ? decision.targetApr : current.currentApr;

  if (rawtreeConfigured()) {
    await insert(TABLES.rates, observations);
    if (decision.shouldMove) {
      await insert(TABLES.sweeps, [
        {
          occurredAt: new Date().toISOString(),
          customerId: DEMO_CUSTOMER.id,
          fromBankId: current.currentBankId || null,
          toBankId: decision.targetBankId,
          amountCents: DEMO_CUSTOMER.principalCents,
          aprAtMove: decision.targetApr,
          reason: decision.reason,
        },
      ]);
    }
    if (landingBank) {
      await insert(TABLES.accruals, [buildAccrual(DEMO_CUSTOMER, landingBank, landingApr, today)]);
    }
  }

  return NextResponse.json({
    ok: true,
    crawled: crawls.length,
    ratesParsed: observations.length,
    moved: decision.shouldMove,
    decision,
    persisted: rawtreeConfigured(),
  });
}
