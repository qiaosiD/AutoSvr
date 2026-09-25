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

const fileSink: RawSink = {
  async put(blob) {
    const id = randomUUID();
    const dir = path.join(process.cwd(), '.raw');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${id}.json`), JSON.stringify({ id, ...blob }, null, 2));
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
