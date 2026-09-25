import Link from 'next/link';
import { formatCents, formatPct } from '@/lib/apy';
import { getStatements } from '@/lib/depositor/statements';
import { APY_EARNED_TERM } from '@/lib/depositor/disclosures';

export const dynamic = 'force-dynamic';

function fmt(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function StatementsPage() {
  const statements = await getStatements();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">Statements</h1>
        <p className="mt-1 text-[15px]" style={{ color: 'var(--ink-soft)' }}>
          A statement is issued for each calendar month your account is open.
        </p>
      </div>

      <div className="space-y-3">
        {statements.map((s) => (
          <Link
            key={s.period}
            href={`/account/statements/${s.period}`}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white px-6 py-5 no-underline transition hover:shadow-[0_10px_30px_-18px_rgba(11,27,51,0.4)]"
            style={{ borderColor: 'var(--line)' }}
          >
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-[17px] font-semibold tracking-tight">{s.label}</span>
                {s.isPartial && (
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: '#fef3c7', color: '#92400e' }}
                  >
                    In progress
                  </span>
                )}
              </div>
              <div className="tnum mt-1 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
                {fmt(s.periodStart)} – {fmt(s.periodEnd)} · {s.daysInPeriod} days ·{' '}
                {s.holdings.length} {s.holdings.length === 1 ? 'bank' : 'banks'}
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-faint)' }}>
                  Interest
                </div>
                <div className="tnum text-[16px] font-semibold" style={{ color: 'var(--gain)' }}>
                  {formatCents(s.interestEarnedCents)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-faint)' }}>
                  {APY_EARNED_TERM}
                </div>
                <div className="tnum text-[16px] font-semibold">{formatPct(s.apyEarned)}</div>
              </div>
              <span className="text-[18px]" style={{ color: 'var(--ink-faint)' }}>
                ›
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
