// The daily job: find today's best rate, decide whether to move, accrue
// interest on wherever the money actually sat.

import { BANKS_BY_ID } from './banks';
import { dailyInterestCents } from './apy';
import { closedReason, isBankingDay, nextBankingDay } from './calendar';
import type { Accrual, Customer, RateObservation, SweepEvent } from './types';

/**
 * Moving banks has a real cost: ACH settlement takes 1-3 business days, and
 * money in flight earns nothing. Chasing a 2bp improvement loses money. This
 * threshold is the margin a new bank must beat by before a sweep is worth it.
 */
export const SWEEP_THRESHOLD_APR = 0.0025; // 25 basis points

export interface SweepDecision {
  shouldMove: boolean;
  targetBankId: string;
  targetApr: number;
  currentApr: number;
  reason: string;
}

/** Best eligible rate for a given balance, ignoring accounts they'd fail to qualify for. */
export function bestRate(
  observations: RateObservation[],
  balanceCents: number,
): RateObservation | null {
  const eligible = observations
    .filter((o) => o.minBalanceCents <= balanceCents)
    .filter((o) => o.monthlyFeeCents === 0)
    .filter((o) => BANKS_BY_ID.has(o.bankId));
  if (eligible.length === 0) return null;
  return eligible.reduce((best, o) => (o.apy > best.apy ? o : best));
}

export function decideSweep(
  currentBankId: string | null,
  currentApr: number,
  observations: RateObservation[],
  balanceCents: number,
  /** The day the decision is being made. Defaults to today. */
  date: string = new Date().toISOString().slice(0, 10),
): SweepDecision {
  // ACH only moves money on days the Federal Reserve is open. Deciding to
  // transfer on a Saturday produces a settlement date that cannot happen and a
  // statement claiming a transfer landed on a weekend. Hold instead — the next
  // run on a banking day re-evaluates and moves then if it still pays. No queue
  // is needed, because the decision is re-derived from scratch every day.
  if (!isBankingDay(date)) {
    return {
      shouldMove: false,
      targetBankId: currentBankId ?? '',
      targetApr: currentApr,
      currentApr,
      reason: `Banks closed for ${closedReason(date)} — ACH resumes ${nextBankingDay(date)}`,
    };
  }

  const best = bestRate(observations, balanceCents);

  if (!best) {
    return {
      shouldMove: false,
      targetBankId: currentBankId ?? '',
      targetApr: currentApr,
      currentApr,
      reason: 'No eligible rate found in today’s crawl',
    };
  }

  if (best.bankId === currentBankId) {
    return {
      shouldMove: false,
      targetBankId: best.bankId,
      targetApr: best.apy,
      currentApr,
      reason: 'Already at the top rate',
    };
  }

  const gain = best.apy - currentApr;
  if (gain < SWEEP_THRESHOLD_APR) {
    return {
      shouldMove: false,
      targetBankId: currentBankId ?? '',
      targetApr: currentApr,
      currentApr,
      reason: `Best alternative is only +${(gain * 10_000).toFixed(0)}bp — under the ${(
        SWEEP_THRESHOLD_APR * 10_000
      ).toFixed(0)}bp settlement-cost threshold`,
    };
  }

  // No current bank means this is the initial placement, not a competitive
  // move — describing it as beating the old savings account by 400+bp is true
  // but reads strangely in the move log.
  const reason = currentBankId
    ? `${best.bankName} at ${(best.apy * 100).toFixed(2)}% beats current by ${(
        gain * 10_000
      ).toFixed(0)}bp`
    : `Initial placement at the top rate, ${(best.apy * 100).toFixed(2)}%`;

  return {
    shouldMove: true,
    targetBankId: best.bankId,
    targetApr: best.apy,
    currentApr,
    reason,
  };
}

export function buildSweep(
  customer: Customer,
  fromBankId: string | null,
  decision: SweepDecision,
  at = new Date(),
): SweepEvent {
  return {
    occurredAt: at.toISOString(),
    customerId: customer.id,
    fromBankId,
    toBankId: decision.targetBankId,
    amountCents: customer.principalCents,
    aprAtMove: decision.targetApr,
    reason: decision.reason,
  };
}

export function buildAccrual(
  customer: Customer,
  bankId: string,
  apr: number,
  date: string,
): Accrual {
  return {
    date,
    customerId: customer.id,
    bankId,
    principalCents: customer.principalCents,
    apr,
    accruedCents: dailyInterestCents(customer.principalCents, apr),
  };
}
