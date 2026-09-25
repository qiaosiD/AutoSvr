// Core domain types for AutoSvr.
// Money is always integer cents. APR/APY are decimals (0.0487 = 4.87%).

export type BankId = string;

export interface Bank {
  id: BankId;
  name: string;
  /** FDIC certificate number — from banks.data.fdic.gov, free and keyless. */
  fdicCert: string | null;
  productName: string;
}

/** One APY reading for one bank at one point in time. */
export interface RateObservation {
  observedAt: string; // ISO
  bankId: BankId;
  bankName: string;
  apy: number;
  minBalanceCents: number;
  monthlyFeeCents: number;
  promoExpiresOn: string | null;
  sourceUrl: string;
  /** Pointer back to the raw crawl blob this was parsed from. */
  rawBlobId: string | null;
}

/** A customer's money moving from one bank to another. */
export interface SweepEvent {
  occurredAt: string; // ISO
  customerId: string;
  fromBankId: BankId | null; // null = initial funding from linked account
  toBankId: BankId;
  amountCents: number;
  aprAtMove: number;
  reason: string;
}

/** One day of interest earned by one customer at one bank. */
export interface Accrual {
  date: string; // YYYY-MM-DD
  customerId: string;
  bankId: BankId;
  principalCents: number;
  apr: number;
  accruedCents: number;
}

export type PayoutDestination = 'origin_account' | 'omnibus';

export interface InterestPayout {
  paidAt: string; // ISO
  customerId: string;
  periodStart: string;
  periodEnd: string;
  amountCents: number;
  destination: PayoutDestination;
}

export interface Customer {
  id: string;
  name: string;
  /** Where interest goes when destination is 'origin_account'. */
  originAccountMask: string;
  payoutDestination: PayoutDestination;
  principalCents: number;
}
