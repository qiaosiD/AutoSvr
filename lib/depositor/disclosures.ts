// Regulatory disclosure text for the depositor-facing site and statements.
//
// AutoSvr is not a bank. That single fact drives most of what follows: the
// rules below bind our partner banks directly, and bind us through what we are
// allowed to say about them. Each block cites the rule it satisfies so a
// compliance reviewer can check our work against the source rather than take
// the wording on faith.
//
// Verified against the current rules, September 2026:
//   - 12 CFR 1030.6      Reg DD periodic statement disclosures
//   - 12 CFR 1005.8(b)   Reg E annual error-resolution notice
//   - 12 CFR 1005.9(b)   Reg E periodic statement content
//   - 12 CFR 1005.11     Reg E error-resolution procedure and timelines
//   - 12 CFR 328 subpart B  FDIC misrepresentation rule for non-banks
//   - 12 CFR 330.5 / 330.7  FDIC pass-through deposit insurance
//
// This is demo-grade wording modeled on the regulations. It is not legal
// advice and has not been through counsel or a partner bank's compliance
// review, both of which a real deposit program needs before launch.

export const PROGRAM_NAME = 'AutoSvr';
export const PROGRAM_LEGAL_NAME = 'AutoSvr Technologies, Inc.';

/**
 * 12 CFR 328 subpart B. A non-bank that says anything about FDIC insurance
 * must state plainly that it is not itself insured, name the banks where the
 * deposits actually sit, and make clear that insurance covers a bank failing
 * rather than the non-bank failing. All three sentences are load-bearing.
 */
export const FDIC_NON_BANK_NOTICE = [
  `${PROGRAM_LEGAL_NAME} is not an FDIC-insured bank.`,
  `Funds you place through ${PROGRAM_NAME} are deposited into savings accounts at the FDIC-insured partner banks named on this page and in your statements.`,
  `FDIC deposit insurance protects against the failure of an insured partner bank. It does not protect against the failure of ${PROGRAM_LEGAL_NAME}, and it does not protect against any loss of value.`,
].join(' ');

/**
 * 12 CFR 330.5 and 330.7. Pass-through coverage is not automatic — it depends
 * on the account being titled as custodial and on records that make each
 * owner's share ascertainable. Saying "FDIC insured up to $250,000" without
 * the conditions is the misrepresentation the rule exists to stop.
 */
export const PASS_THROUGH_NOTICE =
  'Deposits are held in custodial accounts titled for the benefit of our customers. ' +
  'Insurance passes through to you individually, up to $250,000 per depositor, per ' +
  'insured bank, for each account ownership category — provided the account records ' +
  'identify you as an owner and your balance is ascertainable from those records. ' +
  'Coverage is calculated across every account you hold at the same bank, including ' +
  'accounts you opened directly, so money placed at a bank where you already bank ' +
  'may exceed the limit when combined.';

/**
 * The FDIC's September 2024 custodial recordkeeping proposal (RIN 3064-AG07),
 * prompted by the Synapse failure, would require daily reconciliation to a
 * beneficial-owner ledger. It had not been finalized as of this writing; we
 * build to it anyway, because a depositor's claim on a failed bank is only as
 * good as the records behind it.
 */
export const RECORDKEEPING_NOTICE =
  'We reconcile every customer balance against our partner banks daily and keep a ' +
  'continuous record of which bank held your money on each day. Your statements ' +
  'show that record. It is what substantiates your insurance claim if a partner ' +
  'bank fails.';

/**
 * 12 CFR 1005.8(b), with the timelines from 1005.11. The 60-day clock runs
 * from when the statement went out, not from the transfer — and losing that
 * distinction is how consumers lose claims.
 */
export const ERROR_RESOLUTION_NOTICE = {
  heading: 'In Case of Errors or Questions About Your Electronic Transfers',
  body: [
    `Telephone us at 1-800-555-0132 or write to ${PROGRAM_LEGAL_NAME}, Deposit Operations, P.O. Box 4412, Denver, CO 80201 as soon as you can if you think your statement or receipt is wrong, or if you need more information about a transfer listed on the statement or receipt. We must hear from you no later than 60 days after we sent you the FIRST statement on which the problem or error appeared.`,
    'Tell us your name and account number, describe the error or the transfer you are unsure about, explain as clearly as you can why you believe it is an error or why you need more information, and tell us the dollar amount of the suspected error.',
    'If you tell us orally, we may require that you send us your complaint or question in writing within 10 business days.',
    'We will determine whether an error occurred within 10 business days after we hear from you and will correct any error promptly. If we need more time, however, we may take up to 45 days to investigate your complaint or question. If we decide to do this, we will credit your account within 10 business days for the amount you think is in error, so that you will have the use of the money during the time it takes us to complete our investigation. If we ask you to put your complaint or question in writing and we do not receive it within 10 business days, we may not credit your account.',
    'For errors involving new accounts, we may take up to 20 business days to credit your account for the amount you think is in error. For new accounts, and for transfers initiated outside the United States, we may take up to 90 days to investigate your complaint or question.',
    'We will tell you the results within three business days after completing our investigation. If we decide that there was no error, we will send you a written explanation. You may ask for copies of the documents that we used in our investigation.',
  ],
};

/** Reg DD, 12 CFR 1030.6(a)(1). The regulation requires this exact term. */
export const APY_EARNED_TERM = 'Annual Percentage Yield Earned';

export const APY_EARNED_EXPLAINER =
  'Annual Percentage Yield Earned reflects the interest actually credited to your ' +
  'account during this statement period, annualized against your average daily ' +
  'balance. Because your money moves between banks, it blends every rate you held ' +
  'during the period rather than quoting any one bank’s advertised rate.';

/**
 * Reg DD, 12 CFR 1030.6(a)(3): fees must be itemized by type and dollar amount.
 * "No fees" still has to be stated — silence is not a disclosure.
 */
export const FEES_NOTICE =
  'No fees were imposed on your account during this statement period. AutoSvr ' +
  'charges no account fees, no transfer fees, and no withdrawal fees.';

export const RATE_VARIABILITY_NOTICE =
  'The annual percentage yield is variable and may change at any time, at the ' +
  'discretion of the bank holding your deposit. Rates shown are as of the date ' +
  'displayed and are not a guarantee of future yield.';

export const WITHDRAWAL_NOTICE =
  'Withdrawals are sent by ACH to your linked account and generally settle in 1–3 ' +
  'business days. A withdrawal requested after 2:00 p.m. ET, or on a weekend or ' +
  'federal holiday, is initiated the next business day. Interest accrues through ' +
  'the day before the funds leave the partner bank.';
