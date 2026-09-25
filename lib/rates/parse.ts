// Liquid AI turns a page of marketing HTML into rate rows.
//
// Regexing APYs out of these pages breaks constantly — every site renders the
// number differently, and half of them show a promo rate next to the real one.
// An LFM call with a strict output shape survives the layout changes.

import type { RateObservation } from '../types';
import type { CrawlResult } from './nimble';
import { canParseWithSelectors, parseWithSelectors } from './selectors';

// Liquid publishes weights rather than a hosted inference API, so their models
// are reached through OpenRouter, which is OpenAI-compatible. Point LIQUID_URL
// at anything else that speaks the same protocol — a local Ollama or vLLM
// server, for instance — and the rest of this file is unchanged.
const LIQUID_URL =
  process.env.LIQUID_URL ?? 'https://openrouter.ai/api/v1/chat/completions';
// LFM2.5-2.6B is free on OpenRouter, which is the right default for a
// per-page extraction task running once a day. The ":free" suffix is part of
// the slug — without it OpenRouter answers "No endpoints found", which reads
// like the model does not exist rather than like a routing tier.
// Check what is actually servable with:
//   curl -s https://openrouter.ai/api/v1/models -H "Authorization: Bearer $KEY" 
const MODEL = process.env.LIQUID_MODEL ?? 'liquid/lfm-2.5-2.6b:free';

const INSTRUCTION = `Extract every savings account rate on this page.
Return ONLY a JSON array, no prose. Each element:
{"bankName":string,"apy":number,"minBalanceCents":integer,"monthlyFeeCents":integer,"promoExpiresOn":string|null,"insurer":string|null}
Rules:
- apy is a decimal fraction: 4.87% -> 0.0487
- If a promotional and an ongoing rate are both shown, use the ongoing rate
  and put the promo end date in promoExpiresOn.
- Skip CDs, checking accounts, and money market accounts. Savings only.
- Omit any entry whose APY you cannot read directly from the page.
- insurer is the deposit-insurance line exactly as the page states it, e.g.
  "Member FDIC" or "Federally insured by NCUA". Use null if the page does not
  say — do not infer it.`;

/**
 * How much of the page reaches the model.
 *
 * This was 24,000 characters, which silently broke the product's core claim.
 * Aggregators put sponsored listings first and the organic best-rate table
 * lower down — on DepositAccounts the highest rate sits at character 23,597
 * and the next two at 24,490 and 25,389. The model dutifully returned the
 * sponsored rates, which look entirely plausible and are simply not the best
 * ones available. Nothing downstream could tell the difference.
 *
 * LFM2.5-2.6B has a 65,536-token window, so 120,000 characters (~30k tokens)
 * fits several times over and leaves ample room for the response.
 */
const MAX_INPUT_CHARS = Number(process.env.LIQUID_MAX_INPUT_CHARS ?? 120_000);

/**
 * Nimble can return markdown directly, which is already clean enough for the
 * model. Only fall back to stripping when we got raw HTML.
 */
function toText(content: string, isMarkdown: boolean): string {
  if (isMarkdown) return content.trim().slice(0, MAX_INPUT_CHARS);
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_INPUT_CHARS);
}

interface ParsedRow {
  bankName: string;
  apy: number;
  minBalanceCents?: number;
  monthlyFeeCents?: number;
  promoExpiresOn?: string | null;
  insurer?: string | null;
}

