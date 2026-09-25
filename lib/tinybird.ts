// Tinybird is the system of record for everything time-shaped: what each bank
// paid on each day, where each customer's money sat, and what it earned there.
// The dashboard reads published pipes, so a chart is one HTTP call, not a join
// assembled in the app.
//
// Without TINYBIRD_TOKEN the app falls back to the in-memory demo dataset, so
// the UI is never blank.

import type { Accrual, RateObservation, SweepEvent } from './types';

const HOST = process.env.TINYBIRD_HOST ?? 'https://api.us-east.tinybird.co';

export function tinybirdConfigured(): boolean {
  return Boolean(process.env.TINYBIRD_TOKEN);
}

function token(): string {
  const t = process.env.TINYBIRD_TOKEN;
  if (!t) throw new Error('TINYBIRD_TOKEN is not set');
  return t;
}

/** Append rows to a datasource. Tinybird's events endpoint takes NDJSON. */
async function ingest(datasource: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;
  const res = await fetch(`${HOST}/v0/events?name=${datasource}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token()}` },
    body: rows.map((r) => JSON.stringify(r)).join('\n'),
  });
  if (!res.ok) {
    throw new Error(`Tinybird ingest to ${datasource} failed: ${res.status} ${await res.text()}`);
  }
}

/** Call a published pipe endpoint. */
export async function query<T>(pipe: string, params: Record<string, string> = {}): Promise<T[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${HOST}/v0/pipes/${pipe}.json${qs ? `?${qs}` : ''}`, {
    headers: { authorization: `Bearer ${token()}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Tinybird query ${pipe} failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.data as T[];
}

export const ingestRates = (rows: RateObservation[]) => ingest('rate_observations', rows);
export const ingestSweeps = (rows: SweepEvent[]) => ingest('sweep_events', rows);
export const ingestAccruals = (rows: Accrual[]) => ingest('daily_accruals', rows);
