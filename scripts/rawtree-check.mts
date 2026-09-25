/**
 * Confirm the RawTree key works: write a row, read it back, delete nothing.
 *
 *   npm run rawtree:check
 *
 * Writes one row to a scratch table (autosvr_healthcheck), not to the real
 * raw_crawls table, so a failed test leaves no debris in your crawl history.
 */

import { randomUUID } from 'node:crypto';

for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
    break;
  } catch {
    // Fall through to real env vars.
  }
}

const BASE = 'https://api.rawtree.com';
const TABLE = 'autosvr_healthcheck';
const KEY = process.env.RAWTREE_API_KEY;
const DB = process.env.RAWTREE_DATABASE;

function die(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const qs = DB ? `?database=${encodeURIComponent(DB)}` : '';

async function main() {
  if (!KEY) {
    die(
      'RAWTREE_API_KEY is not set.\n' +
        '  Add it to .env.local:\n' +
        '    RAWTREE_API_KEY=rt_...\n' +
        '    RAWTREE_DATABASE=autosvr',
    );
  }
  if (!KEY.startsWith('rt_')) {
    console.warn(`⚠ Key does not start with "rt_" — check you copied the whole value.\n`);
  }

  const marker = randomUUID();
  console.log(`\nRawTree check`);
  console.log(`  base      ${BASE}`);
  console.log(`  database  ${DB ?? '(cluster default)'}`);
  console.log(`  table     ${TABLE}`);
  console.log(`  marker    ${marker}\n`);

  // 1. Write
  const insert = await fetch(`${BASE}/v1/tables/${TABLE}${qs}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify([{ marker, source: 'autosvr', at: new Date().toISOString() }]),
  });

  if (!insert.ok) {
    const body = await insert.text();
    if (insert.status === 401 || insert.status === 403) {
      die(
        `Insert rejected (${insert.status}).\n` +
          `  The key is invalid, or lacks write permission.\n` +
          `  "Read only" keys cannot ingest — you need Read/write or Write only.\n` +
          `  Response: ${body}`,
      );
    }
    die(`Insert failed (${insert.status}): ${body}`);
  }
  console.log('  ✓ write accepted');

  // 2. Read it back. Ingestion may lag slightly, so retry briefly.
  let found = false;
  for (let attempt = 1; attempt <= 5 && !found; attempt++) {
    await new Promise((r) => setTimeout(r, attempt * 600));

    const read = await fetch(`${BASE}/v1/query${qs}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        sql: `SELECT count() AS n FROM ${TABLE} WHERE marker = '${marker}'`,
      }),
    });

    if (!read.ok) {
      const body = await read.text();
      if (read.status === 401 || read.status === 403) {
        console.log(
          '\n  ⚠ Write works, but this key cannot read.\n' +
            '    That is fine for AutoSvr — the raw sink only writes.\n' +
            '    Use a Read/write key if you want to query blobs back.\n',
        );
        console.log('✓ Key is usable for the raw crawl sink.\n');
        return;
      }
      die(`Query failed (${read.status}): ${body}`);
    }

    const json = await read.json();
    const n = Number(json?.data?.[0]?.n ?? json?.rows?.[0]?.n ?? json?.[0]?.n ?? 0);
    if (n > 0) found = true;
    else process.stdout.write(`\r  … waiting for the row to be queryable (${attempt}/5)`);
  }

  if (!found) {
    console.log(
      '\n  ⚠ Write succeeded but the row was not queryable within ~9s.\n' +
        '    Probably ingestion lag rather than a broken key.\n',
    );
    return;
  }

  console.log('\r  ✓ read back confirmed          ');
  console.log('\n✓ RawTree is wired up correctly.');
  console.log('  Set RAW_SINK=rawtree in .env.local to send real crawl blobs there.\n');
}

main().catch((err) => die(String(err)));
