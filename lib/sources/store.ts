// The partner-bank list: which pages the daily job crawls.
//
// RawTree's query API is read-only, so there is no UPDATE and no DELETE. The
// table is therefore an append-only log of states, and the current list is the
// latest row per id. Editing a bank appends a new row; removing one appends a
// row with enabled = false. Nothing is ever destroyed, which also means the
// history of what was crawled and when stays intact.

import { insert, query, rawtreeConfigured } from '../rawtree';
import { SOURCES as BUILT_IN, type RateSource } from '../rates/sources';

const TABLE = 'autosvr_sources';

export interface PartnerSource {
  id: string;
  url: string;
  label: string;
  /** CSS selector Nimble waits for; blank means wait for the page to settle. */
  waitFor: string;
  enabled: boolean;
  updatedAt: string;
}

export function slugForUrl(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return host.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
}

/** The built-in sources, shaped as partner rows, for a first run. */
export function builtInAsPartners(): PartnerSource[] {
  return BUILT_IN.map((s) => ({
    id: s.id,
    url: s.url,
    label: s.id,
    waitFor: s.waitFor ?? '',
    enabled: true,
    updatedAt: '1970-01-01T00:00:00.000Z',
  }));
}

/**
 * Current list, newest state per id. Falls back to the built-in sources when
 * RawTree is unconfigured or the table does not exist yet, so the crawler
 * always has somewhere to point.
 */
export async function listSources(includeDisabled = false): Promise<PartnerSource[]> {
  if (!rawtreeConfigured()) return builtInAsPartners();

  try {
    const rows = await query<
      Omit<PartnerSource, 'enabled' | 'updatedAt'> & { enabled: number; lastWrite: string }
    >(`
      SELECT
        id,
        argMax(url, updatedAt) AS url,
        argMax(label, updatedAt) AS label,
        argMax(waitFor, updatedAt) AS waitFor,
        argMax(enabled, updatedAt) AS enabled,
        -- Not "max(updatedAt) AS updatedAt": aliasing an aggregate to the
        -- column it reads makes ClickHouse resolve the argument to the alias
        -- and reject the query as an aggregate inside an aggregate.
        max(updatedAt) AS lastWrite
      FROM (
        SELECT
          toString(id) AS id,
          toString(url) AS url,
          toString(label) AS label,
          toString(waitFor) AS waitFor,
          toUInt8(enabled) AS enabled,
          toString(updatedAt) AS updatedAt
        FROM ${TABLE}
      )
      GROUP BY id
      ORDER BY label
    `);

    const all: PartnerSource[] = rows.map(({ lastWrite, ...r }) => ({
      ...r,
      enabled: Boolean(Number(r.enabled)),
      updatedAt: lastWrite,
    }));
    const visible = includeDisabled ? all : all.filter((r) => r.enabled);

    // An empty table means nobody has configured anything yet.
    return visible.length > 0 || all.length > 0 ? visible : builtInAsPartners();
  } catch {
    // Table absent on a first run — not an error worth surfacing.
    return builtInAsPartners();
  }
}

export async function upsertSource(
  input: { id?: string; url: string; label?: string; waitFor?: string; enabled?: boolean },
): Promise<PartnerSource> {
  const url = input.url.trim();
  const parsed = new URL(url); // throws on anything malformed
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http and https URLs can be crawled');
  }

  const row: PartnerSource = {
    id: input.id?.trim() || slugForUrl(url),
    url,
    label: (input.label ?? '').trim() || parsed.hostname.replace(/^www\./, ''),
    waitFor: (input.waitFor ?? '').trim(),
    enabled: input.enabled ?? true,
    updatedAt: new Date().toISOString(),
  };

  await insert(TABLE, [{ ...row, enabled: row.enabled ? 1 : 0 }]);
  return row;
}

/** Removal is a tombstone: the row stays, the state becomes disabled. */
export async function disableSource(id: string): Promise<void> {
  const current = (await listSources(true)).find((s) => s.id === id);
  if (!current) throw new Error(`No partner bank with id "${id}"`);
  await upsertSource({ ...current, enabled: false });
}

/** Shape the stored list the way the crawler expects. */
export function toRateSources(sources: PartnerSource[]): RateSource[] {
  return sources.map((s) => ({
    id: s.id,
    url: s.url,
    kind: 'bank_page' as const,
    waitFor: s.waitFor || undefined,
  }));
}
