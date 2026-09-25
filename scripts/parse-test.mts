/**
 * Crawl one source and parse it, end to end.
 *
 *   npm run parse:test              # first source
 *   npm run parse:test -- bankrate  # a specific source
 *
 * Reports which parser ran, what it produced, and whether the result would
 * actually be usable by the sweep engine — an extracted rate at an uninsured
 * institution is not eligible however good it looks.
 */

import { SOURCES } from '../lib/rates/sources';
import { crawlAll, nimbleConfigured } from '../lib/rates/nimble';
import { parseRates } from '../lib/rates/parse';
import { liquidConfigured } from '../lib/rates/parse';
import { canParseWithSelectors } from '../lib/rates/selectors';
import { bestRate, isInsured } from '../lib/engine';

for (const f of ['.env.local', '.env']) {
  try { process.loadEnvFile(f); break; } catch { /* next */ }
}

function die(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

async function main() {
  if (!nimbleConfigured()) die('NIMBLE_API_KEY is not set.');

  const wanted = process.argv[2];
  const source = wanted ? SOURCES.find((s) => s.id === wanted) : SOURCES[0];
  if (!source) die(`No source "${wanted}". Known: ${SOURCES.map((s) => s.id).join(', ')}`);

  console.log(`\nParse test — ${source.id}`);
  console.log(`  model parser      ${liquidConfigured() ? 'configured' : 'NOT configured'}`);
  console.log(`  selector parser   ${canParseWithSelectors(source.id) ? 'available' : 'none for this source'}\n`);

  const original = SOURCES.splice(0, SOURCES.length, source);
  let crawls;
  try {
    crawls = await crawlAll();
  } finally {
    SOURCES.splice(0, SOURCES.length, ...original);
  }
  if (crawls.length === 0) die('Crawl returned nothing.');

  const rates = await parseRates(crawls[0]);
  if (rates.length === 0) die('Parsed zero rates.');

  const insured = rates.filter(isInsured);
  console.log(`\n  ${rates.length} rates parsed, ${insured.length} at insured institutions\n`);

  [...rates]
    .sort((a, b) => b.apy - a.apy)
    .slice(0, 10)
    .forEach((r) => {
      const flag = isInsured(r) ? ' ' : '✗';
      console.log(
        `  ${flag} ${(r.apy * 100).toFixed(2).padStart(5)}%  ${r.bankName.padEnd(30)}` +
          ` ${(r.insurer ?? 'no insurance stated').padEnd(28)}` +
          ` min $${(r.minBalanceCents / 100).toLocaleString()}`,
      );
    });

  // What the engine would actually do with this.
  const pick = bestRate(rates, 4_200_000);
  console.log(`\n  engine would choose: ${pick ? `${pick.bankName} at ${(pick.apy * 100).toFixed(2)}%` : 'nothing eligible'}`);

  const uninsured = rates.length - insured.length;
  if (uninsured > 0) {
    console.log(`  (${uninsured} rate${uninsured === 1 ? '' : 's'} excluded for no stated deposit insurance)`);
  }
  console.log();
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
