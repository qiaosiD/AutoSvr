// Liquid AI turns a page of marketing HTML into rate rows.
//
// Regexing APYs out of these pages breaks constantly — every site renders the
// number differently, and half of them show a promo rate next to the real one.
// An LFM call with a strict output shape survives the layout changes.

import type { RateObservation } from '../types';
import type { CrawlResult } from './nimble';

const LIQUID_URL = 'https://api.liquid.ai/v1/chat/completions';
const MODEL = process.env.LIQUID_MODEL ?? 'lfm-3b';

const INSTRUCTION = `Extract every savings account rate on this page.
Return ONLY a JSON array, no prose. Each element:
{"bankName":string,"apy":number,"minBalanceCents":integer,"monthlyFeeCents":integer,"promoExpiresOn":string|null}
Rules:
- apy is a decimal fraction: 4.87% -> 0.0487
- If a promotional and an ongoing rate are both shown, use the ongoing rate
  and put the promo end date in promoExpiresOn.
- Skip CDs, checking accounts, and money market accounts. Savings only.
- Omit any entry whose APY you cannot read directly from the page.`;

/**
 * Nimble can return markdown directly, which is already clean enough for the
 * model. Only fall back to stripping when we got raw HTML.
 */
function toText(content: string, isMarkdown: boolean): string {
  if (isMarkdown) return content.trim().slice(0, 24_000);
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24_000);
}

interface ParsedRow {
  bankName: string;
  apy: number;
  minBalanceCents?: number;
  monthlyFeeCents?: number;
  promoExpiresOn?: string | null;
}

export async function parseRates(crawl: CrawlResult): Promise<RateObservation[]> {
  const res = await fetch(LIQUID_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.LIQUID_API_KEY}`,
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

  if (!res.ok) throw new Error(`Liquid AI parse failed: ${res.status}`);

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
  return rows
    .filter((r) => r && typeof r.apy === 'number' && r.apy > 0 && r.apy < 0.25)
    .map((r) => ({
      observedAt,
      bankId: slug(r.bankName),
      bankName: r.bankName,
      apy: r.apy,
      minBalanceCents: r.minBalanceCents ?? 0,
      monthlyFeeCents: r.monthlyFeeCents ?? 0,
      promoExpiresOn: r.promoExpiresOn ?? null,
      sourceUrl: crawl.source.url,
      rawBlobId: crawl.rawBlobId,
    }));
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function liquidConfigured(): boolean {
  return Boolean(process.env.LIQUID_API_KEY);
}
