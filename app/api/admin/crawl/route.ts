// Crawl a handful of bank pages on demand and report what came back.
//
// This is the operator's view of the pipeline: give it URLs, see exactly what
// Nimble fetched, which parser read it, and what the engine would do with the
// result. Nothing is written to the ledger — the daily cron owns that.

import { NextResponse } from 'next/server';
import { crawlUrl, nimbleConfigured } from '@/lib/rates/nimble';
import { parseRates, liquidConfigured } from '@/lib/rates/parse';
import { canParseWithSelectors } from '@/lib/rates/selectors';
import { isInsured } from '@/lib/engine';
import type { RateObservation } from '@/lib/types';

export const maxDuration = 60;

/** Crawling costs money per page, so the request cannot ask for many. */
const MAX_URLS = 5;

export interface CrawlReport {
  url: string;
  ok: boolean;
  error?: string;
  durationMs: number;
  contentChars?: number;
  format?: 'markdown' | 'html';
  rawBlobId?: string;
  parser?: 'model' | 'selectors';
  rates?: Array<Pick<RateObservation, 'bankName' | 'apy' | 'minBalanceCents' | 'insurer'> & {
    insured: boolean;
  }>;
}

export async function POST(request: Request) {
  if (!nimbleConfigured()) {
    return NextResponse.json({ error: 'NIMBLE_API_KEY is not set' }, { status: 503 });
  }

  let body: { urls?: unknown; waitFor?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  const urls = Array.isArray(body.urls)
    ? body.urls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    : [];

  if (urls.length === 0) {
    return NextResponse.json({ error: 'Give me at least one URL' }, { status: 400 });
  }
  if (urls.length > MAX_URLS) {
    return NextResponse.json(
      { error: `At most ${MAX_URLS} URLs per request` },
      { status: 400 },
    );
  }

  const waitFor = typeof body.waitFor === 'string' && body.waitFor.trim()
    ? body.waitFor.trim()
    : undefined;

  const reports = await Promise.all(
    urls.map(async (url): Promise<CrawlReport> => {
      const started = Date.now();
      try {
        const crawl = await crawlUrl(url.trim(), waitFor);
        const rates = await parseRates(crawl);

        return {
          url,
          ok: true,
          durationMs: Date.now() - started,
          contentChars: crawl.content.length,
          format: crawl.isMarkdown ? 'markdown' : 'html',
          rawBlobId: crawl.rawBlobId,
          // parseRates prefers the model and falls back; infer which ran from
          // whether this source has selectors at all.
          parser: liquidConfigured() && !canParseWithSelectors(crawl.source.id)
            ? 'model'
            : 'selectors',
          rates: rates.map((r) => ({
            bankName: r.bankName,
            apy: r.apy,
            minBalanceCents: r.minBalanceCents,
            insurer: r.insurer,
            insured: isInsured(r),
          })),
        };
      } catch (err) {
        return {
          url,
          ok: false,
          durationMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  return NextResponse.json({
    liquidConfigured: liquidConfigured(),
    reports,
  });
}
