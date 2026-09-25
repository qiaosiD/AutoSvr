// Monthly statements, built to Regulation DD's periodic-statement rules.
//
// 12 CFR 1030.6(a) requires four things on any periodic statement a depository
// institution sends: the annual percentage yield earned (using that exact
// term), the dollar amount of interest earned, fees itemized by type, and the
// number of days in the period. Reg E, 12 CFR 1005.9(b), adds the transaction
// detail and the error-resolution contact.
//
// AutoSvr is not a depository institution, so Reg DD binds our partner banks
// rather than us directly. We produce statements to its form anyway: the
// customer's yield is a blend across several banks, and no single partner
// bank's statement would ever show them what they actually earned.

import { BANKS_BY_ID } from '../banks';
import { getDashboardData, type DashboardData } from '../data';
import { buildHoldings, type BankHolding } from './account';

export interface StatementFee {
  type: string;
  amountCents: number;
}

export interface StatementTransaction {
  date: string;
  description: string;
  detail: string;
  amountCents: number;
  /** Signed for the customer's benefit: credits positive, debits negative. */
  signedCents: number;
}

/** Where the money sat during this period, and what each stay earned. */
export interface StatementHolding {
  bankName: string;
  productName: string;
  fdicCert: string | null;
  startDate: string;
  endDate: string;
  days: number;
  avgApy: number;
  interestCents: number;
}

