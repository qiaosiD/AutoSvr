// Nimble does the crawling. Bank rate pages are JS-heavy and rate-limit
// aggressively, so plain fetch() gets you a challenge page instead of rates.
//
// Endpoint and payload verified against docs.nimbleway.com (Nimble SDK v2).

import { getRawSink } from './rawSink';
import { SOURCES, type RateSource } from './sources';

const NIMBLE_EXTRACT_URL = 'https://sdk.nimbleway.com/v2/extract';

export interface CrawlResult {
  source: RateSource;
  rawBlobId: string;
  content: string;
  /** Markdown needs no tag-stripping before it reaches the parser. */
  isMarkdown: boolean;
}

async function crawlOne(source: RateSource): Promise<CrawlResult> {
  const res = await fetch(NIMBLE_EXTRACT_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.NIMBLE_API_KEY}`,
    },
    body: JSON.stringify({
      url: source.url,
      render: true,
      // Ask for both: markdown is far cheaper for the parser to read, but keep
      // the HTML so the raw blob stays faithful to what the page actually served.
      formats: ['markdown', 'html'],
      country: 'US',
      locale: 'en-US',
    }),
  });

  if (!res.ok) {
    throw new Error(`Nimble extract failed for ${source.id}: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  if (json?.status && json.status !== 'success') {
    throw new Error(`Nimble returned status "${json.status}" for ${source.id}`);
  }

  const markdown: string | undefined = json?.data?.markdown;
  const html: string | undefined = json?.data?.html;
  const content = markdown ?? html;
  if (!content) throw new Error(`Nimble returned no content for ${source.id}`);

  const rawBlobId = await getRawSink().put({
    sourceId: source.id,
    url: source.url,
    fetchedAt: new Date().toISOString(),
    body: html ?? content,
  });

  return { source, rawBlobId, content, isMarkdown: Boolean(markdown) };
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
