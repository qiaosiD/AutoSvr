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

/** Day-by-day map of where the money sat and what it earned. */
export const customerTimeline = (customerId: string) => `
  SELECT
    toString(date) AS date,
    toString(bankId) AS bankId,
    toFloat64(apr) AS apr,
    toInt64(principalCents) AS principalCents,
    toInt64(accruedCents) AS accruedCents,
    sum(toInt64(accruedCents)) OVER (ORDER BY toString(date)) AS cumulativeCents
  FROM ${TABLES.accruals}
  WHERE toString(customerId) = ${sqlString(customerId)}
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
    sum(toInt64(accruedCents)) AS totalAccruedCents,
    argMax(toInt64(principalCents), toString(date)) AS principalCents,
    argMax(toString(bankId), toString(date)) AS currentBankId,
    argMax(toFloat64(apr), toString(date)) AS currentApr,
    pow(exp(sum(log(1 + toFloat64(apr) / 365))), 365.0 / count()) - 1 AS blendedApy
  FROM ${TABLES.accruals}
  WHERE toString(customerId) = ${sqlString(customerId)}
`;

/** Every move made for a customer, newest first, with the reason. */
export const sweepLog = (customerId: string) => `
  SELECT
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
