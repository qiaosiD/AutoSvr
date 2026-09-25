/**
 * Run one live Nimble crawl and report what came back.
 *
 *   npm run crawl:test              # first source in lib/rates/sources.ts
 *   npm run crawl:test -- bankrate  # a specific source by id
 *
 * Deliberately one page, not the full set: this answers "is the key and the
 * endpoint working, and is the output good enough to parse?" before anything
 * depends on it.
 */

import { SOURCES } from '../lib/rates/sources';
import { crawlAll, nimbleConfigured } from '../lib/rates/nimble';

for (const f of ['.env.local', '.env']) {
  try { process.loadEnvFile(f); break; } catch { /* next */ }
}

function die(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

async function main() {
  if (!nimbleConfigured()) die('NIMBLE_API_KEY is not set in .env.local.');

  const wanted = process.argv[2];
  const source = wanted ? SOURCES.find((s) => s.id === wanted) : SOURCES[0];
  if (!source) {
    die(`No source "${wanted}". Known: ${SOURCES.map((s) => s.id).join(', ')}`);
  }

  console.log(`\nNimble crawl test`);
  console.log(`  source    ${source.id}`);
  console.log(`  url       ${source.url}`);
  console.log(`  raw sink  ${process.env.RAW_SINK ?? 'file'}\n`);

  // crawlAll swallows per-source failures by design; narrow it to one source
  // so a failure here surfaces rather than being logged and skipped.
  const original = SOURCES.splice(0, SOURCES.length, source);
  const started = Date.now();
  let results;
  try {
    results = await crawlAll();
  } finally {
    SOURCES.splice(0, SOURCES.length, ...original);
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);

  if (results.length === 0) {
    die(`Crawl returned nothing after ${secs}s. The error above has the detail.`);
  }

  const r = results[0];
  console.log(`  ✓ crawled in ${secs}s`);
  console.log(`    format     ${r.isMarkdown ? 'markdown' : 'html (no markdown returned)'}`);
  console.log(`    length     ${r.content.length.toLocaleString()} chars`);
  console.log(`    rawBlobId  ${r.rawBlobId}`);

  // Does the page actually contain rate-shaped text? If not, the parser has
  // nothing to work with and the problem is the crawl, not the model.
  const pcts = [...r.content.matchAll(/(\d+\.\d{1,2})\s*%/g)].map((m) => Number(m[1]));
  const plausible = pcts.filter((p) => p >= 0.5 && p <= 8);
  console.log(`\n    percentages found: ${pcts.length} (${plausible.length} in a plausible APY range)`);
  if (plausible.length > 0) {
    const top = [...new Set(plausible)].sort((a, b) => b - a).slice(0, 8);
    console.log(`    highest looking like rates: ${top.map((p) => p + '%').join(', ')}`);
  }

  console.log(`\n--- first 600 chars ---\n`);
  console.log(r.content.slice(0, 600).replace(/\n{3,}/g, '\n\n'));
  console.log(`\n--- end ---\n`);

  if (plausible.length === 0) {
    console.log('⚠ No rate-shaped numbers found. Likely a block page or a render');
    console.log('  that finished before the rates loaded. Try another source id.\n');
  } else {
    console.log('✓ Page looks parseable. Liquid AI is the remaining step.\n');
  }
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
