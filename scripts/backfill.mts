/**
 * Push the seeded 90-day history into RawTree so the live dashboard has
 * something to show the moment RAWTREE_API_KEY is set.
 *
 *   npx tsx scripts/backfill.mts --dry-run   # show what would be sent
 *   npx tsx scripts/backfill.mts             # send it
 *   npx tsx scripts/backfill.mts --force     # send even if rows already exist
 *
 * Datasources are MergeTree, which does NOT deduplicate. Running this twice
 * doubles every number on the dashboard, so it refuses to run against a
 * non-empty ledger unless you pass --force.
 */

import { seedHistory, DEMO_CUSTOMER } from '../lib/demo/seed';
import { TABLES } from '../lib/rawtree';
import { formatCents } from '../lib/apy';

// A standalone tsx run doesn't get Next's env loading.
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
    break;
  } catch {
    // Not present — fall through to the next candidate, then to real env vars.
  }
}

const BASE = process.env.RAWTREE_BASE ?? 'https://api.rawtree.com';
const TOKEN = process.env.RAWTREE_API_KEY;
const DB = process.env.RAWTREE_DATABASE;
const dbParam = DB ? `?database=${encodeURIComponent(DB)}` : '';
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const CHUNK = 500;

function die(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

/** POST one chunk of rows to a table. */
async function sendChunk(datasource: string, rows: unknown[]): Promise<number> {
  const res = await fetch(`${BASE}/v1/tables/${datasource}${dbParam}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(rows),
  });

  const text = await res.text();
  if (!res.ok) {
    if (res.status === 403) {
      die(
        `403 from ${datasource}.\n` +
          `  This key cannot write. A "Read only" key cannot ingest —\n` +
          `  create a Read/write or Write only key in the RawTree dashboard.`,
      );
    }
    if (res.status === 400 && text.includes('Database not found')) {
      die(
        `Database "${DB}" does not exist on this cluster.\n` +
          `  A read/write key can insert into a database but cannot create one.\n` +
          `  List the ones you can reach:\n` +
          `    curl -H "Authorization: Bearer $RAWTREE_API_KEY" ${BASE}/v1/databases`,
      );
    }
    die(`${res.status} from ${datasource}: ${text}`);
  }

  // RawTree reports {"inserted": n}; there is no quarantine concept.
  try {
    const body = JSON.parse(text);
    if (typeof body.inserted === 'number' && body.inserted !== rows.length) {
      console.warn(
        `\n⚠ ${datasource}: sent ${rows.length} rows, RawTree reported ${body.inserted} inserted.`,
      );
    }
  } catch {
    // Non-JSON success body; nothing to read.
  }
  return 0;
}

async function push(datasource: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;

  if (DRY_RUN) {
    console.log(`  ${datasource.padEnd(20)} ${String(rows.length).padStart(5)} rows (dry run)`);
    console.log(`    sample: ${JSON.stringify(rows[0])}`);
    return;
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    await sendChunk(datasource, rows.slice(i, i + CHUNK));
    process.stdout.write(
      `\r  ${datasource.padEnd(20)} ${Math.min(i + CHUNK, rows.length)}/${rows.length}`,
    );
  }
  console.log(`\r  ${datasource.padEnd(20)} ${String(rows.length).padStart(5)} rows ✓`);
}

/**
 * Refuse to double-count. Needs a key that can read — say so plainly rather
 * than proceeding blind if it cannot.
 */
async function assertLedgerEmpty(): Promise<void> {
  if (FORCE) {
    console.log('⚠ --force: skipping the duplicate check.\n');
    return;
  }

  const res = await fetch(`${BASE}/v1/query${dbParam}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ sql: `SELECT count() AS n FROM ${TABLES.accruals}` }),
  });

  if (!res.ok) {
    const body = await res.text();
    // A table that has never been written to does not exist yet — that is an
    // empty ledger, which is exactly the state we want to proceed from.
    // RawTree words this as "Table not found."; ClickHouse says "Unknown table".
    // Missing the former made this fail closed on a first run and pushed you
    // toward --force, which is the one flag that can silently double the data.
    if (
      body.includes('Unknown table') ||
      body.includes("doesn't exist") ||
      body.includes('Table not found')
    ) {
      return;
    }
    die(
      `Couldn't check for existing rows (HTTP ${res.status}).\n` +
        `  A write-only key cannot read. Either use a Read/write key, or re-run\n` +
        `  with --force if you are certain the ledger is empty. Backfilling\n` +
        `  twice doubles every number on the dashboard.\n` +
        `  Response: ${body}`,
    );
  }

  const { data } = await res.json();
  const n = Number(data?.[0]?.n ?? 0);
  if (n > 0) {
    die(
      `${TABLES.accruals} already holds ${n} rows.\n` +
        `  Backfilling again would double the dashboard's numbers.\n` +
        `  To start over, drop the tables in the RawTree dashboard, or re-run\n` +
        `  with --force if you really do want to append.`,
    );
  }
}

async function main() {
  if (!TOKEN && !DRY_RUN) {
    die(
      'RAWTREE_API_KEY is not set.\n' +
        '  Put it in .env.local, or use --dry-run to see what would be sent.',
    );
  }

  const { rates, sweeps, accruals } = seedHistory();
  const earned = accruals.reduce((s, a) => s + a.accruedCents, 0);

  console.log(`\nAutoSvr backfill${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`  base      ${BASE}`);
  console.log(`  database  ${DB ?? '(cluster default)'}`);
  console.log(`  customer  ${DEMO_CUSTOMER.id} (${DEMO_CUSTOMER.name})`);
  console.log(`  window    ${accruals[0]?.date} → ${accruals.at(-1)?.date}`);
  console.log(`  earned    ${formatCents(earned)} across ${sweeps.length} moves\n`);

  if (!DRY_RUN) await assertLedgerEmpty();

  await push(TABLES.rates, rates);
  await push(TABLES.sweeps, sweeps);
  await push(TABLES.accruals, accruals);

  if (DRY_RUN) {
    console.log('\nDry run — nothing sent. Drop --dry-run to push.\n');
    return;
  }

  console.log('\n✓ Backfill complete.');
  console.log('  Restart the dev server and the dashboard should read "Live data".\n');
}

main().catch((err) => die(String(err)));
