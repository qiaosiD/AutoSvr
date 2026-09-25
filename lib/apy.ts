// The math that makes AutoSvr's pitch checkable.
//
// A customer's money sits at a different bank on different days, earning a
// different APR each day. The honest headline number is not the average of
// those APRs — it's the annualized daily-compounded chain:
//
//   APY = ( PRODUCT over days of (1 + apr_d / 365) ) ^ (365 / nDays) - 1
//
// Averaging the APRs overstates a rising-rate path and understates a falling
// one. Since the whole product is "we move you to the best rate," the
// difference lands exactly where the demo is pointing.

import type { Accrual } from './types';

const DAYS_PER_YEAR = 365;

/** Interest earned in one day at a given APR, rounded to whole cents. */
export function dailyInterestCents(principalCents: number, apr: number): number {
  return Math.round((principalCents * apr) / DAYS_PER_YEAR);
}

/**
 * Blended APY across a sequence of daily APRs.
 * Returns 0 for an empty series rather than NaN.
 */
export function blendedApy(dailyAprs: number[]): number {
  if (dailyAprs.length === 0) return 0;
  const chain = dailyAprs.reduce((acc, apr) => acc * (1 + apr / DAYS_PER_YEAR), 1);
  return chain ** (DAYS_PER_YEAR / dailyAprs.length) - 1;
}

/** Blended APY implied by a customer's accrual history. */
export function blendedApyFromAccruals(accruals: Accrual[]): number {
  const byDate = [...accruals].sort((a, b) => a.date.localeCompare(b.date));
  return blendedApy(byDate.map((a) => a.apr));
}

/**
 * What the customer would have earned over the same period had they left the
 * money in their original savings account. This is the comparison number.
 */
export function counterfactualCents(
  principalCents: number,
  baselineApr: number,
  nDays: number,
): number {
  return dailyInterestCents(principalCents, baselineApr) * nDays;
}

export function formatPct(rate: number, digits = 2): string {
  return `${(rate * 100).toFixed(digits)}%`;
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
