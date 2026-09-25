import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCents, formatPct } from '@/lib/apy';
import { getDepositorAccount } from '@/lib/depositor/account';
import { getStatement, getStatements } from '@/lib/depositor/statements';
import {
  APY_EARNED_EXPLAINER,
  APY_EARNED_TERM,
  ERROR_RESOLUTION_NOTICE,
  FDIC_NON_BANK_NOTICE,
  FEES_NOTICE,
  PASS_THROUGH_NOTICE,
  PROGRAM_LEGAL_NAME,
  RATE_VARIABILITY_NOTICE,
  RECORDKEEPING_NOTICE,
} from '@/lib/depositor/disclosures';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const all = await getStatements();
  return all.map((s) => ({ period: s.period }));
}

function fmt(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
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

function Row({
  label,
  value,
  strong = false,
  positive = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      className="flex items-baseline justify-between border-b py-2.5 last:border-b-0"
      style={{ borderColor: 'var(--line)' }}
    >
      <span className={strong ? 'text-[14px] font-semibold' : 'text-[14px]'} style={{ color: strong ? 'var(--ink)' : 'var(--ink-soft)' }}>
        {label}
      </span>
      <span
        className={`tnum ${strong ? 'text-[16px] font-bold' : 'text-[14px] font-semibold'}`}
        style={{ color: positive ? 'var(--gain)' : 'var(--ink)' }}
      >
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em]"
      style={{ color: 'var(--ink-faint)' }}
    >
      {children}
    </h2>
  );
}

