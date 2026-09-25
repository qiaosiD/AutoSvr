// Deterministic rate extraction from a page's own markup.
//
// This is the backstop for the LLM parser: no model, no API call, no cost, and
// the same input always yields the same rates — which matters when the output
// decides where someone's savings go. The tradeoff is that it breaks when a
// site changes its markup, where the model would adapt. Both paths exist, and
// lib/rates/parse.ts prefers the model when it is configured.

import { parse, type HTMLElement } from 'node-html-parser';
import type { RateObservation } from '../types';
import type { CrawlResult } from './nimble';

/** How to find rate rows on one site. */
export interface SelectorConfig {
  sourceId: string;
  /** Each match is one bank's row. */
  row: string;
  bankName: string;
  apy: string;
  /** Optional: product name, and the FDIC/NCUA membership line. */
  product?: string;
  insurer?: string;
  /**
   * Remaining numeric columns in document order, after the APY column.
   * DepositAccounts lays these out as service charge, min to earn, min deposit.
   */
  secondaryColumns?: string;
  secondaryOrder?: Array<'monthlyFee' | 'minToEarn' | 'minDeposit'>;
}

export const SELECTORS: SelectorConfig[] = [
  {
    sourceId: 'depositaccounts',
    row: '.organicRateTableRow',
    bankName: '.bankName',
    apy: '.apyCol',
    product: '.bankProduct',
    insurer: '.insurer',
    secondaryColumns: '.secCol',
    secondaryOrder: ['monthlyFee', 'minToEarn', 'minDeposit'],
  },
];

const text = (el: HTMLElement | null | undefined): string =>
  (el?.text ?? '').replace(/\s+/g, ' ').trim();

/** "4.34%" -> 0.0434. Returns null for anything that isn't a plausible APY. */
export function parsePercent(raw: string): number | null {
  const m = raw.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const pct = Number(m[1]) / 100;
  // Above 8% is a teaser, a credit product, or a misparse — not a savings APY.
  return pct > 0 && pct <= 0.08 ? pct : null;
}

/** "$1,000" -> 100000 cents. Absent or "-" means zero. */
export function parseMoneyCents(raw: string): number {
  const m = raw.replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  return m ? Math.round(Number(m[1]) * 100) : 0;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function selectorsFor(sourceId: string): SelectorConfig | undefined {
  return SELECTORS.find((s) => s.sourceId === sourceId);
}

export function canParseWithSelectors(sourceId: string): boolean {
  return Boolean(selectorsFor(sourceId));
}

/**
 * Extract rates from crawled HTML. Needs the HTML, not the markdown — the
 * markdown conversion flattens the table and the columns become
 * indistinguishable from one another.
 */
export function parseWithSelectors(crawl: CrawlResult, html: string): RateObservation[] {
  const config = selectorsFor(crawl.source.id);
  if (!config) return [];

  const doc = parse(html);
  const observedAt = new Date().toISOString();
  const out: RateObservation[] = [];
  const seen = new Set<string>();

  for (const row of doc.querySelectorAll(config.row)) {
    const bankName = text(row.querySelector(config.bankName));
    const apy = parsePercent(text(row.querySelector(config.apy)));
    if (!bankName || apy === null) continue;

    // The same bank appears more than once: the page renders separate desktop
    // and mobile rows, and some banks list several products.
    const product = config.product ? text(row.querySelector(config.product)) : '';
    const insurer = config.insurer ? text(row.querySelector(config.insurer)) : '';
    const dedupeKey = `${bankName}|${product}|${apy}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    let monthlyFeeCents = 0;
    let minBalanceCents = 0;

    if (config.secondaryColumns && config.secondaryOrder) {
      // The APY column carries .secCol too, so drop it before mapping the rest
      // onto the header order.
      const cols = row
        .querySelectorAll(config.secondaryColumns)
        .filter((c) => !c.classNames.includes('apyCol'))
        .map((c) => text(c));

      config.secondaryOrder.forEach((field, i) => {
        const cents = parseMoneyCents(cols[i] ?? '');
        if (field === 'monthlyFee') monthlyFeeCents = cents;
        if (field === 'minToEarn') minBalanceCents = Math.max(minBalanceCents, cents);
      });
    }

    out.push({
      observedAt,
      bankId: slug(bankName),
      bankName,
      apy,
      minBalanceCents,
      monthlyFeeCents,
      promoExpiresOn: null,
      insurer: insurer || null,
      sourceUrl: crawl.source.url,
      rawBlobId: crawl.rawBlobId,
    });
  }

  return out;
}
