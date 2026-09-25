// Nimble does the crawling. Bank rate pages are JS-heavy and rate-limit
// aggressively, so plain fetch() gets you a challenge page instead of rates.
//
// Endpoint and payload verified against docs.nimbleway.com (Nimble SDK v2).

import { getRawSink } from './rawSink';
import { SOURCES, type RateSource } from './sources';

const NIMBLE_EXTRACT_URL = 'https://sdk.nimbleway.com/v2/extract';

/** Attempts per source before giving up on a page that renders incompletely. */
const MAX_ATTEMPTS = 3;

/**
 * Rate pages load their tables asynchronously, and "auto" rendering sometimes
 * returns before that happens — the same URL yields 55KB with rates on one
 * call and 26KB of navigation on the next. A crawl that captured only the
 * chrome is not an error anywhere visible: it parses to zero rates and the
 * day silently records nothing. So the page has to prove it carries rates
 * before we accept it.
 */
function hasRateSignal(content: string): boolean {
  const plausible = [...content.matchAll(/(\d+\.\d{1,2})\s*%/g)]
    .map((m) => Number(m[1]))
    .filter((p) => p >= 0.5 && p <= 8);
  return new Set(plausible).size >= 3;
}

export interface CrawlResult {
  source: RateSource;
  rawBlobId: string;
  content: string;
  /** Markdown needs no tag-stripping before it reaches the parser. */
  isMarkdown: boolean;
}

async function crawlOnce(source: RateSource): Promise<CrawlResult> {
  const res = await fetch(NIMBLE_EXTRACT_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.NIMBLE_API_KEY}`,
    },
    body: JSON.stringify({
      url: source.url,
      // "auto" waits for the page to settle; `true` returns as soon as the
      // document exists, which on these sites means a bare <head> and no rates.
      render: 'auto',
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

  // Nimble returns an empty string rather than omitting a format it could not
  // produce, so `??` is not enough here — it would select "" over real HTML.
  const markdown: string = json?.data?.markdown || '';
  const html: string = json?.data?.html || '';
  const content = markdown || html;
  if (!content) {
    throw new Error(
      `Nimble returned no content for ${source.id} (status "${json?.status}")`,
    );
  }

  const rawBlobId = await getRawSink().put({
    sourceId: source.id,
    url: source.url,
    fetchedAt: new Date().toISOString(),
    body: html ?? content,
  });

  return { source, rawBlobId, content, isMarkdown: Boolean(markdown) };
}

/** Crawl a source, retrying while the page comes back without rate data. */
async function crawlOne(source: RateSource): Promise<CrawlResult> {
  let last: CrawlResult | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await crawlOnce(source);
    last = result;

    if (hasRateSignal(result.content)) {
      if (attempt > 1) console.warn(`[nimble] ${source.id} needed ${attempt} attempts`);
      return result;
    }

    console.warn(
      `[nimble] ${source.id} attempt ${attempt}/${MAX_ATTEMPTS}: ` +
        `${result.content.length} chars with no rate data, retrying`,
    );
    await new Promise((r) => setTimeout(r, attempt * 1500));
  }

  // Hand back the last attempt rather than throwing: the blob is already
  // stored, and the parser reporting zero rates is more diagnosable than a
  // crawl that vanished.
  console.error(`[nimble] ${source.id} never returned rate data in ${MAX_ATTEMPTS} attempts`);
  return last!;
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
