import { formatCents } from '@/lib/apy';
import { getDepositorAccount } from '@/lib/depositor/account';
import { getStatements } from '@/lib/depositor/statements';
import { WITHDRAWAL_NOTICE } from '@/lib/depositor/disclosures';
import WithdrawForm from './WithdrawForm';

export const dynamic = 'force-dynamic';

export default async function WithdrawPage() {
  const [acct, statements] = await Promise.all([getDepositorAccount(), getStatements()]);

  // Interest for closed periods has already been paid out to the linked
  // account. What's still withdrawable is the principal plus whatever has
  // accrued in the open period.
  const open = statements.find((s) => s.isPartial);
  const availableCents = acct.principalCents + (open?.interestEarnedCents ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">Withdraw</h1>
        <p className="mt-1 text-[15px]" style={{ color: 'var(--ink-soft)' }}>
          Move money from your savings back to your linked account.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr] md:items-start">
        <WithdrawForm
          availableCents={availableCents}
          linkedAccountMask={acct.linkedAccountMask}
          currentBankName={acct.currentBank?.bankName ?? 'your partner bank'}
          withdrawalNotice={WITHDRAWAL_NOTICE}
        />

        <aside
          className="rounded-2xl border bg-white p-7"
          style={{ borderColor: 'var(--line)' }}
        >
          <div
            className="text-[12px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--ink-faint)' }}
          >
            Available to withdraw
          </div>
          <div className="tnum mt-2 text-[32px] font-bold leading-none tracking-tight">
            {formatCents(availableCents)}
          </div>

          <div className="mt-6 space-y-2.5 text-[14px]">
            <div className="flex justify-between">
              <span style={{ color: 'var(--ink-soft)' }}>Principal</span>
              <span className="tnum font-semibold">{formatCents(acct.principalCents)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--ink-soft)' }}>Interest this period</span>
              <span className="tnum font-semibold" style={{ color: 'var(--gain)' }}>
                {formatCents(open?.interestEarnedCents ?? 0)}
              </span>
            </div>
          </div>

          <div
            className="mt-6 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed"
            style={{ background: 'var(--wash)', color: 'var(--ink-soft)' }}
          >
            Interest from closed statement periods has already been paid to your linked
            account {acct.linkedAccountMask}, so it is not shown here.
          </div>
        </aside>
      </div>
    </div>
  );
}
