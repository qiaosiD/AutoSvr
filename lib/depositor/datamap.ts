// Live state of the pipeline, for the data map.
//
// The map is only worth showing if it reports what is actually true right now
// rather than what the architecture diagram said at commit time. Every stage
// reports whether it is configured, and the ledger stages report real row
// counts read from RawTree. When a read fails the stage says so instead of
// rendering a zero that reads like "nothing happened".

import { nimbleConfigured } from '../rates/nimble';
import { liquidConfigured } from '../rates/parse';
import { query, rawtreeConfigured, TABLES } from '../rawtree';
import { SOURCES } from '../rates/sources';
import { BANKS } from '../banks';
import { SWEEP_THRESHOLD_APR } from '../engine';

export interface StageStatus {
  configured: boolean;
  /** Null when the count could not be read, which is not the same as zero. */
  count: number | null;
  detail: string;
}

export interface DataMap {
  crawl: StageStatus;
  parse: StageStatus;
  ledger: StageStatus;
  sourceCount: number;
  sources: string[];
  bankCount: number;
  thresholdBps: number;
  /** Rate rows that came from a real crawl rather than the deterministic seed. */
  liveRateRows: number | null;
  seedRateRows: number | null;
  sweepRows: number | null;
  accrualDays: number | null;
  lastObservedAt: string | null;
  /** True when the dashboard is reading the ledger rather than the seed. */
  servingLive: boolean;
}

async function safe<T>(sql: string): Promise<T[] | null> {
  try {
    return await query<T>(sql);
  } catch {
    return null;
  }
}

export async function getDataMap(): Promise<DataMap> {
  const crawlOn = nimbleConfigured();
  const parseOn = liquidConfigured();
  const ledgerOn = rawtreeConfigured();

  let liveRateRows: number | null = null;
  let seedRateRows: number | null = null;
  let sweepRows: number | null = null;
  let accrualDays: number | null = null;
  let lastObservedAt: string | null = null;

  if (ledgerOn) {
    const split = await safe<{ kind: string; n: number }>(
      `SELECT multiIf(toString(sourceUrl) LIKE 'demo://%', 'seed', 'live') AS kind, count() AS n
       FROM ${TABLES.rates} GROUP BY kind`,
    );
    if (split) {
      liveRateRows = Number(split.find((r) => r.kind === 'live')?.n ?? 0);
      seedRateRows = Number(split.find((r) => r.kind === 'seed')?.n ?? 0);
    }

    const sweeps = await safe<{ n: number }>(`SELECT count() AS n FROM ${TABLES.sweeps}`);
    if (sweeps) sweepRows = Number(sweeps[0]?.n ?? 0);

    // Distinct dates, not row count: the ledger can hold a duplicate for a day
    // and the map should report the same number the dashboard does.
    const days = await safe<{ n: number }>(
      `SELECT uniqExact(toString(date)) AS n FROM ${TABLES.accruals}`,
    );
    if (days) accrualDays = Number(days[0]?.n ?? 0);

    const last = await safe<{ at: string }>(
      `SELECT max(toString(observedAt)) AS at FROM ${TABLES.rates}
       WHERE toString(sourceUrl) NOT LIKE 'demo://%'`,
    );
    if (last && last[0]?.at) lastObservedAt = String(last[0].at);
  }

  return {
    crawl: {
      configured: crawlOn,
      count: SOURCES.length,
      detail: crawlOn ? 'Nimble · live' : 'Nimble key not set — seeded rates',
    },
    parse: {
      configured: parseOn,
      count: liveRateRows,
      detail: parseOn ? 'Liquid LFM via OpenRouter' : 'Liquid key not set — seeded rates',
    },
    ledger: {
      configured: ledgerOn,
      count: accrualDays,
      detail: ledgerOn ? 'RawTree · ClickHouse' : 'RawTree key not set — in-memory seed',
    },
    sourceCount: SOURCES.length,
    sources: SOURCES.map((s) => new URL(s.url).hostname.replace(/^www\./, '')),
    bankCount: BANKS.length,
    thresholdBps: Math.round(SWEEP_THRESHOLD_APR * 10_000),
    liveRateRows,
    seedRateRows,
    sweepRows,
    accrualDays,
    lastObservedAt,
    servingLive: ledgerOn && (accrualDays ?? 0) > 0,
  };
}
