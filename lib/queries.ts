// The SQL behind every number on the dashboard.
//
// Kept in one file so the analytics are reviewable in isolation — these are
// the statements that decide what a customer is told they earned.

import { sqlString, TABLES } from './rawtree';

/** Latest APY seen for each bank, best first. */
// The casts happen in an inner query: aliasing a cast to the same name as the
// underlying column makes ClickHouse read GROUP BY against the raw column and
// reject the statement.
export const bestRateToday = () => `
  SELECT
    bankId,
    argMax(bankName, observedAt) AS bankName,
    argMax(apy, observedAt) AS apy,
    argMax(sourceUrl, observedAt) AS sourceUrl
  FROM (
    SELECT
      toString(bankId) AS bankId,
      toString(bankName) AS bankName,
      toFloat64(apy) AS apy,
      toString(sourceUrl) AS sourceUrl,
      toString(observedAt) AS observedAt
    FROM ${TABLES.rates}
  )
  GROUP BY bankId
  ORDER BY apy DESC
`;

/**
 * One accrual row per day, whatever the ledger actually holds.
 *
 * The datasources are MergeTree, which does not deduplicate, and the daily job
 * writes an accrual for "today" every time it runs. Backfilling through today
 * and then triggering the job — or simply pressing Run twice — leaves two rows
 * for the same date, and every total built on them is silently overstated. It
 * cost us $5.11 and a day of "89 days" reading as "90".
 *
 * Deleting the extras needs an admin key we do not have, so the dedupe lives on
 * the read side, which also protects against any future double write. Rows for
 * one day should be identical; when they are not, there is no ingestion
 * timestamp to say which arrived last, so the tie is broken on bankId purely to
 * make the choice deterministic rather than arbitrary per query.
 *
 * LIMIT 1 BY rather than GROUP BY: the callers aggregate over this subquery,
 * and ClickHouse inlines it, so an argMax in here lands inside their sum() and
 * is rejected as a nested aggregate. LIMIT 1 BY picks one row per date without
 * aggregating at all.
 */
const oneRowPerDay = (customerId: string) => `
  SELECT
    toString(date) AS date,
    toString(bankId) AS bankId,
    toFloat64(apr) AS apr,
    toInt64(principalCents) AS principalCents,
    toInt64(accruedCents) AS accruedCents
  FROM ${TABLES.accruals}
  WHERE toString(customerId) = ${sqlString(customerId)}
  ORDER BY toString(date), toString(bankId)
  LIMIT 1 BY toString(date)
`;

/** Day-by-day map of where the money sat and what it earned. */
export const customerTimeline = (customerId: string) => `
  SELECT
    date,
    bankId,
    apr,
    principalCents,
    accruedCents,
    sum(accruedCents) OVER (ORDER BY date) AS cumulativeCents
  FROM (${oneRowPerDay(customerId)})
  ORDER BY date
`;

/**
 * Headline numbers. blendedApy is the annualized daily-compounded chain of the
 * APRs actually earned — not their average, which would misstate a path where
 * the rate moved, and the rate moving is the entire premise of the product.
 */
export const accruedSummary = (customerId: string) => `
  SELECT
    count() AS daysInvested,
    sum(accruedCents) AS totalAccruedCents,
    argMax(principalCents, date) AS principalCents,
    argMax(bankId, date) AS currentBankId,
    argMax(apr, date) AS currentApr,
    pow(exp(sum(log(1 + apr / 365))), 365.0 / count()) - 1 AS blendedApy
  FROM (${oneRowPerDay(customerId)})
`;

/** Every move made for a customer, newest first, with the reason. */
export const sweepLog = (customerId: string) => `
  SELECT DISTINCT
    toString(occurredAt) AS occurredAt,
    toString(ifNull(fromBankId, '')) AS fromBankId,
    toString(toBankId) AS toBankId,
    toInt64(amountCents) AS amountCents,
    toFloat64(aprAtMove) AS aprAtMove,
    toString(reason) AS reason
  FROM ${TABLES.sweeps}
  WHERE toString(customerId) = ${sqlString(customerId)}
  ORDER BY occurredAt DESC
`;
