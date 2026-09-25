// The depositor's view of their own money.
//
// The ops dashboard in lib/data.ts answers "is the engine working?". This
// answers "where is my money and what has it done?" — same underlying history,
// read through a customer's eyes. Nothing here mutates: it derives holdings and
// activity from the sweep and accrual record.

import { BANKS_BY_ID, BASELINE_APR } from '../banks';
import { blendedApy } from '../apy';
import { getDashboardData, type DashboardData } from '../data';

/** One continuous stretch of time during which one bank held the money. */
export interface BankHolding {
  bankId: string;
  bankName: string;
  productName: string;
  fdicCert: string | null;
  startDate: string; // YYYY-MM-DD, first day this bank held the money
  endDate: string; // YYYY-MM-DD, last day (today, if current)
  days: number;
  avgApy: number;
  interestCents: number;
  principalCents: number;
  isCurrent: boolean;
  /** Why the money landed here, from the engine's own decision log. */
  reason: string;
}

/** One calendar day: which bank held the money, at what rate, earning what. */
export interface DayCell {
  date: string; // YYYY-MM-DD
  bankId: string;
  bankName: string;
  apr: number;
  accruedCents: number;
  /** True on the day a transfer landed, so the grid can mark the handoff. */
  isMoveDay: boolean;
}

export type ActivityKind = 'funding' | 'transfer' | 'interest' | 'withdrawal';

export interface ActivityRow {
  date: string; // YYYY-MM-DD
  kind: ActivityKind;
  description: string;
  detail: string;
  amountCents: number;
  /** Balance held at a partner bank after this entry. */
  balanceCents: number;
}

export interface DepositorAccount {
  live: boolean;
  customerName: string;
  accountNumberMask: string;
  linkedAccountMask: string;
  /** Principal on deposit at a partner bank. Interest is swept to the linked account. */
  principalCents: number;
  /** Interest earned since joining, across every bank. */
  interestEarnedCents: number;
  /** What the same money would have earned at the national-average rate. */
  baselineCents: number;
  openedOn: string;
  daysOpen: number;
  currentApy: number;
  blendedApy: number;
  baselineApr: number;
  currentBank: BankHolding | null;
  holdings: BankHolding[]; // newest first
  /** Every day since opening, oldest first. Drives the day-by-day grid. */
  days: DayCell[];
  activity: ActivityRow[]; // newest first
  /** Today's best available rate across the monitored banks. */
  bestAvailableApy: number;
  partnerBankCount: number;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * Collapse the daily accrual record into holding periods, one per bank visit.
 * A bank the money returns to later gets a separate entry — the customer needs
 * to see each stay, not a lifetime total per bank.
 */
export function buildHoldings(data: DashboardData): BankHolding[] {
  const reasonByDate = new Map(data.sweeps.map((s) => [s.occurredAt.slice(0, 10), s.reason]));
  const holdings: BankHolding[] = [];

  for (const day of data.timeline) {
    const last = holdings.at(-1);
    if (last && last.bankId === day.bankId) {
      last.endDate = day.date;
      last.days += 1;
      last.interestCents += day.accruedCents;
      last.avgApy += day.apr;
      continue;
    }
    const bank = BANKS_BY_ID.get(day.bankId);
    holdings.push({
      bankId: day.bankId,
      bankName: bank?.name ?? day.bankId,
      productName: bank?.productName ?? 'Savings',
      fdicCert: bank?.fdicCert ?? null,
      startDate: day.date,
      endDate: day.date,
      days: 1,
      avgApy: day.apr,
      interestCents: day.accruedCents,
      principalCents: day.principalCents,
      isCurrent: false,
      reason: reasonByDate.get(day.date) ?? 'Moved to the top available rate',
    });
  }

  // avgApy accumulated a sum above; turn it into the mean for each stay.
  for (const h of holdings) h.avgApy = h.avgApy / h.days;
  const last = holdings.at(-1);
  if (last) last.isCurrent = true;

  return holdings;
}

/**
 * The ledger a customer actually reads. Interest is paid out monthly to the
 * linked account rather than compounded, which is what the engine does — so
 * the running balance at the partner bank stays at principal.
 */
export function buildActivity(data: DashboardData, holdings: BankHolding[]): ActivityRow[] {
  const rows: ActivityRow[] = [];
  const principal = data.principalCents;

  holdings.forEach((h, i) => {
    if (i === 0) {
      rows.push({
        date: h.startDate,
        kind: 'funding',
        description: 'Opening deposit',
        detail: `From your linked account ${data.originAccountMask} to ${h.bankName}`,
        amountCents: principal,
        balanceCents: principal,
      });
    } else {
      const from = holdings[i - 1];
      rows.push({
        date: h.startDate,
        kind: 'transfer',
        description: `Transferred to ${h.bankName}`,
        detail: h.reason,
        amountCents: principal,
        balanceCents: principal,
      });
      void from;
    }
  });

  // Interest credited at the end of each calendar month covered by the history.
  const byMonth = new Map<string, number>();
  for (const day of data.timeline) {
    const month = day.date.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + day.accruedCents);
  }
  const lastDate = data.timeline.at(-1)?.date ?? '';
  for (const [month, cents] of byMonth) {
    const monthEnd = new Date(`${month}-01T00:00:00Z`);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    monthEnd.setUTCDate(0);
    const paidOn = monthEnd.toISOString().slice(0, 10);
    // The current month hasn't closed yet — that interest is still accruing.
    if (paidOn >= lastDate) continue;
    rows.push({
      date: paidOn,
      kind: 'interest',
      description: 'Interest paid',
      detail: `Credited to your linked account ${data.originAccountMask}`,
      amountCents: cents,
      balanceCents: principal,
    });
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getDepositorAccount(customerId = 'cus_demo'): Promise<DepositorAccount> {
  const data = await getDashboardData(customerId);
  const holdings = buildHoldings(data);
  const activity = buildActivity(data, holdings);
  const moveDates = new Set(data.sweeps.map((s) => s.occurredAt.slice(0, 10)));
  const days: DayCell[] = data.timeline.map((d) => ({
    date: d.date,
    bankId: d.bankId,
    bankName: BANKS_BY_ID.get(d.bankId)?.name ?? d.bankId,
    apr: d.apr,
    accruedCents: d.accruedCents,
    isMoveDay: moveDates.has(d.date),
  }));
  const openedOn = data.timeline[0]?.date ?? '';
  const lastDate = data.timeline.at(-1)?.date ?? openedOn;

  return {
    live: data.live,
    customerName: data.customerName,
    // Deterministic display number for the demo customer. Never a real account.
    accountNumberMask: '••••••8317',
    linkedAccountMask: data.originAccountMask,
    principalCents: data.principalCents,
    interestEarnedCents: data.totalAccruedCents,
    baselineCents: data.baselineCents,
    openedOn,
    daysOpen: openedOn ? daysBetween(openedOn, lastDate) : 0,
    currentApy: data.currentApr,
    blendedApy: data.blendedApy,
    baselineApr: BASELINE_APR,
    currentBank: holdings.at(-1) ?? null,
    holdings: holdings.slice().reverse(),
    days,
    activity,
    bestAvailableApy: data.leaderboard[0]?.apy ?? data.currentApr,
    partnerBankCount: BANKS_BY_ID.size,
  };
}

export { addDays, daysBetween, blendedApy };