export default async function StatementPage({
  params,
}: {
  params: Promise<{ period: string }>;
}) {
  const { period } = await params;
  const [statement, acct] = await Promise.all([getStatement(period), getDepositorAccount()]);
  if (!statement) notFound();

  return (
    <div className="space-y-5">
      <div className="no-print flex items-center justify-between">
        <Link
          href="/account/statements"
          className="text-[14px] font-medium no-underline hover:underline"
          style={{ color: 'var(--ink-soft)' }}
        >
          ‹ All statements
        </Link>
      </div>

      <article
        className="print-plain rounded-2xl border bg-white"
        style={{ borderColor: 'var(--line)' }}
      >
        {/* ---------- Statement header ---------- */}
        <header
          className="flex flex-wrap items-start justify-between gap-6 border-b px-8 py-7"
          style={{ borderColor: 'var(--line)' }}
        >
          <div>
            <div className="text-[19px] font-bold tracking-tight">AutoSvr Savings</div>
            <div className="mt-0.5 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              {PROGRAM_LEGAL_NAME}
              <br />
              P.O. Box 4412, Denver, CO 80201
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-faint)' }}>
              Periodic statement
            </div>
            <div className="mt-1 text-[17px] font-bold tracking-tight">{statement.label}</div>
            <div className="tnum mt-0.5 text-[13px]" style={{ color: 'var(--ink-soft)' }}>
              {fmt(statement.periodStart)} – {fmt(statement.periodEnd)}
            </div>
          </div>
        </header>

        <div
          className="grid gap-6 border-b px-8 py-6 sm:grid-cols-3"
          style={{ borderColor: 'var(--line)' }}
        >
          <div>
            <SectionTitle>Account holder</SectionTitle>
            <div className="text-[14px] font-semibold">{acct.customerName}</div>
            <div className="tnum text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              Account {acct.accountNumberMask}
            </div>
          </div>
          <div>
            <SectionTitle>Days in period</SectionTitle>
            <div className="tnum text-[14px] font-semibold">{statement.daysInPeriod}</div>
            <div className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              {statement.isPartial ? 'Period still open' : 'Period closed'}
            </div>
          </div>
          <div>
            <SectionTitle>Linked account</SectionTitle>
            <div className="tnum text-[14px] font-semibold">{acct.linkedAccountMask}</div>
            <div className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              Interest destination
            </div>
          </div>
        </div>

        {/* ---------- Reg DD required figures ---------- */}
        <div className="grid gap-8 px-8 py-7 md:grid-cols-2">
          <div>
            <SectionTitle>Summary of this period</SectionTitle>
            <Row label="Beginning balance" value={formatCents(statement.beginningBalanceCents)} />
            <Row label="Deposits" value={formatCents(statement.depositsCents)} />
            <Row label="Withdrawals" value={formatCents(statement.withdrawalsCents)} />
            <Row
              label="Interest earned"
              value={formatCents(statement.interestEarnedCents)}
              positive
            />
            <Row
              label="Ending balance"
              value={formatCents(statement.endingBalanceCents)}
              strong
            />
          </div>

          <div>
            <SectionTitle>Yield</SectionTitle>
            <div
              className="rounded-xl px-5 py-4"
              style={{ background: 'var(--wash)' }}
            >
              <div className="text-[12px] font-semibold" style={{ color: 'var(--ink-soft)' }}>
                {APY_EARNED_TERM}
              </div>
              <div className="tnum mt-1 text-[34px] font-bold leading-none tracking-tight">
                {formatPct(statement.apyEarned)}
              </div>
              <div className="mt-3 space-y-1.5 text-[13px]" style={{ color: 'var(--ink-soft)' }}>
                <div className="flex justify-between">
                  <span>Interest earned</span>
                  <span className="tnum font-semibold">
                    {formatCents(statement.interestEarnedCents)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Average daily balance</span>
                  <span className="tnum font-semibold">
                    {formatCents(statement.averageDailyBalanceCents)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Days in period</span>
                  <span className="tnum font-semibold">{statement.daysInPeriod}</span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
              {APY_EARNED_EXPLAINER}
            </p>
          </div>
        </div>

        {/* ---------- Where the money sat ---------- */}
        <div className="border-t px-8 py-7" style={{ borderColor: 'var(--line)' }}>
          <SectionTitle>Where your deposit was held</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr
                  className="text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--ink-faint)' }}
                >
                  <th className="pb-2 pr-3 font-semibold">Insured bank</th>
                  <th className="pb-2 pr-3 font-semibold">FDIC cert.</th>
                  <th className="pb-2 pr-3 font-semibold">Dates</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Days</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Avg. APY</th>
                  <th className="pb-2 text-right font-semibold">Interest</th>
                </tr>
              </thead>
              <tbody>
                {statement.holdings.map((h) => (
                  <tr key={`${h.bankName}-${h.startDate}`} className="border-t" style={{ borderColor: 'var(--line)' }}>
                    <td className="py-2.5 pr-3 font-medium">
                      {h.bankName}
                      <span className="block text-[12px] font-normal" style={{ color: 'var(--ink-faint)' }}>
                        {h.productName}
                      </span>
                    </td>
                    <td className="tnum py-2.5 pr-3" style={{ color: 'var(--ink-faint)' }}>
                      #{h.fdicCert ?? '—'}
                    </td>
                    <td className="tnum py-2.5 pr-3" style={{ color: 'var(--ink-soft)' }}>
                      {fmtShort(h.startDate)} – {fmtShort(h.endDate)}
                    </td>
                    <td className="tnum py-2.5 pr-3 text-right">{h.days}</td>
                    <td className="tnum py-2.5 pr-3 text-right">{formatPct(h.avgApy)}</td>
                    <td className="tnum py-2.5 text-right font-semibold">
                      {formatCents(h.interestCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
            {RECORDKEEPING_NOTICE}
          </p>
        </div>

        {/* ---------- Transactions (Reg E 1005.9(b)) ---------- */}
        <div className="border-t px-8 py-7" style={{ borderColor: 'var(--line)' }}>
          <SectionTitle>Transactions</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr
                  className="text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--ink-faint)' }}
                >
                  <th className="pb-2 pr-3 font-semibold">Date</th>
                  <th className="pb-2 pr-3 font-semibold">Description</th>
                  <th className="pb-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {statement.transactions.map((t, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: 'var(--line)' }}>
                    <td className="tnum py-2.5 pr-3 align-top" style={{ color: 'var(--ink-soft)' }}>
                      {fmtShort(t.date)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="font-medium">{t.description}</span>
                      <span className="block text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                        {t.detail}
                      </span>
                    </td>
                    <td
                      className="tnum py-2.5 text-right align-top font-semibold"
                      style={{ color: t.signedCents > 0 ? 'var(--gain)' : 'var(--ink-faint)' }}
                    >
                      {t.signedCents === 0 ? '—' : formatCents(t.signedCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px]" style={{ color: 'var(--ink-faint)' }}>
            Transfers between partner banks move your deposit without changing your balance
            and are shown with no amount.
          </p>
        </div>

        {/* ---------- Fees: Reg DD 1030.6(a)(3) ---------- */}
        <div className="border-t px-8 py-7" style={{ borderColor: 'var(--line)' }}>
          <SectionTitle>Fees</SectionTitle>
          {statement.fees.length === 0 ? (
            <p className="text-[13.5px]" style={{ color: 'var(--ink-soft)' }}>
              {FEES_NOTICE}
            </p>
          ) : (
            <div>
              {statement.fees.map((f) => (
                <Row key={f.type} label={f.type} value={formatCents(f.amountCents)} />
              ))}
            </div>
          )}
        </div>

        {/* ---------- Disclosures ---------- */}
        <div
          className="space-y-4 border-t px-8 py-7 text-[12px] leading-relaxed"
          style={{ borderColor: 'var(--line)', color: 'var(--ink-faint)', background: 'var(--wash)' }}
        >
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>
              Deposit insurance
            </div>
            <p className="font-semibold" style={{ color: 'var(--ink-soft)' }}>
              {FDIC_NON_BANK_NOTICE}
            </p>
            <p className="mt-2">{PASS_THROUGH_NOTICE}</p>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>
              Rates
            </div>
            <p>{RATE_VARIABILITY_NOTICE}</p>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>
              {ERROR_RESOLUTION_NOTICE.heading}
            </div>
            {ERROR_RESOLUTION_NOTICE.body.map((p, i) => (
              <p key={i} className="mt-2 first:mt-0">
                {p}
              </p>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
