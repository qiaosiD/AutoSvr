// RawTree is the system of record: rate history, sweep events, daily accruals.
// Tables are created on first insert, so there is no schema to declare.
//
// It is ClickHouse underneath, so window functions and the compounding math run
// in SQL. The catch is that schemaless ingestion types every column as Dynamic,
// which most aggregates refuse to touch — argMax on a Dynamic column fails
// outright. Every column reference below is therefore cast explicitly.

const BASE = process.env.RAWTREE_BASE ?? 'https://api.rawtree.com';

export function rawtreeConfigured(): boolean {
  return Boolean(process.env.RAWTREE_API_KEY);
}

function key(): string {
  const k = process.env.RAWTREE_API_KEY;
  if (!k) throw new Error('RAWTREE_API_KEY is not set');
  return k;
}

function dbParam(): string {
  const db = process.env.RAWTREE_DATABASE;
  return db ? `?database=${encodeURIComponent(db)}` : '';
}

/**
 * The query API takes raw SQL with no parameter binding, so anything
 * interpolated into a statement is escaped here. Ids in this app are internal,
 * but a ledger is the wrong place to be relaxed about it.
 */
export function sqlString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Append rows to a table. */
export async function insert(table: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;
  const res = await fetch(`${BASE}/v1/tables/${table}${dbParam()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key()}` },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`RawTree insert into ${table} failed: ${res.status} ${await res.text()}`);
  }
}

/** Run read-only SQL and return the rows. */
export async function query<T>(sql: string): Promise<T[]> {
  const res = await fetch(`${BASE}/v1/query${dbParam()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key()}` },
    body: JSON.stringify({ sql }),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`RawTree query failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return (json?.data ?? []) as T[];
}

/**
 * The RawTree cluster's `default` database is shared across the whole event —
 * roughly a hundred tables from other teams sit beside ours. Bare names like
 * `daily_accruals` and `sweep_events` are collision bait there: any other team
 * modelling a ledger reaches for the same words, and MergeTree will happily
 * accept their rows into our table. `autosvr_healthcheck` was already
 * namespaced; these had simply missed the convention.
 *
 * rawCrawls stays unprefixed for now because the crawl path is being worked on
 * in a parallel session and is mid-test against that table. Worth renaming once
 * that settles.
 */
export const TABLES = {
  rates: 'autosvr_rate_observations',
  sweeps: 'autosvr_sweep_events',
  accruals: 'autosvr_daily_accruals',
  payouts: 'autosvr_interest_payouts',
  rawCrawls: 'raw_crawls',
} as const;
