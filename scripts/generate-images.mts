/**
 * Generate the site's imagery with FLUX and write it into the repo.
 *
 *   npm run images -- --list    # show what would be generated
 *   npm run images              # generate anything missing
 *   npm run images -- --force   # regenerate everything
 *
 * Images are generated once and committed, not made per request: a demo
 * should not depend on a third-party render completing while someone watches,
 * and paying per page view for a static hero would be silly.
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { generateImage, bflConfigured, DEFAULT_MODEL } from '../lib/bfl/client';
import { ASSETS } from '../lib/bfl/assets';

for (const f of ['.env.local', '.env']) {
  try { process.loadEnvFile(f); break; } catch { /* next */ }
}

const LIST = process.argv.includes('--list');
const FORCE = process.argv.includes('--force');

function die(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const exists = (p: string) => access(p).then(() => true, () => false);

async function main() {
  console.log(`\nAutoSvr image generation`);
  console.log(`  model  ${process.env.BFL_MODEL ?? DEFAULT_MODEL}\n`);

  if (LIST) {
    for (const a of ASSETS) {
      const have = (await exists(a.path)) ? '✓ present' : '· missing';
      console.log(`  ${have}  ${a.path}  (${a.width}×${a.height})`);
      console.log(`            ${a.purpose}\n`);
    }
    return;
  }

  if (!bflConfigured()) {
    die(
      'BFL_API_KEY is not set.\n' +
        '  Add it to .env.local:\n' +
        '    BFL_API_KEY=...\n' +
        '  Then: npm run images\n' +
        '  (npm run images -- --list works without a key.)',
    );
  }

  let made = 0;
  for (const asset of ASSETS) {
    if (!FORCE && (await exists(asset.path))) {
      console.log(`  · ${asset.path} — already present, skipping`);
      continue;
    }

    process.stdout.write(`  ⟳ ${asset.path} …`);
    const started = Date.now();

    try {
      const bytes = await generateImage({
        prompt: asset.prompt,
        width: asset.width,
        height: asset.height,
        onProgress: (status) => {
          process.stdout.write(`\r  ⟳ ${asset.path} … ${status}          `);
        },
      });

      await mkdir(path.dirname(asset.path), { recursive: true });
      await writeFile(asset.path, bytes);
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`\r  ✓ ${asset.path} — ${(bytes.length / 1024).toFixed(0)}KB in ${secs}s     `);
      made++;
    } catch (err) {
      console.log(`\r  ✗ ${asset.path}`);
      console.error(`      ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n${made > 0 ? '✓' : '·'} ${made} image${made === 1 ? '' : 's'} generated.`);
  if (made > 0) console.log('  Commit them — they are meant to be static.\n');
}

main().catch((e) => die(String(e)));
