// Nimble does the crawling. Bank rate pages are JS-heavy and rate-limit
// aggressively, so plain fetch() gets you a challenge page instead of rates.

import { getRawSink } from './rawSink';
import { SOURCES, type RateSource } from './sources';

const NIMBLE_URL = 'https://api.webit.live/api/v1/realtime/web';

export interface CrawlResult {
  source: RateSource;
  rawBlobId: string;
  body: string;
}

async function crawlOne(source: RateSource): Promise<CrawlResult> {
  const res = await fetch(NIMBLE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Basic ${process.env.NIMBLE_API_KEY}`,
    },
    body: JSON.stringify({
      url: source.url,
      method: 'GET',
      render: true,
      parse: false,
      country: 'US',
      locale: 'en',
    }),
  });

  if (!res.ok) throw new Error(`Nimble crawl failed for ${source.id}: ${res.status}`);

  const json = await res.json();
  const body: string = json?.html_content ?? json?.content ?? JSON.stringify(json);

  const rawBlobId = await getRawSink().put({
    sourceId: source.id,
    url: source.url,
    fetchedAt: new Date().toISOString(),
    body,
  });

  return { source, rawBlobId, body };
}

/** Crawl every source. One bad source does not sink the run. */
export async function crawlAll(): Promise<CrawlResult[]> {
  const settled = await Promise.allSettled(SOURCES.map(crawlOne));
  const ok: CrawlResult[] = [];
  for (const [i, r] of settled.entries()) {
    if (r.status === 'fulfilled') ok.push(r.value);
    else console.error(`[nimble] ${SOURCES[i].id} failed:`, r.reason);
  }
  return ok;
}

export function nimbleConfigured(): boolean {
  return Boolean(process.env.NIMBLE_API_KEY);
}