export interface Statement {
  /** URL-safe period key, e.g. "2026-07". */
  period: string;
  label: string; // "July 2026"
  periodStart: string;
  periodEnd: string;
  /** 12 CFR 1030.6(a)(4) — days in period. */
  daysInPeriod: number;
  beginningBalanceCents: number;
  endingBalanceCents: number;
  depositsCents: number;
  withdrawalsCents: number;
  /** 12 CFR 1030.6(a)(2) — dollar amount of interest earned. */
  interestEarnedCents: number;
  /** Reg DD Appendix A Part II input: average daily balance. */
  averageDailyBalanceCents: number;
  /** 12 CFR 1030.6(a)(1) — APY earned, annualized over the period. */
  apyEarned: number;
  /** 12 CFR 1030.6(a)(3) — itemized by type, even when empty. */
  fees: StatementFee[];
  holdings: StatementHolding[];
  transactions: StatementTransaction[];
  /** True while the period is still open, so we can label it as such. */
  isPartial: boolean;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function periodLabel(period: string): string {
  const [y, m] = period.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/**
 * Reg DD Appendix A, Part II:
 *
 *   APY Earned = 100 [ (1 + Interest earned / Balance) ^ (365 / Days in period) - 1 ]
 *
 * where Balance is the average daily balance for the period. Returned as a
 * decimal (0.0487), not the regulation's percentage, to match the rest of the
 * codebase.
 */
export function apyEarned(
  interestCents: number,
  averageDailyBalanceCents: number,
  daysInPeriod: number,
): number {
  if (averageDailyBalanceCents <= 0 || daysInPeriod <= 0) return 0;
  const ratio = interestCents / averageDailyBalanceCents;
  return (1 + ratio) ** (365 / daysInPeriod) - 1;
}

/**
 * Group a period's days into per-bank runs, summing the actual daily accruals.
 *
 * An earlier version pro-rated each holding's lifetime interest by the share of
 * days falling inside the period. That drifted by a cent or two per boundary,
 * so the "where your deposit was held" column didn't foot to the interest
 * figure above it. On a statement that is not a rounding nit — it is a customer
 * adding up a column and getting a different number than we printed.
 */
function buildPeriodHoldings(
  days: DashboardData['timeline'],
  reasonByDate: Map<string, string>,
): StatementHolding[] {
  const out: StatementHolding[] = [];

  for (const day of days) {
    const last = out.at(-1);
    if (last && last.bankName === (BANKS_BY_ID.get(day.bankId)?.name ?? day.bankId)) {
      last.endDate = day.date;
      last.days += 1;
      last.interestCents += day.accruedCents;
      last.avgApy += day.apr;
      continue;
    }
    const bank = BANKS_BY_ID.get(day.bankId);
    out.push({
      bankName: bank?.name ?? day.bankId,
      productName: bank?.productName ?? 'Savings',
      fdicCert: bank?.fdicCert ?? null,
      startDate: day.date,
      endDate: day.date,
      days: 1,
      avgApy: day.apr,
      interestCents: day.accruedCents,
    });
  }

  for (const h of out) h.avgApy = h.avgApy / h.days;
  void reasonByDate;
  return out;
}

function buildStatement(
  data: DashboardData,
  holdings: BankHolding[],
  period: string,
  isLastPeriod: boolean,
): Statement {
  const days = data.timeline.filter((d) => d.date.startsWith(period));
  const periodStart = days[0].date;
  const periodEnd = days.at(-1)!.date;
  const interestEarnedCents = days.reduce((sum, d) => sum + d.accruedCents, 0);

  // Principal is constant: interest is paid out to the linked account monthly
  // rather than compounded, so the balance at the partner bank doesn't drift.
  const averageDailyBalanceCents = Math.round(
    days.reduce((sum, d) => sum + d.principalCents, 0) / days.length,
  );
  const beginningBalanceCents = days[0].principalCents;
  const endingBalanceCents = days.at(-1)!.principalCents;

  const reasonByDate = new Map(data.sweeps.map((s) => [s.occurredAt.slice(0, 10), s.reason]));
  const firstHolding = holdings[0];
  const isFirstPeriod = firstHolding?.startDate.startsWith(period) ?? false;

  const transactions: StatementTransaction[] = [];

  if (isFirstPeriod) {
    transactions.push({
      date: firstHolding.startDate,
      description: 'Opening deposit',
      detail: `ACH from linked account ${data.originAccountMask}`,
      amountCents: beginningBalanceCents,
      signedCents: beginningBalanceCents,
    });
  }

  // Internal transfers between partner banks. They net to zero for the
  // customer, so they carry no signed amount — but Reg E expects the movement
  // to be visible, and the customer needs it to follow their own money.
  for (const h of holdings) {
    if (!h.startDate.startsWith(period)) continue;
    if (firstHolding && h.startDate === firstHolding.startDate) continue;
    transactions.push({
      date: h.startDate,
      description: `Transfer to ${h.bankName}`,
      detail: h.reason,
      amountCents: h.principalCents,
      signedCents: 0,
    });
  }

  if (!isLastPeriod) {
    const monthEnd = new Date(`${period}-01T00:00:00Z`);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    monthEnd.setUTCDate(0);
    transactions.push({
      date: monthEnd.toISOString().slice(0, 10),
      description: 'Interest paid',
      detail: `ACH to linked account ${data.originAccountMask}`,
      amountCents: interestEarnedCents,
      signedCents: interestEarnedCents,
    });
  }

  transactions.sort((a, b) => a.date.localeCompare(b.date));

  const statementHoldings = buildPeriodHoldings(days, reasonByDate);

  return {
    period,
    label: periodLabel(period),
    periodStart,
    periodEnd,
    daysInPeriod: days.length,
    beginningBalanceCents,
    endingBalanceCents,
    depositsCents: isFirstPeriod ? beginningBalanceCents : 0,
    withdrawalsCents: 0,
    interestEarnedCents,
    averageDailyBalanceCents,
    apyEarned: apyEarned(interestEarnedCents, averageDailyBalanceCents, days.length),
    // No fee is charged anywhere in the program. Reg DD still wants the line.
    fees: [],
    holdings: statementHoldings,
    transactions,
    isPartial: isLastPeriod,
  };
}

export async function getStatements(customerId = 'cus_demo'): Promise<Statement[]> {
  const data = await getDashboardData(customerId);
  const holdings = buildHoldings(data);

  const periods = [...new Set(data.timeline.map((d) => d.date.slice(0, 7)))].sort();

  return periods
    .map((p, i) => buildStatement(data, holdings, p, i === periods.length - 1))
    .reverse(); // newest first
}

export async function getStatement(
  period: string,
  customerId = 'cus_demo',
): Promise<Statement | null> {
  const all = await getStatements(customerId);
  return all.find((s) => s.period === period) ?? null;
}

export { BANKS_BY_ID };
