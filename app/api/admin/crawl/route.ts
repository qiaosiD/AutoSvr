// Crawl a handful of bank pages on demand and stream each result as it lands.
//
// Streaming is not a nicety here. A heavy page can take forty seconds, the
// function ceiling is sixty, and waiting for the slowest page before sending
// anything means a single slow site costs you every other result. Each report
// goes out the moment it is ready, so a timeout truncates the run rather than
// erasing it.
//
// The response is NDJSON: one JSON object per line.

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

export type CrawlMessage =
  | { type: 'start'; urls: string[]; liquidConfigured: boolean }
  | { type: 'report'; report: CrawlReport }
  | { type: 'done'; completed: number };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function crawlOneUrl(url: string, waitFor?: string): Promise<CrawlReport> {
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
}

export async function POST(request: Request) {
  if (!nimbleConfigured()) return json({ error: 'NIMBLE_API_KEY is not set' }, 503);

  let body: { urls?: unknown; waitFor?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }

  const urls = Array.isArray(body.urls)
    ? body.urls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    : [];

  if (urls.length === 0) return json({ error: 'Give me at least one URL' }, 400);
  if (urls.length > MAX_URLS) return json({ error: `At most ${MAX_URLS} URLs per request` }, 400);

  const waitFor =
    typeof body.waitFor === 'string' && body.waitFor.trim() ? body.waitFor.trim() : undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (msg: CrawlMessage) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(msg) + '\n'));
        } catch {
          // The client hung up; stop trying to write to a closed stream.
          open = false;
        }
      };

      send({ type: 'start', urls, liquidConfigured: liquidConfigured() });

      let completed = 0;
      // Not Promise.all: each report is written the moment its own crawl
      // settles, rather than all of them after the slowest one.
      await Promise.all(
        urls.map(async (url) => {
          const report = await crawlOneUrl(url, waitFor);
          completed++;
          send({ type: 'report', report });
        }),
      );

      send({ type: 'done', completed });
      if (open) controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      // Without this some proxies buffer the whole response and the streaming
      // is invisible to the client.
      'x-accel-buffering': 'no',
    },
  });
}
