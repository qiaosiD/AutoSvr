import Link from 'next/link';
import { CrawlConsole } from './CrawlConsole';
import { nimbleConfigured } from '@/lib/rates/nimble';
import { liquidConfigured } from '@/lib/rates/parse';
import { canParseWithSelectors } from '@/lib/rates/selectors';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Crawl console — AutoSvr' };

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs ring-1 ${
        ok
          ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30'
          : 'bg-amber-400/10 text-amber-300 ring-amber-400/30'
      }`}
    >
      {label}
    </span>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Crawl console</h1>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Dashboard
          </Link>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Point Nimble at any bank&rsquo;s rate page and see what comes back: what
          was fetched, which parser read it, and whether the result is eligible
          for a sweep. Nothing here writes to the ledger — the daily job owns
          that.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill ok={nimbleConfigured()} label={nimbleConfigured() ? 'Nimble ready' : 'NIMBLE_API_KEY missing'} />
          <Pill ok={liquidConfigured()} label={liquidConfigured() ? 'Liquid ready' : 'Liquid not configured'} />
          <Pill ok label="Selectors: depositaccounts" />
        </div>
      </header>

      <CrawlConsole />

      <footer className="mt-12 border-t border-white/10 pt-6 text-xs leading-relaxed text-zinc-500">
        Pages with no hand-written selectors are read by the model, and every
        rate it reports is checked against the page before it is shown — a small
        model will otherwise return figures that look right and appear nowhere in
        the source. Anything it invents is discarded rather than displayed.
        {canParseWithSelectors('depositaccounts') && (
          <> DepositAccounts has selectors and is parsed deterministically.</>
        )}
      </footer>
    </main>
  );
}
