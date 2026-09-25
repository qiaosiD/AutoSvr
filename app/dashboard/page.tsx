import { formatCents, formatPct } from '@/lib/apy';
import { bankName, BANKS_BY_ID } from '@/lib/banks';
import Link from 'next/link';
import { getDashboardData } from '@/lib/data';
import { Timeline } from '../components/Timeline';

export const dynamic = 'force-dynamic';

function Stat({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white/5 p-5 ring-1 ring-white/10">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${accent ? 'text-emerald-400' : ''}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-sm text-zinc-400">{sub}</div>}
    </div>
  );
}

export default async function Page() {
  const d = await getDashboardData();
  const uplift = d.totalAccruedCents - d.baselineCents;
  const currentBank = BANKS_BY_ID.get(d.currentBankId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AutoSvr</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {d.customerName} · linked account {d.originAccountMask} · interest to{' '}
            {d.payoutDestination === 'origin_account' ? 'your savings account' : 'your AutoSvr balance'}
          </p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-400/30">
            Sandbox — simulated funds
          </span>
          <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400 ring-1 ring-white/10">
            {d.live ? 'Live data' : 'Seeded demo data'}
          </span>
          <Link
            href="/connect"
            className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-zinc-950 transition hover:bg-emerald-400"
          >
            Link an account
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Balance" value={formatCents(d.principalCents)} sub={`${d.daysInvested} days invested`} />
        <Stat
          label="Interest earned"
          value={formatCents(d.totalAccruedCents)}
          sub={`vs ${formatCents(d.baselineCents)} at your old bank`}
          accent
        />
        <Stat
          label="Your blended APY"
          value={formatPct(d.blendedApy)}
          sub={`since ${d.timeline[0]?.date} · ${d.sweeps.length} moves`}
        />
        <Stat
          label="Today"
          value={formatPct(d.currentApr)}
          sub={currentBank ? `${currentBank.name} · FDIC #${currentBank.fdicCert}` : bankName(d.currentBankId)}
        />
      </section>

      <section className="mt-6 rounded-xl bg-emerald-400/5 p-5 ring-1 ring-emerald-400/20">
        <p className="text-sm text-zinc-300">
          You earned{' '}
          <strong className="text-emerald-400">{formatCents(uplift)} more</strong> than you would
          have leaving it at {formatPct(d.baselineApr)} — a blended{' '}
          <strong className="text-emerald-400">{formatPct(d.blendedApy)}</strong> across{' '}
          {d.sweeps.length} bank {d.sweeps.length === 1 ? 'move' : 'moves'}.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Where your money has been
        </h2>
        <Timeline timeline={d.timeline} />
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Today&rsquo;s best rates
          </h2>
          <ul className="space-y-1">
            {d.leaderboard.slice(0, 6).map((row, i) => (
              <li
                key={row.bankId}
                className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2.5 text-sm ring-1 ring-white/5"
              >
                <span className="flex items-center gap-3">
                  <span className="w-4 text-xs text-zinc-600 tabular-nums">{i + 1}</span>
                  {row.bankName}
                  {row.bankId === d.currentBankId && (
                    <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                      YOUR MONEY
                    </span>
                  )}
                </span>
                <span className="font-medium tabular-nums">{formatPct(row.apy)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Move log
          </h2>
          <ul className="space-y-2">
            {d.sweeps.slice(0, 6).map((s) => (
              <li key={s.occurredAt} className="rounded-lg bg-white/5 px-4 py-3 text-sm ring-1 ring-white/5">
                <div className="flex items-baseline justify-between gap-3">
                  <span>
                    {s.fromBankId ? `${bankName(s.fromBankId)} → ` : 'Funded → '}
                    <strong>{bankName(s.toBankId)}</strong>
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {s.occurredAt.slice(0, 10)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-zinc-400">{s.reason}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="mt-16 border-t border-white/10 pt-6 text-xs leading-relaxed text-zinc-500">
        AutoSvr holds pooled deposits in an omnibus (FBO) account at partner banks. Balances shown
        are simulated for this demo; no real funds move. In production this structure requires a
        partner bank and per-bank deposit agreements.
      </footer>
    </main>
  );
}
