/**
 * Push the seeded 90-day history into Tinybird so the live dashboard has
 * something to show the moment TINYBIRD_TOKEN is set.
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

const HOST = process.env.TINYBIRD_HOST ?? 'https://api.tinybird.co';
const TOKEN = process.env.TINYBIRD_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const CHUNK = 500;

function die(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

/** POST one chunk of NDJSON to the Events API. */
async function sendChunk(datasource: string, rows: unknown[]): Promise<number> {
  const res = await fetch(`${HOST}/v0/events?name=${datasource}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}` },
    body: rows.map((r) => JSON.stringify(r)).join('\n'),
  });

  const text = await res.text();
  if (!res.ok) {
    if (res.status === 403) {
      die(
        `403 from ${datasource}.\n` +
          `  Your token lacks DATASOURCE:APPEND for this datasource.\n` +
          `  Use the token named "autosvr_ingest" that \`tb push\` creates from\n` +
          `  the TOKEN ... APPEND lines in tinybird/datasources/*.datasource.`,
      );
    }
    if (res.status === 404) {
      die(
        `404 from ${datasource}.\n` +
          `  That datasource doesn't exist yet. Run:\n` +
          `    tb push tinybird/datasources/*.datasource tinybird/pipes/*.pipe`,
      );
    }
    die(`${res.status} from ${datasource}: ${text}`);
  }

  let quarantined = 0;
  try {
    const body = JSON.parse(text);
    quarantined = body.quarantined_rows ?? 0;
  } catch {
    // Non-JSON success body; nothing to read.
  }
  return quarantined;
}

async function push(datasource: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;

  if (DRY_RUN) {
    console.log(`  ${datasource.padEnd(20)} ${String(rows.length).padStart(5)} rows (dry run)`);
    console.log(`    sample: ${JSON.stringify(rows[0])}`);
    return;
  }

  let quarantined = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    quarantined += await sendChunk(datasource, rows.slice(i, i + CHUNK));
    process.stdout.write(
      `\r  ${datasource.padEnd(20)} ${Math.min(i + CHUNK, rows.length)}/${rows.length}`,
    );
  }
  const warn = quarantined > 0 ? `  ⚠ ${quarantined} quarantined` : '';
  console.log(`\r  ${datasource.padEnd(20)} ${String(rows.length).padStart(5)} rows ✓${warn}`);

  if (quarantined > 0) {
    console.log(
      `    Quarantined rows failed schema validation. Inspect them with:\n` +
        `      tb sql "SELECT * FROM ${datasource}_quarantine LIMIT 5"`,
    );
  }
}

/**
 * Refuse to double-count. Needs read scope, which the append-only ingest token
 * won't have — in that case say so plainly rather than proceeding blind.
 */
async function assertLedgerEmpty(): Promise<void> {
  if (FORCE) {
    console.log('⚠ --force: skipping the duplicate check.\n');
    return;
  }

  const res = await fetch(
    `${HOST}/v0/sql?q=${encodeURIComponent('SELECT count() AS n FROM daily_accruals FORMAT JSON')}`,
    { headers: { authorization: `Bearer ${TOKEN}` } },
  );

  if (!res.ok) {
    die(
      `Couldn't check for existing rows (HTTP ${res.status}).\n` +
        `  The ingest token is append-only, so it can't read.\n` +
        `  Either run with an admin token, or re-run with --force if you are\n` +
        `  certain the ledger is empty. Backfilling twice doubles every number\n` +
        `  on the dashboard.`,
    );
  }

  const { data } = await res.json();
  const n = Number(data?.[0]?.n ?? 0);
  if (n > 0) {
    die(
      `daily_accruals already holds ${n} rows.\n` +
        `  Backfilling again would double the dashboard's numbers.\n` +
        `  To start over:\n` +
        `    tb datasource truncate daily_accruals\n` +
        `    tb datasource truncate rate_observations\n` +
        `    tb datasource truncate sweep_events\n` +
        `  Or re-run with --force if you really want to append.`,
    );
  }
}

async function main() {
  if (!TOKEN && !DRY_RUN) {
    die(
      'TINYBIRD_TOKEN is not set.\n' +
        '  Put it in .env.local, or use --dry-run to see what would be sent.',
    );
  }

  const { rates, sweeps, accruals } = seedHistory();
  const earned = accruals.reduce((s, a) => s + a.accruedCents, 0);

  console.log(`\nAutoSvr backfill${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`  host      ${HOST}`);
  console.log(`  customer  ${DEMO_CUSTOMER.id} (${DEMO_CUSTOMER.name})`);
  console.log(`  window    ${accruals[0]?.date} → ${accruals.at(-1)?.date}`);
  console.log(`  earned    ${formatCents(earned)} across ${sweeps.length} moves\n`);

  if (!DRY_RUN) await assertLedgerEmpty();

  await push('rate_observations', rates);
  await push('sweep_events', sweeps);
  await push('daily_accruals', accruals);

  if (DRY_RUN) {
    console.log('\nDry run — nothing sent. Drop --dry-run to push.\n');
    return;
  }

  console.log('\n✓ Backfill complete.');
  console.log('  Tinybird ingestion is async; give it a few seconds, then:');
  console.log('    tb sql "SELECT count() FROM daily_accruals"');
  console.log('  Restart the dev server and the dashboard should read "Live data".\n');
}

main().catch((err) => die(String(err)));
