// Deterministic 90-day history so the dashboard has something real to render
// before a single API key exists. Same seed every run, so the demo doesn't
// change shape between rehearsal and stage.

import { BANKS, BASELINE_APR } from '../banks';
import { buildAccrual, decideSweep, SWEEP_THRESHOLD_APR } from '../engine';
import type { Accrual, Customer, RateObservation, SweepEvent } from '../types';

export const DEMO_CUSTOMER: Customer = {
  id: 'cus_demo',
  name: 'Jordan Ellis',
  originAccountMask: '••••4412',
  payoutDestination: 'origin_account',
  principalCents: 4_200_000, // $42,000
};

export const DEMO_DAYS = 90;

/** Small deterministic PRNG — same series on every machine. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/**
 * Rate history for every bank. Each bank drifts around its own base rate, so
 * the leader changes hands a few times over the window — which is the whole
 * reason the product exists.
 */
export function seedRateHistory(): RateObservation[] {
  const rand = mulberry32(20260925);
  // Each bank has its own long-run anchor inside a believable HYSA band.
  // Spreads are tight enough that the leader changes hands several times,
  // which is the only reason a sweep engine is worth building.
  const anchor = new Map(BANKS.map((b, i) => [b.id, 0.0424 + i * 0.0006]));
  const rate = new Map(anchor);
  const out: RateObservation[] = [];

  const REVERSION = 0.04; // pull back toward the anchor each day
  const SIGMA = 0.0023; // daily shock size

  for (let d = DEMO_DAYS; d >= 0; d--) {
    const date = isoDate(d);
    for (const bank of BANKS) {
      const prev = rate.get(bank.id)!;
      // Ornstein-Uhlenbeck step: drift home, plus noise. A pure random walk
      // lets every bank ratchet into the clamp and flatlines the leaderboard.
      const shock = (rand() + rand() + rand() - 1.5) * SIGMA; // ~normal
      const next = prev + REVERSION * (anchor.get(bank.id)! - prev) + shock;
      rate.set(bank.id, Math.min(0.052, Math.max(0.033, next)));

      out.push({
        observedAt: `${date}T09:00:00.000Z`,
        bankId: bank.id,
        bankName: bank.name,
        apy: Number(rate.get(bank.id)!.toFixed(5)),
        minBalanceCents: 0,
        monthlyFeeCents: 0,
        promoExpiresOn: null,
        sourceUrl: 'demo://seed',
        rawBlobId: null,
      });
    }
  }
  return out;
}

export interface DemoHistory {
  rates: RateObservation[];
  sweeps: SweepEvent[];
  accruals: Accrual[];
}

/**
 * Replay the real engine over the seeded rate history. The demo timeline is
 * produced by the same decideSweep() that runs in production — so the
 * threshold behavior you see on stage is the actual behavior.
 */
export function seedHistory(customer: Customer = DEMO_CUSTOMER): DemoHistory {
  const rates = seedRateHistory();
  const byDate = new Map<string, RateObservation[]>();
  for (const r of rates) {
    const date = r.observedAt.slice(0, 10);
    const list = byDate.get(date) ?? [];
    list.push(r);
    byDate.set(date, list);
  }

  const sweeps: SweepEvent[] = [];
  const accruals: Accrual[] = [];
  let currentBankId: string | null = null;
  let currentApr = BASELINE_APR;

  for (const date of [...byDate.keys()].sort()) {
    const todays = byDate.get(date)!;
    const decision = decideSweep(currentBankId, currentApr, todays, customer.principalCents);

    if (decision.shouldMove) {
      sweeps.push({
        occurredAt: `${date}T13:30:00.000Z`,
        customerId: customer.id,
        fromBankId: currentBankId,
        toBankId: decision.targetBankId,
        amountCents: customer.principalCents,
        aprAtMove: decision.targetApr,
        reason: decision.reason,
      });
      currentBankId = decision.targetBankId;
      currentApr = decision.targetApr;
    } else if (currentBankId) {
      // Still there, but that bank's rate may have moved under us.
      const here = todays.find((r) => r.bankId === currentBankId);
      if (here) currentApr = here.apy;
    }

    if (currentBankId) {
      accruals.push(buildAccrual(customer, currentBankId, currentApr, date));
    }
  }

  return { rates, sweeps, accruals };
}

export { SWEEP_THRESHOLD_APR };