async function parseWithModel(crawl: CrawlResult): Promise<RateObservation[]> {
  const res = await fetch(LIQUID_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.LIQUID_API_KEY}`,
      // OpenRouter attributes traffic with these; harmless elsewhere.
      'HTTP-Referer': 'https://github.com/qiaosiD/AutoSvr',
      'X-Title': 'AutoSvr',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: INSTRUCTION },
        { role: 'user', content: toText(crawl.content, crawl.isMarkdown) },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Liquid AI parse failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? '[]';

  let rows: ParsedRow[];
  try {
    // Models sometimes wrap JSON in a fence even when told not to.
    rows = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    console.error('[liquid] unparseable output for', crawl.source.id, content.slice(0, 200));
    return [];
  }
  if (!Array.isArray(rows)) return [];

  const observedAt = new Date().toISOString();

  // Check against both formats: the model reads the markdown, but a figure
  // dropped by the markdown conversion is still legitimate if the HTML has it.
  const source = `${crawl.content}\n${crawl.html}`;

  const wellFormed = rows.filter(
    (r) => r && typeof r.apy === 'number' && r.apy > 0 && r.apy < 0.25,
  );
  const grounded = wellFormed.filter((r) => groundedInSource(r.apy, source));

  const invented = wellFormed.length - grounded.length;
  if (invented > 0) {
    const examples = wellFormed
      .filter((r) => !groundedInSource(r.apy, source))
      .slice(0, 3)
      .map((r) => `${r.bankName} ${(r.apy * 100).toFixed(2)}%`)
      .join(', ');
    console.error(
      `[parse] ${crawl.source.id}: discarded ${invented}/${wellFormed.length} ` +
        `model rates absent from the page (${examples})`,
    );
  }

  // If the model got most of them wrong it cannot be trusted for the rest
  // either. Returning nothing hands the page to the selector parser.
  if (wellFormed.length > 0 && grounded.length < wellFormed.length * 0.7) {
    console.error(
      `[parse] ${crawl.source.id}: model output rejected — only ` +
        `${grounded.length}/${wellFormed.length} rates were actually on the page`,
    );
    return [];
  }

  return grounded
    .map((r) => ({
      observedAt,
      bankId: slug(r.bankName),
      bankName: r.bankName,
      apy: r.apy,
      minBalanceCents: r.minBalanceCents ?? 0,
      monthlyFeeCents: r.monthlyFeeCents ?? 0,
      promoExpiresOn: r.promoExpiresOn ?? null,
      insurer: r.insurer ?? null,
      sourceUrl: crawl.source.url,
      rawBlobId: crawl.rawBlobId,
    }));
}

/**
 * Reject any rate that does not appear verbatim in the page it supposedly came
 * from.
 *
 * This is not defensive tidiness. LFM2.5-2.6B, given a 53,000-character rate
 * page, returned "Live Oak Bank — 4.80%". The bank is real and on the page;
 * the rate is not, and the string "4.8%" appears nowhere in the source. It
 * also reported Elevault at 4.60% where the page says 4.34%. Every value was
 * plausible, and nothing downstream could have caught it: the engine would
 * have moved a customer's balance to a bank on the strength of a rate no one
 * was offering.
 *
 * A model may only report what the page actually says, and the page is the
 * arbiter. Small models make this check mandatory rather than optional.
 */
function groundedInSource(apy: number, source: string): boolean {
  const pct = apy * 100;
  // Match how the figure might legitimately be written: 4.34%, 4.34 %, 4.3%.
  const candidates = new Set([
    pct.toFixed(2),
    pct.toFixed(1),
    pct.toFixed(2).replace(/0$/, ''),
    String(pct),
  ]);
  return [...candidates].some((c) =>
    new RegExp(`\\b${c.replace('.', '\\.')}\\s*%`).test(source),
  );
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function liquidConfigured(): boolean {
  return Boolean(process.env.LIQUID_API_KEY);
}

export function liquidTarget(): { url: string; model: string } {
  return { url: LIQUID_URL, model: MODEL };
}


/**
 * Turn a crawled page into rate rows.
 *
 * Prefers the model, which survives markup changes and reads promotional rates
 * correctly. Falls back to selectors when Liquid is not configured, and also
 * when the model returns nothing from a page selectors can read — an empty
 * parse is indistinguishable from "this bank has no rates today" downstream,
 * and quietly recording nothing is the worst outcome available.
 */
export async function parseRates(crawl: CrawlResult): Promise<RateObservation[]> {
  const selectorsAvailable = canParseWithSelectors(crawl.source.id);

  if (liquidConfigured()) {
    try {
      const rows = await parseWithModel(crawl);
      if (rows.length > 0) return rows;
      console.warn(`[parse] model returned no rates for ${crawl.source.id}`);
    } catch (err) {
      console.error(`[parse] model failed for ${crawl.source.id}:`, err);
    }
  }

  if (!selectorsAvailable) {
    console.error(
      `[parse] no rates for ${crawl.source.id}: the model is unavailable and ` +
        `there are no selectors for this source`,
    );
    return [];
  }

  const rows = parseWithSelectors(crawl, crawl.html);
  console.log(`[parse] ${crawl.source.id}: ${rows.length} rates via selectors`);
  return rows;
}
