// Single read path for the dashboard. Live Tinybird when a token is present,
// the deterministic seed otherwise — same shape either way, so the UI never
// knows which one it got and the demo never shows an empty state.

import { blendedApy } from './apy';
import { BASELINE_APR } from './banks';
import { DEMO_CUSTOMER, seedHistory } from './demo/seed';
import { query, tinybirdConfigured } from './tinybird';

export interface TimelineDay {
  date: string;
  bankId: string;
  apr: number;
  principalCents: number;
  accruedCents: number;
  cumulativeCents: number;
}

export interface SweepRow {
  occurredAt: string;
  fromBankId: string | null;
  toBankId: string;
  amountCents: number;
  aprAtMove: number;
  reason: string;
}

export interface LeaderRow {
  bankId: string;
  bankName: string;
  apy: number;
  sourceUrl: string;
}

export interface DashboardData {
  live: boolean;
  customerName: string;
  originAccountMask: string;
  payoutDestination: string;
  principalCents: number;
  daysInvested: number;
  totalAccruedCents: number;
  blendedApy: number;
  currentBankId: string;
  currentApr: number;
  baselineApr: number;
  baselineCents: number;
  timeline: TimelineDay[];
  sweeps: SweepRow[];
  leaderboard: LeaderRow[];
}

function fromSeed(): DashboardData {
  const { rates, sweeps, accruals } = seedHistory();

  let cumulative = 0;
  const timeline: TimelineDay[] = accruals.map((a) => {
    cumulative += a.accruedCents;
    return {
      date: a.date,
      bankId: a.bankId,
      apr: a.apr,
      principalCents: a.principalCents,
      accruedCents: a.accruedCents,
      cumulativeCents: cumulative,
    };
  });

  const last = timeline.at(-1);
  const latestDate = rates.at(-1)!.observedAt.slice(0, 10);
  const leaderboard = rates
    .filter((r) => r.observedAt.startsWith(latestDate))
    .sort((a, b) => b.apy - a.apy)
    .map((r) => ({ bankId: r.bankId, bankName: r.bankName, apy: r.apy, sourceUrl: r.sourceUrl }));

  const days = timeline.length;

  return {
    live: false,
    customerName: DEMO_CUSTOMER.name,
    originAccountMask: DEMO_CUSTOMER.originAccountMask,
    payoutDestination: DEMO_CUSTOMER.payoutDestination,
    principalCents: DEMO_CUSTOMER.principalCents,
    daysInvested: days,
    totalAccruedCents: cumulative,
    blendedApy: blendedApy(timeline.map((t) => t.apr)),
    currentBankId: last?.bankId ?? '',
    currentApr: last?.apr ?? 0,
    baselineApr: BASELINE_APR,
    baselineCents: Math.round((DEMO_CUSTOMER.principalCents * BASELINE_APR * days) / 365),
    timeline,
    sweeps: sweeps.slice().reverse(),
    leaderboard,
  };
}

export async function getDashboardData(customerId = 'cus_demo'): Promise<DashboardData> {
  if (!tinybirdConfigured()) return fromSeed();

  try {
    const [summaryRows, timeline, sweeps, leaderboard] = await Promise.all([
      query<{
        daysInvested: number;
        totalAccruedCents: number;
        principalCents: number;
        currentBankId: string;
        currentApr: number;
        blendedApy: number;
      }>('accrued_summary', { customerId }),
      query<TimelineDay>('customer_timeline', { customerId }),
      query<SweepRow>('sweep_log', { customerId }),
      query<LeaderRow>('best_rate_today'),
    ]);

    const s = summaryRows[0];
    if (!s || s.daysInvested === 0) return fromSeed();

    const seed = fromSeed();
    return {
      ...seed,
      live: true,
      principalCents: s.principalCents,
      daysInvested: s.daysInvested,
      totalAccruedCents: s.totalAccruedCents,
      blendedApy: s.blendedApy,
      currentBankId: s.currentBankId,
      currentApr: s.currentApr,
      baselineCents: Math.round((s.principalCents * BASELINE_APR * s.daysInvested) / 365),
      timeline,
      sweeps,
      leaderboard,
    };
  } catch (err) {
    console.error('[data] Tinybird read failed, falling back to seed:', err);
    return fromSeed();
  }
}
