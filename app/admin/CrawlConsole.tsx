'use client';

import { useState } from 'react';
import { formatCents, formatPct } from '@/lib/apy';
import type { CrawlMessage, CrawlReport } from '../api/admin/crawl/route';

const SLOTS = 5;

/** A few real HYSA pages, so the console is usable without hunting for URLs. */
const EXAMPLES = [
  'https://www.depositaccounts.com/savings/',
  'https://www.ally.com/bank/online-savings-account/',
  'https://www.marcus.com/us/en/savings/high-yield-savings',
  'https://www.synchronybank.com/banking/high-yield-savings/',
  'https://www.discover.com/online-banking/savings-account/',
];

export function CrawlConsole() {
  const [urls, setUrls] = useState<string[]>(Array(SLOTS).fill(''));
  const [waitFor, setWaitFor] = useState('');
  const [running, setRunning] = useState(false);
  const [reports, setReports] = useState<CrawlReport[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const filled = urls.map((u) => u.trim()).filter(Boolean);

  async function run() {
    setRunning(true);
    setError(null);
    setReports([]);
    setPending(filled);

    try {
      const res = await fetch('/api/admin/crawl', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ urls: filled, waitFor: waitFor.trim() || undefined }),
      });

      // Errors come back as plain JSON rather than a stream.
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      if (!res.body) throw new Error('The server returned no stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // NDJSON: a chunk may split a line, so hold the remainder until the
      // next read completes it.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          let msg: CrawlMessage;
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }
          if (msg.type === 'report') {
            setReports((prev) => [...prev, msg.report]);
            setPending((prev) => prev.filter((u) => u !== msg.report.url));
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      setPending([]);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl bg-white/5 p-6 ring-1 ring-white/10">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
            Pages to crawl
          </h2>
          <button
            onClick={() => setUrls(EXAMPLES)}
            className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
          >
            Fill with examples
          </button>
        </div>

        <div className="space-y-2">
          {urls.map((url, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-4 shrink-0 text-xs tabular-nums text-zinc-600">{i + 1}</span>
              <input
                value={url}
                onChange={(e) => {
                  const next = [...urls];
                  next[i] = e.target.value;
                  setUrls(next);
                }}
                placeholder="https://bank.example.com/savings"
                spellCheck={false}
                className="w-full rounded-lg bg-black/30 px-3 py-2 font-mono text-[13px] outline-none ring-1 ring-white/10 placeholder:text-zinc-700 focus:ring-emerald-500/50"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={waitFor}
            onChange={(e) => setWaitFor(e.target.value)}
            placeholder="Optional: CSS selector to wait for, e.g. .apy"
            spellCheck={false}
            className="min-w-[18rem] flex-1 rounded-lg bg-black/30 px-3 py-2 font-mono text-[13px] outline-none ring-1 ring-white/10 placeholder:text-zinc-700 focus:ring-emerald-500/50"
          />
          <button
            onClick={run}
            disabled={running || filled.length === 0}
            className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-medium text-zinc-950 transition enabled:hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {running ? 'Crawling…' : `Crawl ${filled.length || ''}`.trim()}
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          Rate tables usually render after first paint, so a crawl that returns
          too early captures the page chrome and no rates. The selector above is
          what Nimble waits for — leave it blank and it falls back to waiting for
          the page to settle, which is less reliable on heavy pages.
        </p>
      </section>

      {error && (
        <div className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300 ring-1 ring-rose-500/30">
          {error}
        </div>
      )}

      {reports.map((r) => <Report key={r.url} report={r} />)}

      {pending.map((url) => (
        <section
          key={url}
          className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-5 py-4 ring-1 ring-white/5"
        >
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400" />
          <span className="truncate font-mono text-[13px] text-zinc-500">{url}</span>
          <span className="ml-auto shrink-0 text-xs text-zinc-600">rendering…</span>
        </section>
      ))}

      {running && reports.length === 0 && pending.length === 0 && (
        <p className="text-sm text-zinc-400">Starting…</p>
      )}
    </div>
  );
}

function Report({ report: r }: { report: CrawlReport }) {
  const rates = [...(r.rates ?? [])].sort((a, b) => b.apy - a.apy);

  return (
    <section className="rounded-xl bg-white/5 ring-1 ring-white/10">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 px-5 py-3">
        <span className="truncate font-mono text-[13px] text-zinc-300">{r.url}</span>
        <span className="flex shrink-0 items-center gap-3 text-xs text-zinc-500">
          {(r.durationMs / 1000).toFixed(1)}s
          {r.contentChars != null && <>· {r.contentChars.toLocaleString()} chars {r.format}</>}
          {r.parser && <>· parsed by {r.parser}</>}
        </span>
      </header>

      <div className="px-5 py-4">
        {!r.ok ? (
          <p className="text-sm text-rose-300">{r.error}</p>
        ) : rates.length === 0 ? (
          <p className="text-sm text-amber-300">
            Crawled successfully but no rates were extracted. The page may render
            its rates behind an interaction, or state them in a form the parser
            does not recognise — try a wait selector.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="pb-2 font-medium">Bank</th>
                <th className="pb-2 font-medium">Deposit insurance</th>
                <th className="pb-2 text-right font-medium">Min</th>
                <th className="pb-2 text-right font-medium">APY</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate, i) => (
                <tr key={`${rate.bankName}-${i}`} className="border-b border-white/5">
                  <td className="py-2">{rate.bankName}</td>
                  <td className="py-2 text-xs">
                    {rate.insured ? (
                      <span className="text-zinc-400">{rate.insurer}</span>
                    ) : (
                      <span className="text-amber-400">
                        {rate.insurer ?? 'not stated'} — ineligible
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums text-zinc-400">
                    {formatCents(rate.minBalanceCents)}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {formatPct(rate.apy)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {r.rawBlobId && (
          <p className="mt-3 font-mono text-[11px] text-zinc-600">
            raw blob {r.rawBlobId}
          </p>
        )}
      </div>
    </section>
  );
}
