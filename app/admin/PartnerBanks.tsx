'use client';

import { useEffect, useState } from 'react';
import type { PartnerSource } from '@/lib/sources/store';

export function PartnerBanks({ onCrawl }: { onCrawl?: (urls: string[]) => void }) {
  const [sources, setSources] = useState<PartnerSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [waitFor, setWaitFor] = useState('');

  async function load() {
    try {
      const res = await fetch('/api/admin/sources', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not load partner banks');
      setSources(body.sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, label, waitFor }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not save');
      setUrl(''); setLabel(''); setWaitFor('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/sources?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not remove');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="rounded-xl bg-white/5 p-6 ring-1 ring-white/10">
      <div className="mb-1 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
          Partner banks
        </h2>
        {sources.length > 0 && onCrawl && (
          <button
            onClick={() => onCrawl(sources.slice(0, 5).map((s) => s.url))}
            className="text-xs text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
          >
            Crawl these now
          </button>
        )}
      </div>
      <p className="mb-5 text-xs leading-relaxed text-zinc-500">
        The pages the daily job crawls. Changes take effect on the next run — no
        deploy needed. Removing a bank keeps its history; it just stops being
        crawled.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300 ring-1 ring-rose-500/30">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : sources.length === 0 ? (
        <p className="mb-5 text-sm text-zinc-500">
          No partner banks configured yet. Add one below.
        </p>
      ) : (
        <ul className="mb-5 divide-y divide-white/5">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center gap-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{s.label}</span>
                <span className="block truncate font-mono text-[11px] text-zinc-600">
                  {s.url}
                  {s.waitFor && <span className="text-zinc-700"> · waits for {s.waitFor}</span>}
                </span>
              </span>
              <button
                onClick={() => remove(s.id)}
                className="shrink-0 rounded px-2 py-1 text-xs text-zinc-600 transition hover:bg-rose-500/10 hover:text-rose-300"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://bank.example.com/savings"
            spellCheck={false}
            className="w-full rounded-lg bg-black/30 px-3 py-2 font-mono text-[13px] outline-none ring-1 ring-white/10 placeholder:text-zinc-700 focus:ring-emerald-500/50"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Name (optional — defaults to the domain)"
              className="rounded-lg bg-black/30 px-3 py-2 text-[13px] outline-none ring-1 ring-white/10 placeholder:text-zinc-700 focus:ring-emerald-500/50"
            />
            <input
              value={waitFor}
              onChange={(e) => setWaitFor(e.target.value)}
              placeholder="Wait-for selector (optional)"
              spellCheck={false}
              className="rounded-lg bg-black/30 px-3 py-2 font-mono text-[13px] outline-none ring-1 ring-white/10 placeholder:text-zinc-700 focus:ring-emerald-500/50"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving || !url.trim()}
          className="h-fit rounded-lg bg-emerald-500 px-5 py-2 text-sm font-medium text-zinc-950 transition enabled:hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {saving ? 'Adding…' : 'Add bank'}
        </button>
      </form>
    </section>
  );
}
