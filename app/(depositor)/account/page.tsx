import Link from 'next/link';
import { formatCents, formatPct } from '@/lib/apy';
import { SWEEP_THRESHOLD_APR } from '@/lib/engine';
import { getDepositorAccount, type ActivityKind } from '@/lib/depositor/account';
import { RATE_VARIABILITY_NOTICE } from '@/lib/depositor/disclosures';
import { DayGrid } from '../components/DayGrid';

export const dynamic = 'force-dynamic';

/** Stable colors for the holding timeline — one per bank, reused on return visits. */
const BANK_COLORS = [
  '#1d4ed8', '#0891b2', '#7c3aed', '#c2410c',
  '#047857', '#be123c', '#4338ca', '#a16207',
];

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function fmtShort(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const KIND_LABEL: Record<ActivityKind, { text: string; bg: string; fg: string }> = {
  funding: { text: 'Deposit', bg: '#e0edff', fg: '#0b2a6b' },
  transfer: { text: 'Transfer', bg: '#ede9fe', fg: '#5b21b6' },
  interest: { text: 'Interest', bg: '#d1fae5', fg: '#065f46' },
  withdrawal: { text: 'Withdrawal', bg: '#fee2e2', fg: '#991b1b' },
};

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border bg-white ${className}`}
      style={{ borderColor: 'var(--line)' }}
    >
      {children}
    </section>
  );
}

export default async function AccountHome() {
  const acct = await getDepositorAccount();
  const totalValue = acct.principalCents + acct.interestEarnedCents;
  const vsBaseline = acct.interestEarnedCents - acct.baselineCents;
  const current = acct.currentBank;

  const colorFor = new Map<string, string>();
  [...new Set(acct.holdings.map((h) => h.bankId))].forEach((id, i) =>
    colorFor.set(id, BANK_COLORS[i % BANK_COLORS.length]),
  );

  // The engine holds when the best alternative doesn't clear the transfer cost.
  // Saying so plainly is the difference between a product and a black box.
  const gap = acct.bestAvailableApy - acct.currentApy;
  const holding = gap < SWEEP_THRESHOLD_APR;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">
          Good afternoon, {acct.customerName.split(' ')[0]}.
        </h1>
        <p className="mt-1 text-[15px]" style={{ color: 'var(--ink-soft)' }}>
          Savings account {acct.accountNumberMask} · opened {fmtDate(acct.openedOn)}
        </p>
      </div>

      {/* ---------- Balance + current placement ---------- */}
      <div className="grid gap-4 md:grid-cols-[1.25fr_1fr]">
        <Card className="p-7">
          <div
            className="text-[12px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--ink-faint)' }}
          >
            Total value
          </div>
          <div className="tnum mt-2 text-[44px] font-bold leading-none tracking-tight">
            {formatCents(totalValue)}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-5 text-[14px]">
            <div>
              <div style={{ color: 'var(--ink-faint)' }}>On deposit</div>
              <div className="tnum mt-1 text-[19px] font-semibold">
                {formatCents(acct.principalCents)}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--ink-faint)' }}>Interest earned</div>
              <div className="tnum mt-1 text-[19px] font-semibold" style={{ color: 'var(--gain)' }}>
                {formatCents(acct.interestEarnedCents)}
              </div>
            </div>
          </div>

          <div
            className="mt-6 rounded-xl px-4 py-3 text-[13px] leading-relaxed"
            style={{ background: 'var(--wash)', color: 'var(--ink-soft)' }}
          >
            That&rsquo;s{' '}
            <span className="font-semibold" style={{ color: 'var(--gain)' }}>
              {formatCents(vsBaseline)} more
            </span>{' '}
            than the {formatPct(acct.baselineApr)} a typical branch savings account would
            have paid over the same {acct.daysOpen} days — a blended{' '}
            <span className="tnum font-semibold">{formatPct(acct.blendedApy)}</span> across{' '}
            {acct.holdings.length} placements.
          </div>

          <div className="mt-5 flex gap-3">
            <Link
              href="/account/withdraw"
              className="rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white no-underline"
              style={{ background: 'var(--brand-deep)' }}
            >
              Withdraw
            </Link>
            <Link
              href="/account/statements"
              className="rounded-lg border px-4 py-2.5 text-[14px] font-semibold no-underline"
              style={{ borderColor: 'var(--line)' }}
            >
              Statements
            </Link>
          </div>
        </Card>

        <Card className="p-7">
          <div
            className="text-[12px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--ink-faint)' }}
          >
            Where your money is now
          </div>
          {current && (
            <>
              <div className="mt-3 flex items-start gap-3">
                <span
                  className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                  style={{ background: colorFor.get(current.bankId) }}
                />
                <div>
                  <div className="text-[19px] font-semibold leading-snug">{current.bankName}</div>
                  <div className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
                    {current.productName} · FDIC Cert. #{current.fdicCert ?? 'pending'}
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2.5 text-[14px]">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-soft)' }}>Current rate</span>
                  <span className="tnum font-semibold">{formatPct(acct.currentApy)} APY</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-soft)' }}>Held since</span>
                  <span className="tnum font-semibold">{fmtDate(current.startDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-soft)' }}>Earned here</span>
                  <span className="tnum font-semibold">{formatCents(current.interestCents)}</span>
                </div>
              </div>
            </>
          )}

          <div
            className="mt-6 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed"
            style={{ background: 'var(--wash)', color: 'var(--ink-soft)' }}
          >
            {holding ? (
              <>
                <span className="font-semibold" style={{ color: 'var(--ink)' }}>
                  Holding here for now.
                </span>{' '}
                The best rate we see today is {formatPct(acct.bestAvailableApy)} — only{' '}
                {(gap * 10_000).toFixed(0)} basis points better. A transfer costs 1–3 days of
                interest in settlement, so we don&rsquo;t move for less than{' '}
                {(SWEEP_THRESHOLD_APR * 10_000).toFixed(0)}bp.
              </>
            ) : (
              <>
                <span className="font-semibold" style={{ color: 'var(--ink)' }}>
                  A move is queued.
                </span>{' '}
                We see {formatPct(acct.bestAvailableApy)} available — {(gap * 10_000).toFixed(0)}bp
                better than your current rate. Your deposit transfers on the next business day.
              </>
            )}
          </div>
        </Card>
      </div>

      {/* ---------- The trace ---------- */}
      <Card className="p-7">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[19px] font-semibold tracking-tight">Where your money has been</h2>
          <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
            {acct.holdings.length} placements · {new Set(acct.holdings.map((h) => h.bankId)).size}{' '}
            banks · {acct.daysOpen} days
          </span>
        </div>
        <p className="mt-1.5 text-[14px]" style={{ color: 'var(--ink-soft)' }}>
          Every bank that has held your deposit since you joined, in order.
        </p>

        <div className="mt-6">
          <DayGrid days={acct.days} colorFor={colorFor} />
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr
                className="text-left text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--ink-faint)' }}
              >
                <th className="pb-2.5 pr-3 font-semibold">Bank</th>
                <th className="pb-2.5 pr-3 font-semibold">FDIC cert.</th>
                <th className="pb-2.5 pr-3 font-semibold">Period</th>
                <th className="pb-2.5 pr-3 text-right font-semibold">Days</th>
                <th className="pb-2.5 pr-3 text-right font-semibold">Avg. APY</th>
                <th className="pb-2.5 text-right font-semibold">Interest</th>
              </tr>
            </thead>
            <tbody>
              {acct.holdings.map((h) => (
                <tr
                  key={`${h.bankId}-${h.startDate}`}
                  className="border-t"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: colorFor.get(h.bankId) }}
                      />
                      <span className="font-medium">{h.bankName}</span>
                      {h.isCurrent && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                          style={{ background: '#d1fae5', color: '#065f46' }}
                        >
                          Current
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="tnum py-3 pr-3" style={{ color: 'var(--ink-faint)' }}>
                    #{h.fdicCert ?? '—'}
                  </td>
                  <td className="tnum py-3 pr-3" style={{ color: 'var(--ink-soft)' }}>
                    {fmtShort(h.startDate)} – {h.isCurrent ? 'now' : fmtShort(h.endDate)}
                  </td>
                  <td className="tnum py-3 pr-3 text-right">{h.days}</td>
                  <td className="tnum py-3 pr-3 text-right">{formatPct(h.avgApy)}</td>
                  <td className="tnum py-3 text-right font-semibold">
                    {formatCents(h.interestCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 text-[12px] leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
          {RATE_VARIABILITY_NOTICE}
        </p>
      </Card>

      {/* ---------- Activity ---------- */}
      <Card className="p-7">
        <h2 className="text-[19px] font-semibold tracking-tight">Recent activity</h2>
        <div className="mt-5 divide-y" style={{ borderColor: 'var(--line)' }}>
          {acct.activity.map((row, i) => {
            const k = KIND_LABEL[row.kind];
            return (
              <div
                key={`${row.date}-${i}`}
                className="flex items-start justify-between gap-4 border-t py-3.5 first:border-t-0"
                style={{ borderColor: 'var(--line)' }}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="mt-0.5 shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: k.bg, color: k.fg }}
                  >
                    {k.text}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium">{row.description}</div>
                    <div className="text-[13px] leading-snug" style={{ color: 'var(--ink-faint)' }}>
                      {row.detail}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className="tnum text-[14px] font-semibold"
                    style={{ color: row.kind === 'interest' ? 'var(--gain)' : 'var(--ink)' }}
                  >
                    {row.kind === 'interest' ? '+' : ''}
                    {formatCents(row.amountCents)}
                  </div>
                  <div className="tnum text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                    {fmtShort(row.date)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
