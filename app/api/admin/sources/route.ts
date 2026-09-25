// Manage the partner-bank list the daily job crawls.

import { NextResponse } from 'next/server';
import { listSources, upsertSource, disableSource } from '@/lib/sources/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ sources: await listSources() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: { url?: unknown; label?: unknown; waitFor?: unknown; id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  if (typeof body.url !== 'string' || !body.url.trim()) {
    return NextResponse.json({ error: 'A url is required' }, { status: 400 });
  }

  try {
    const source = await upsertSource({
      id: typeof body.id === 'string' ? body.id : undefined,
      url: body.url,
      label: typeof body.label === 'string' ? body.label : undefined,
      waitFor: typeof body.waitFor === 'string' ? body.waitFor : undefined,
    });
    return NextResponse.json({ source });
  } catch (err) {
    // A malformed URL is the caller's mistake, not a server fault.
    const message = err instanceof Error ? err.message : String(err);
    const bad = message.includes('Invalid URL') || message.includes('can be crawled');
    return NextResponse.json({ error: message }, { status: bad ? 400 : 500 });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'An id is required' }, { status: 400 });

  try {
    await disableSource(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
