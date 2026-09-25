import { seedHistory, seedRateHistory } from '../lib/demo/seed';
import { blendedApy, formatPct } from '../lib/apy';

const rates = seedRateHistory();
const all = rates.map((r) => r.apy);
const stat = (xs: number[]) => ({
  min: formatPct(Math.min(...xs)),
  mean: formatPct(xs.reduce((a, b) => a + b, 0) / xs.length),
  max: formatPct(Math.max(...xs)),
});
console.log('ALL bank-days      ', stat(all));

// Daily max across banks = the theoretical ceiling if you moved every day free.
const byDate = new Map<string, number[]>();
for (const r of rates) {
  const d = r.observedAt.slice(0, 10);
  byDate.set(d, [...(byDate.get(d) ?? []), r.apy]);
}
const dailyMax = [...byDate.values()].map((v) => Math.max(...v));
console.log('daily BEST rate    ', stat(dailyMax));
console.log('perfect-chase APY  ', formatPct(blendedApy(dailyMax)));

const { accruals } = seedHistory();
const realized = accruals.map((a) => a.apr);
console.log('realized by customer', stat(realized));
console.log('realized APY       ', formatPct(blendedApy(realized)));
console.log('');
console.log('sanity: realized APY must sit BELOW perfect-chase APY');
console.log('        and realized mean APR must sit within [all min, daily-best max]');
