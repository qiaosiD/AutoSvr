// Swappable landing zone for raw crawl payloads.
//
// Every bank page comes back a different shape, so the raw blob is stored
// before anything tries to interpret it. When a rate looks wrong on stage you
// can go back to the exact bytes that produced it.
//
//   RAW_SINK=file     -> ./.raw/<id>.json   (default, zero setup)
//   RAW_SINK=rawtree  -> RawTree            (schemaless, SQL-queryable)

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface RawBlob {
  id: string;
  sourceId: string;
  url: string;
  fetchedAt: string;
  body: string;
}

export interface RawSink {
  put(blob: Omit<RawBlob, 'id'>): Promise<string>;
}

/**
 * Serverless filesystems are read-only apart from the temp directory, so
 * writing to the project directory throws in production. Fall back to tmp
 * there — but tmp does not survive between invocations, so blobs written on a
 * deployed cron run are for same-run debugging only. Set RAW_SINK=rawtree if
 * you need them to persist.
 */
const isServerless = Boolean(process.env.VERCEL ?? process.env.AWS_LAMBDA_FUNCTION_NAME);
let warnedEphemeral = false;

const fileSink: RawSink = {
  async put(blob) {
    const id = randomUUID();

    if (isServerless && !warnedEphemeral) {
      warnedEphemeral = true;
      console.warn(
        '[rawSink] Writing crawl blobs to a temp directory; they will not survive ' +
          'this invocation. Set RAW_SINK=rawtree to retain them.',
      );
    }

    const dir = isServerless
      ? path.join(os.tmpdir(), 'autosvr-raw')
      : path.join(process.cwd(), '.raw');

    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${id}.json`), JSON.stringify({ id, ...blob }, null, 2));
    } catch (err) {
      // Losing a debugging artifact must never fail the crawl that produced it.
      console.error('[rawSink] Could not persist raw blob:', err);
    }

    return id;
  },
};

const rawTreeSink: RawSink = {
  async put(blob) {
    const id = randomUUID();
    const res = await fetch('https://api.rawtree.com/v1/insert', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.RAWTREE_API_KEY}`,
      },
      body: JSON.stringify({
        database: process.env.RAWTREE_DATABASE ?? 'autosvr',
        table: 'raw_crawls',
        rows: [{ id, ...blob }],
      }),
    });
    if (!res.ok) throw new Error(`RawTree insert failed: ${res.status} ${await res.text()}`);
    return id;
  },
};

export function getRawSink(): RawSink {
  return process.env.RAW_SINK === 'rawtree' && process.env.RAWTREE_API_KEY
    ? rawTreeSink
    : fileSink;
}
